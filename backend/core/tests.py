import io
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from .bulk_load_grading import (
    bulk_load_grading_structure,
    bulk_load_student_activity_scores,
)
from .grading_suggestion_service import (
    build_grade_breakdown,
    compute_suggested_grade,
    validate_scheme_weights,
)
from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicIndicatorCatalog,
    AcademicIndicatorsReport,
    AcademicPeriod,
    AcademicYear,
    Attendance,
    Campus,
    ComponentSegment,
    CourseAssignment,
    Enrollment,
    Grade,
    GradeDirector,
    GradeLevel,
    GradingActivity,
    GradingScale,
    GradingScheme,
    Group,
    Institution,
    PerformanceSummary,
    SchoolRecord,
    Student,
    StudentActivityScore,
    Subject,
    SubjectComponent,
    Teacher,
    UserProfile,
)


class PerformanceSummaryFromGradesTests(TransactionTestCase):
    """TransactionTestCase so transaction.on_commit from grade signals runs."""

    reset_sequences = True

    def setUp(self):
        self.inst = Institution.objects.create(name="IE Test", dane_code="DANE990001")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede A")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="601",
        )
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Matemáticas")
        self.teacher = Teacher.objects.create(
            document_number="T1",
            first_name="Ana",
            first_last_name="Pérez",
            full_name="Ana Pérez",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Matemáticas",
        )
        self.ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.s_high = Student.objects.create(
            document_number="S1",
            first_name="Luis",
            first_last_name="Alto",
            full_name="Luis Alto",
        )
        self.s_low = Student.objects.create(
            document_number="S2",
            first_name="Marta",
            first_last_name="Baja",
            full_name="Marta Baja",
        )
        Enrollment.objects.create(
            student=self.s_high,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )
        Enrollment.objects.create(
            student=self.s_low,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )

    def test_grade_save_creates_summaries_and_ranks(self):
        Grade.objects.create(
            student=self.s_high,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("5.00"),
        )
        Grade.objects.create(
            student=self.s_low,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("3.00"),
        )

        sh = PerformanceSummary.objects.get(student=self.s_high, group=self.group)
        sl = PerformanceSummary.objects.get(student=self.s_low, group=self.group)
        self.assertEqual(sh.period_average, Decimal("5.00"))
        self.assertEqual(sh.rank, 1)
        self.assertEqual(sl.period_average, Decimal("3.00"))
        self.assertEqual(sl.rank, 2)

    def test_grade_update_recomputes_rank(self):
        ca2 = CourseAssignment.objects.create(
            subject=Subject.objects.create(
                academic_area=self.area,
                institution=self.inst,
                name="Ciencias",
            ),
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        Grade.objects.create(
            student=self.s_high,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("3.00"),
        )
        Grade.objects.create(
            student=self.s_high,
            course_assignment=ca2,
            academic_period=self.period,
            numerical_grade=Decimal("5.00"),
        )
        Grade.objects.create(
            student=self.s_low,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("4.00"),
        )

        sh = PerformanceSummary.objects.get(student=self.s_high, group=self.group)
        sl = PerformanceSummary.objects.get(student=self.s_low, group=self.group)
        self.assertEqual(sh.period_average, Decimal("4.00"))
        self.assertEqual(sl.period_average, Decimal("4.00"))
        self.assertEqual(sh.rank, 1)
        self.assertEqual(sl.rank, 1)

        g = Grade.objects.get(student=self.s_low, course_assignment=self.ca)
        g.numerical_grade = Decimal("2.00")
        g.save()

        sh.refresh_from_db()
        sl.refresh_from_db()
        self.assertEqual(sh.rank, 1)
        self.assertEqual(sl.rank, 2)
        self.assertEqual(sl.period_average, Decimal("2.00"))

    def test_grade_delete_removes_summary_when_no_grades_left(self):
        g = Grade.objects.create(
            student=self.s_high,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("4.50"),
        )
        self.assertTrue(
            PerformanceSummary.objects.filter(
                student=self.s_high, group=self.group
            ).exists()
        )
        g.delete()
        self.assertFalse(
            PerformanceSummary.objects.filter(
                student=self.s_high, group=self.group
            ).exists()
        )


class PerformanceSummaryRecalculateByGradeApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(username="apiuser", password="secret")

        self.inst = Institution.objects.create(name="IE API", dane_code="DANE990002")
        UserProfile.objects.filter(user=user).update(
            role="COORDINATOR",
            institution_id=self.inst.id,
        )
        user = get_user_model().objects.select_related("profile").get(pk=user.pk)
        self.client.force_authenticate(user=user)
        self.campus = Campus.objects.create(institution=self.inst, name="Sede API")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2027)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="QUINTO", level_order=5
        )
        self.group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="501",
        )
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Área")
        self.teacher = Teacher.objects.create(
            document_number="T9",
            first_name="Doc",
            first_last_name="Api",
            full_name="Doc Api",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Lengua",
        )
        self.ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.student = Student.objects.create(
            document_number="S9",
            first_name="Pepe",
            first_last_name="Prueba",
            full_name="Pepe Prueba",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )

    def test_rejects_grade_level_and_year_different_institution(self):
        other = Institution.objects.create(name="Otra", dane_code="DANE990003")
        ay_other = AcademicYear.objects.create(institution=other, year=2028)
        url = reverse("performance-summary-recalculate-by-grade")
        r = self.client.post(
            url,
            {
                "grade_level": str(self.gl.id),
                "academic_year": str(ay_other.id),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_manual_recalculate_all_combinations(self):
        url = reverse("performance-summary-recalculate-by-grade")
        r = self.client.post(
            url,
            {
                "grade_level": str(self.gl.id),
                "academic_year": str(self.ay.id),
                "sync_all_group_period_combinations": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["pairs_synced"], 1)
        self.assertEqual(r.data["groups_in_scope"], 1)
        self.assertEqual(r.data["mode"], "all_combinations")

    def test_manual_recalculate_from_grades(self):
        Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("4.20"),
        )
        url = reverse("performance-summary-recalculate-by-grade")
        r = self.client.post(
            url,
            {
                "grade_level": str(self.gl.id),
                "academic_year": str(self.ay.id),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["pairs_synced"], 1)
        self.assertEqual(r.data["mode"], "from_grades")
        ps = PerformanceSummary.objects.get(student=self.student, group=self.group)
        self.assertEqual(ps.period_average, Decimal("4.20"))


class PerformanceSummaryRecalculateByInstitutionApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(username="instuser", password="x")

        self.inst = Institution.objects.create(name="IE Full", dane_code="DANE990010")
        UserProfile.objects.filter(user=user).update(
            role="COORDINATOR",
            institution_id=self.inst.id,
        )
        user = get_user_model().objects.select_related("profile").get(pk=user.pk)
        self.client.force_authenticate(user=user)
        self.other_inst = Institution.objects.create(name="Otra IE", dane_code="DANE990011")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede Central")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2025)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="TERCERO", level_order=3
        )
        self.group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="301",
        )
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Área X")
        self.teacher = Teacher.objects.create(
            document_number="T88",
            first_name="T",
            first_last_name="Inst",
            full_name="T Inst",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Asignatura X",
        )
        self.ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.student = Student.objects.create(
            document_number="S88",
            first_name="Alu",
            first_last_name="Inst",
            full_name="Alu Inst",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )

    def test_rejects_campus_from_other_institution(self):
        foreign_campus = Campus.objects.create(
            institution=self.other_inst, name="Sede extranjera"
        )
        url = reverse("performance-summary-recalculate-by-institution")
        r = self.client.post(
            url,
            {
                "institution": str(self.inst.id),
                "academic_year": str(self.ay.id),
                "campus": str(foreign_campus.id),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_institution_sync_all_combinations(self):
        url = reverse("performance-summary-recalculate-by-institution")
        r = self.client.post(
            url,
            {
                "institution": str(self.inst.id),
                "academic_year": str(self.ay.id),
                "sync_all_group_period_combinations": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["pairs_synced"], 1)
        self.assertEqual(r.data["groups_in_scope"], 1)
        self.assertEqual(r.data["mode"], "all_combinations")

    def test_institution_from_grades(self):
        Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("3.80"),
        )
        url = reverse("performance-summary-recalculate-by-institution")
        r = self.client.post(
            url,
            {"institution": str(self.inst.id), "academic_year": str(self.ay.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["pairs_synced"], 1)
        self.assertEqual(r.data["mode"], "from_grades")
        ps = PerformanceSummary.objects.get(student=self.student, group=self.group)
        self.assertEqual(ps.period_average, Decimal("3.80"))


class GroupsListApiTests(TestCase):
    """Regression: list must not repeat the same group id (stable ordering for shared `name`)."""

    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(username="grouplist", password="x")
        UserProfile.objects.filter(user=user).update(role="ADMIN")
        user = get_user_model().objects.select_related("profile").get(pk=user.pk)
        self.client.force_authenticate(user=user)
        self.inst = Institution.objects.create(name="IE Grupos", dane_code="DANE991000")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede 1")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.groups = []
        for i in range(15):
            gl = GradeLevel.objects.create(
                institution=self.inst,
                name=f"Nivel-{i}",
                level_order=i,
            )
            self.groups.append(
                Group.objects.create(
                    grade_level=gl,
                    academic_year=self.ay,
                    campus=self.campus,
                    name="601",
                )
            )

    def test_groups_list_no_duplicate_ids_single_page(self):
        url = reverse("group-list")
        r = self.client.get(url, {"limit": 100, "offset": 0})
        self.assertEqual(r.status_code, 200)
        ids = [row["id"] for row in r.data["results"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_groups_list_pagination_no_overlap_same_name(self):
        url = reverse("group-list")
        seen = set()
        for offset in (0, 5, 10):
            r = self.client.get(url, {"limit": 5, "offset": offset})
            self.assertEqual(r.status_code, 200)
            for row in r.data["results"]:
                self.assertNotIn(row["id"], seen, msg="same group id on multiple pages")
                seen.add(row["id"])
        self.assertEqual(len(seen), 15)

    def test_groups_list_filter_by_academic_year_institution(self):
        other = Institution.objects.create(name="IE Otra", dane_code="DANE991099")
        other_campus = Campus.objects.create(institution=other, name="Sede Otra")
        other_ay = AcademicYear.objects.create(institution=other, year=2099)
        other_gl = GradeLevel.objects.create(
            institution=other, name="OTRO", level_order=1
        )
        Group.objects.create(
            grade_level=other_gl,
            academic_year=other_ay,
            campus=other_campus,
            name="ZZZ",
        )
        url = reverse("group-list")
        r = self.client.get(
            url,
            {
                "academic_year__institution": str(self.inst.id),
                "limit": 200,
                "offset": 0,
            },
        )
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertTrue(all(gid in ids for gid in (str(g.id) for g in self.groups)))
        self.assertFalse(
            any(row["name"] == "ZZZ" for row in r.data["results"]),
        )


class CourseAssignmentForTeacherApiTests(TestCase):
    """GET /api/course-assignments/for-teacher/ — single-query list for pickers and teacher scope."""

    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(username="cafteacher", password="x")
        self.inst = Institution.objects.create(name="IE CA", dane_code="DANE992001")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede 1")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.ay2 = AcademicYear.objects.create(institution=self.inst, year=2027)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="601",
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Área")
        self.teacher = Teacher.objects.create(
            document_number="DOC900",
            first_name="Luis",
            first_last_name="Ruiz",
            full_name="Luis Ruiz",
        )
        self.other_teacher = Teacher.objects.create(
            document_number="DOC901",
            first_name="Ana",
            first_last_name="Díaz",
            full_name="Ana Díaz",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Matemáticas",
        )
        self.subject2 = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Ciencias",
        )
        self.ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.group2 = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay2,
            campus=self.campus,
            name="601",
        )
        self.ca_other_year = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group2,
            academic_year=self.ay2,
        )
        CourseAssignment.objects.create(
            subject=self.subject2,
            teacher=self.other_teacher,
            group=self.group,
            academic_year=self.ay,
        )
        UserProfile.objects.filter(user__username="cafteacher").update(
            role="TEACHER",
            teacher_id=self.teacher.id,
            institution_id=self.inst.id,
        )
        user = get_user_model().objects.select_related("profile").get(
            username="cafteacher"
        )
        self.client.force_authenticate(user=user)

    def test_for_teacher_requires_param(self):
        url = reverse("courseassignment-for-teacher")
        r = self.client.get(url)
        self.assertEqual(r.status_code, 400)

    def test_for_teacher_returns_only_that_teacher(self):
        url = reverse("courseassignment-for-teacher")
        r = self.client.get(url, {"teacher": str(self.teacher.id)})
        self.assertEqual(r.status_code, 200)
        self.assertIn("results", r.data)
        self.assertIn("count", r.data)
        self.assertFalse(r.data.get("truncated", False))
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.ca.id), str(self.ca_other_year.id)})

    def test_for_teacher_academic_year_filter(self):
        url = reverse("courseassignment-for-teacher")
        r = self.client.get(
            url,
            {"teacher": str(self.teacher.id), "academic_year": str(self.ay.id)},
        )
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.ca.id)})

    def test_for_teacher_rejects_other_teacher_id(self):
        url = reverse("courseassignment-for-teacher")
        r = self.client.get(url, {"teacher": str(self.other_teacher.id)})
        self.assertEqual(r.status_code, 403)

    def test_list_teacher_in_filter(self):
        url = reverse("courseassignment-list")
        r = self.client.get(
            url,
            {
                "teacher__in": ",".join(
                    [str(self.teacher.id), str(self.other_teacher.id)]
                ),
                "limit": 50,
                "offset": 0,
            },
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.ca.id), str(self.ca_other_year.id)})


class GradingConsolidatedCsvExportApiTests(TestCase):
    """GET /api/reports/grading-consolidated/ — audit CSV (ADMIN / COORDINATOR)."""

    def setUp(self):
        self.client = APIClient()
        self.admin_user = get_user_model().objects.create_user(username="repadmin", password="x")
        self.coord_user = get_user_model().objects.create_user(username="repcoord", password="x")
        self.teacher_user = get_user_model().objects.create_user(username="repteach", password="x")

        UserProfile.objects.filter(user=self.admin_user).update(role="ADMIN")
        UserProfile.objects.filter(user=self.coord_user).update(
            role="COORDINATOR", institution_id=None
        )
        UserProfile.objects.filter(user=self.teacher_user).update(role="TEACHER")

        self.inst = Institution.objects.create(name="IE Report", dane_code="DANE993500")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede Norte")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="QUINTO", level_order=5
        )
        self.group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="501",
        )
        self.p1 = AcademicPeriod.objects.create(academic_year=self.ay, number=1, name="P1")
        self.p2 = AcademicPeriod.objects.create(academic_year=self.ay, number=2, name="P2")
        self.area = AcademicArea.objects.create(institution=self.inst, name="Humanidades")
        self.teacher = Teacher.objects.create(
            document_number="TDOC500",
            first_name="Profe",
            first_last_name="CSV",
            full_name="Profe CSV",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Lengua",
        )
        self.ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.student = Student.objects.create(
            document_number="ST500",
            first_name="Ana",
            first_last_name="Lista",
            full_name="Ana Lista",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p1,
            numerical_grade=Decimal("4.50"),
        )

        UserProfile.objects.filter(user=self.coord_user).update(
            institution_id=self.inst.id,
        )

        # Reload users so ``.profile`` matches DB (create_user + signal can leave a
        # stale reverse relation on the in-memory instance before role updates).
        User = get_user_model()
        self.admin_user = User.objects.select_related("profile").get(pk=self.admin_user.pk)
        self.coord_user = User.objects.select_related("profile").get(pk=self.coord_user.pk)
        self.teacher_user = User.objects.select_related("profile").get(pk=self.teacher_user.pk)

        self.url = reverse("report-grading-consolidated-csv")

    def test_teacher_forbidden(self):
        self.client.force_authenticate(user=self.teacher_user)
        r = self.client.get(self.url, {"academic_year": str(self.ay.id)})
        self.assertEqual(r.status_code, 403)

    def test_admin_csv_is_pivoted_one_row_per_student(self):
        self.assertEqual(self.admin_user.profile.role, "ADMIN")
        self.client.force_authenticate(user=self.admin_user)
        r = self.client.get(self.url, {"academic_year": str(self.ay.id)})
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        body = b"".join(r.streaming_content).decode("utf-8-sig")
        lines = [ln for ln in body.strip().splitlines() if ln]
        # Header + exactly one enrolled student.
        self.assertEqual(len(lines), 2)
        header = lines[0].split(",")
        # Fixed identification columns.
        self.assertIn("estudiante_nombre_completo", header)
        self.assertIn("asignaturas_calificadas", header)
        self.assertIn("asignaturas_pendientes", header)
        self.assertIn("promedio_numerico", header)
        # Two periods => subject is emitted twice: "Lengua (P1)" and "Lengua (P2)".
        self.assertIn("Lengua (P1)", header)
        self.assertIn("Lengua (P2)", header)

        data = lines[1].split(",")
        row = dict(zip(header, data))
        self.assertEqual(row["estudiante_nombre_completo"], "Ana Lista")
        # P1 calificada (4.50), P2 pendiente (vacía).
        self.assertEqual(row["Lengua (P1)"], "4.50")
        self.assertEqual(row["Lengua (P2)"], "")
        self.assertEqual(row["asignaturas_calificadas"], "1")
        self.assertEqual(row["asignaturas_pendientes"], "1")
        self.assertEqual(row["promedio_numerico"], "4.50")

    def test_coordinator_wrong_institution_forbidden(self):
        self.client.force_authenticate(user=self.coord_user)
        other = Institution.objects.create(name="Otra IE", dane_code="DANE993501")
        ay_other = AcademicYear.objects.create(institution=other, year=2030)
        r = self.client.get(self.url, {"academic_year": str(ay_other.id)})
        self.assertEqual(r.status_code, 403)

    def test_coordinator_ok(self):
        self.client.force_authenticate(user=self.coord_user)
        r = self.client.get(self.url, {"academic_year": str(self.ay.id)})
        self.assertEqual(r.status_code, 200)

    def test_invalid_period_for_year(self):
        self.client.force_authenticate(user=self.admin_user)
        other = Institution.objects.create(name="IE X", dane_code="DANE993502")
        ay2 = AcademicYear.objects.create(institution=other, year=2031)
        p_wrong = AcademicPeriod.objects.create(academic_year=ay2, number=1, name="PX")
        r = self.client.get(
            self.url,
            {"academic_year": str(self.ay.id), "academic_period": str(p_wrong.id)},
        )
        self.assertEqual(r.status_code, 400)


class StudentTransferApiTests(TransactionTestCase):
    """TransactionTestCase so performance-summary on_commit hooks can run."""

    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(username="transferuser", password="x")

        self.inst = Institution.objects.create(name="IE Traslado", dane_code="DANE994001")
        UserProfile.objects.filter(user=user).update(
            role="COORDINATOR",
            institution_id=self.inst.id,
        )
        user = get_user_model().objects.select_related("profile").get(pk=user.pk)
        self.client.force_authenticate(user=user)
        self.campus_a = Campus.objects.create(institution=self.inst, name="Sede Norte")
        self.campus_b = Campus.objects.create(institution=self.inst, name="Sede Sur")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.gl_six = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.gl_seven = GradeLevel.objects.create(
            institution=self.inst, name="SEPTIMO", level_order=7
        )
        self.group_source = Group.objects.create(
            grade_level=self.gl_six,
            academic_year=self.ay,
            campus=self.campus_a,
            name="601",
        )
        self.group_target_same_grade = Group.objects.create(
            grade_level=self.gl_six,
            academic_year=self.ay,
            campus=self.campus_b,
            name="602",
        )
        self.group_target_other_grade = Group.objects.create(
            grade_level=self.gl_seven,
            academic_year=self.ay,
            campus=self.campus_a,
            name="701",
        )
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Humanidades")
        self.teacher = Teacher.objects.create(
            document_number="TTR",
            first_name="Profe",
            first_last_name="Traslado",
            full_name="Profe Traslado",
        )
        self.subject_math = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Matemáticas",
        )
        self.subject_lang = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Lengua",
        )
        self.subject_only_source = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Tecnología",
        )
        self.ca_source_math = CourseAssignment.objects.create(
            subject=self.subject_math,
            teacher=self.teacher,
            group=self.group_source,
            academic_year=self.ay,
        )
        self.ca_source_lang = CourseAssignment.objects.create(
            subject=self.subject_lang,
            teacher=self.teacher,
            group=self.group_source,
            academic_year=self.ay,
        )
        self.ca_source_tech = CourseAssignment.objects.create(
            subject=self.subject_only_source,
            teacher=self.teacher,
            group=self.group_source,
            academic_year=self.ay,
        )
        self.ca_target_math = CourseAssignment.objects.create(
            subject=self.subject_math,
            teacher=self.teacher,
            group=self.group_target_same_grade,
            academic_year=self.ay,
        )
        self.ca_target_lang = CourseAssignment.objects.create(
            subject=self.subject_lang,
            teacher=self.teacher,
            group=self.group_target_same_grade,
            academic_year=self.ay,
        )
        self.ca_target_grade_math = CourseAssignment.objects.create(
            subject=self.subject_math,
            teacher=self.teacher,
            group=self.group_target_other_grade,
            academic_year=self.ay,
        )
        self.student = Student.objects.create(
            document_number="STTR1",
            first_name="Carlos",
            first_last_name="Movil",
            full_name="Carlos Movil",
        )
        self.enrollment = Enrollment.objects.create(
            student=self.student,
            group=self.group_source,
            academic_year=self.ay,
            status="active",
        )
        GradeDirector.objects.create(
            teacher=self.teacher,
            group=self.group_target_same_grade,
            academic_year=self.ay,
        )
        GradeDirector.objects.create(
            teacher=self.teacher,
            group=self.group_target_other_grade,
            academic_year=self.ay,
        )
        self.grade_math = Grade.objects.create(
            student=self.student,
            course_assignment=self.ca_source_math,
            academic_period=self.period,
            numerical_grade=Decimal("4.50"),
        )
        self.grade_lang = Grade.objects.create(
            student=self.student,
            course_assignment=self.ca_source_lang,
            academic_period=self.period,
            numerical_grade=Decimal("3.80"),
        )
        self.grade_tech = Grade.objects.create(
            student=self.student,
            course_assignment=self.ca_source_tech,
            academic_period=self.period,
            numerical_grade=Decimal("4.00"),
        )
        self.attendance = Attendance.objects.create(
            student=self.student,
            course_assignment=self.ca_source_math,
            academic_period=self.period,
            unexcused_absences=2,
        )
        catalog = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl_six,
            achievement_below_basic="Logro bajo",
            achievement_basic_or_above="Logro básico o superior",
        )
        self.indicator = AcademicIndicator.objects.create(
            student=self.student,
            course_assignment=self.ca_source_lang,
            academic_period=self.period,
            catalog=catalog,
            outcome="basic_or_above",
            description="Lee con fluidez",
        )
        SchoolRecord.objects.create(
            student=self.student,
            group=self.group_source,
            academic_year=self.ay,
            institution=self.inst,
            campus=self.campus_a,
            generated_at=timezone.now(),
        )
        AcademicIndicatorsReport.objects.create(
            student=self.student,
            group=self.group_source,
            academic_period=self.period,
            grade_director=self.teacher,
            generated_at=timezone.now(),
        )

    def _transfer_url(self):
        return reverse("student-transfer", kwargs={"pk": self.student.id})

    def test_transfer_cross_campus_migrates_evaluation_data(self):
        r = self.client.post(
            self._transfer_url(),
            {"target_group_id": str(self.group_target_same_grade.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["grades_migrated"], 2)
        self.assertEqual(r.data["grades_skipped"], 1)
        self.assertEqual(r.data["attendances_migrated"], 1)
        self.assertEqual(r.data["academic_indicators_migrated"], 1)
        self.assertTrue(r.data["school_record_regenerated"])
        self.assertEqual(r.data["academic_indicators_reports_regenerated"], 1)
        self.assertTrue(any("Tecnología" in w for w in r.data["warnings"]))

        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.status, "withdrawn")

        new_enrollment = Enrollment.objects.get(
            student=self.student,
            group=self.group_target_same_grade,
            academic_year=self.ay,
        )
        self.assertEqual(new_enrollment.status, "active")

        self.grade_math.refresh_from_db()
        self.grade_lang.refresh_from_db()
        self.grade_tech.refresh_from_db()
        self.assertEqual(self.grade_math.course_assignment_id, self.ca_target_math.id)
        self.assertEqual(self.grade_lang.course_assignment_id, self.ca_target_lang.id)
        self.assertEqual(self.grade_tech.course_assignment_id, self.ca_source_tech.id)

        self.attendance.refresh_from_db()
        self.assertEqual(self.attendance.course_assignment_id, self.ca_target_math.id)

        self.indicator.refresh_from_db()
        self.assertEqual(self.indicator.course_assignment_id, self.ca_target_lang.id)

        record = SchoolRecord.objects.get(student=self.student, academic_year=self.ay)
        self.assertEqual(record.group_id, self.group_target_same_grade.id)
        self.assertEqual(record.campus_id, self.campus_b.id)

        report = AcademicIndicatorsReport.objects.get(
            student=self.student, academic_period=self.period
        )
        self.assertEqual(report.group_id, self.group_target_same_grade.id)

        ps = PerformanceSummary.objects.get(
            student=self.student, group=self.group_target_same_grade
        )
        self.assertEqual(ps.period_average, Decimal("4.15"))

    def test_transfer_different_grade_omits_missing_subjects(self):
        r = self.client.post(
            self._transfer_url(),
            {"target_group_id": str(self.group_target_other_grade.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["grades_migrated"], 1)
        self.assertEqual(r.data["grades_skipped"], 2)

        self.grade_math.refresh_from_db()
        self.assertEqual(
            self.grade_math.course_assignment_id, self.ca_target_grade_math.id
        )

    def test_transfer_rejects_same_group(self):
        r = self.client.post(
            self._transfer_url(),
            {"target_group_id": str(self.group_source.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "same_group")

    def test_transfer_rejects_without_active_enrollment(self):
        self.enrollment.status = "withdrawn"
        self.enrollment.save(update_fields=["status"])
        r = self.client.post(
            self._transfer_url(),
            {"target_group_id": str(self.group_target_same_grade.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "no_active_enrollment")


class ActivityGradingModuleTests(TestCase):
    """Activity-based grading structure, calculation and API."""

    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.teacher_user = User.objects.create_user(username="gradteacher", password="x")
        self.other_teacher_user = User.objects.create_user(
            username="gradother", password="x"
        )
        self.inst = Institution.objects.create(name="IE Grading", dane_code="123456789012")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede Grading")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="601",
        )
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.teacher = Teacher.objects.create(
            document_number="GT1",
            first_name="Ana",
            first_last_name="Docente",
            full_name="Ana Docente",
        )
        self.other_teacher = Teacher.objects.create(
            document_number="GT2",
            first_name="Otro",
            first_last_name="Docente",
            full_name="Otro Docente",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Matemáticas",
        )
        self.ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.other_group = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="602",
        )
        self.other_ca = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.other_teacher,
            group=self.other_group,
            academic_year=self.ay,
        )
        self.student = Student.objects.create(
            document_number="GS1",
            first_name="Juan",
            first_last_name="Pérez",
            full_name="Juan Pérez",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )
        UserProfile.objects.filter(user=self.teacher_user).update(
            role="TEACHER",
            teacher_id=self.teacher.id,
            institution_id=self.inst.id,
        )
        UserProfile.objects.filter(user=self.other_teacher_user).update(
            role="TEACHER",
            teacher_id=self.other_teacher.id,
            institution_id=self.inst.id,
        )
        self.teacher_user = User.objects.select_related("profile").get(
            pk=self.teacher_user.pk
        )
        self.other_teacher_user = User.objects.select_related("profile").get(
            pk=self.other_teacher_user.pk
        )
        self.client.force_authenticate(user=self.teacher_user)

    def _build_valid_scheme(self):
        scheme = GradingScheme.objects.create(
            course_assignment=self.ca,
            academic_period=self.period,
        )
        cognitive = SubjectComponent.objects.create(
            subject=self.subject,
            name="Cognitivo",
            weight_percent=Decimal("60.00"),
            sort_order=1,
        )
        attitudinal = SubjectComponent.objects.create(
            subject=self.subject,
            name="Actitudinal",
            weight_percent=Decimal("40.00"),
            sort_order=2,
        )
        evals = ComponentSegment.objects.create(
            grading_scheme=scheme,
            subject_component=cognitive,
            name="Evaluaciones",
            weight_percent=Decimal("40.00"),
            sort_order=1,
        )
        workshops = ComponentSegment.objects.create(
            grading_scheme=scheme,
            subject_component=cognitive,
            name="Talleres",
            weight_percent=Decimal("60.00"),
            sort_order=2,
        )
        attitude_seg = ComponentSegment.objects.create(
            grading_scheme=scheme,
            subject_component=attitudinal,
            name="Participación",
            weight_percent=Decimal("100.00"),
            sort_order=1,
        )
        quiz1 = GradingActivity.objects.create(
            segment=evals,
            name="Quiz 1",
            activity_date=timezone.now().date(),
            sort_order=1,
        )
        partial = GradingActivity.objects.create(
            segment=evals,
            name="Parcial",
            activity_date=timezone.now().date(),
            sort_order=2,
        )
        workshop = GradingActivity.objects.create(
            segment=workshops,
            name="Taller álgebra",
            activity_date=timezone.now().date(),
            sort_order=1,
        )
        attitude_act = GradingActivity.objects.create(
            segment=attitude_seg,
            name="Asistencia activa",
            activity_date=timezone.now().date(),
            sort_order=1,
        )
        return scheme, quiz1, partial, workshop, attitude_act

    def _create_default_grading_scales(self):
        specs = (
            ("SP", "Superior", Decimal("4.60"), Decimal("5.00")),
            ("AL", "Alto", Decimal("4.00"), Decimal("4.59")),
            ("BS", "Básico", Decimal("3.00"), Decimal("3.99")),
            ("BJ", "Bajo", Decimal("1.00"), Decimal("2.99")),
        )
        return [
            GradingScale.objects.create(
                institution=self.inst,
                code=code,
                name=name,
                min_score=lo,
                max_score=hi,
            )
            for code, name, lo, hi in specs
        ]

    def test_validate_scheme_weights_rejects_invalid_component_sum(self):
        SubjectComponent.objects.create(
            subject=self.subject,
            name="Solo",
            weight_percent=Decimal("60.00"),
        )
        scheme = GradingScheme.objects.create(
            course_assignment=self.ca,
            academic_period=self.period,
        )
        with self.assertRaises(Exception):
            validate_scheme_weights(scheme)

    def test_validate_scheme_weights_rejects_invalid_segment_sum(self):
        component = SubjectComponent.objects.create(
            subject=self.subject,
            name="Cognitivo",
            weight_percent=Decimal("100.00"),
        )
        scheme = GradingScheme.objects.create(
            course_assignment=self.ca,
            academic_period=self.period,
        )
        ComponentSegment.objects.create(
            grading_scheme=scheme,
            subject_component=component,
            name="Evaluaciones",
            weight_percent=Decimal("30.00"),
        )
        with self.assertRaises(Exception):
            validate_scheme_weights(scheme)

    def test_compute_suggested_grade_weighted_average(self):
        scheme, quiz1, partial, workshop, attitude_act = self._build_valid_scheme()
        StudentActivityScore.objects.create(
            activity=quiz1, student=self.student, score=Decimal("4.50")
        )
        StudentActivityScore.objects.create(
            activity=partial, student=self.student, score=Decimal("4.00")
        )
        StudentActivityScore.objects.create(
            activity=workshop, student=self.student, score=Decimal("5.00")
        )
        StudentActivityScore.objects.create(
            activity=attitude_act, student=self.student, score=Decimal("4.00")
        )
        # Cognitivo: evals avg 4.25 (40%) + workshops 5.0 (60%) = 4.70
        # Actitudinal: 4.00
        # Total: 4.70*0.60 + 4.00*0.40 = 4.42
        suggested = compute_suggested_grade(self.student, scheme)
        self.assertEqual(suggested, Decimal("4.42"))

    def test_compute_suggested_grade_excludes_segments_without_scores(self):
        scheme, quiz1, partial, workshop, _ = self._build_valid_scheme()
        SubjectComponent.objects.filter(subject=self.subject).exclude(
            name="Cognitivo"
        ).delete()
        SubjectComponent.objects.filter(subject=self.subject).update(
            weight_percent=Decimal("100.00")
        )
        StudentActivityScore.objects.create(
            activity=quiz1, student=self.student, score=Decimal("4.00")
        )
        StudentActivityScore.objects.create(
            activity=partial, student=self.student, score=Decimal("4.00")
        )
        # Only evals segment has scores; workshops excluded → segment avg 4.00
        suggested = compute_suggested_grade(self.student, scheme)
        self.assertEqual(suggested, Decimal("4.00"))

    def test_activity_score_does_not_modify_grade(self):
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        grade = Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("3.00"),
            definitive_grade=Decimal("3.50"),
        )
        StudentActivityScore.objects.create(
            activity=quiz1, student=self.student, score=Decimal("5.00")
        )
        grade.refresh_from_db()
        self.assertEqual(grade.numerical_grade, Decimal("3.00"))
        self.assertEqual(grade.definitive_grade, Decimal("3.50"))

    def test_breakdown_api_returns_suggested_grade(self):
        scheme, quiz1, partial, workshop, attitude_act = self._build_valid_scheme()
        for activity, score in (
            (quiz1, "4.50"),
            (partial, "4.00"),
            (workshop, "5.00"),
            (attitude_act, "4.00"),
        ):
            StudentActivityScore.objects.create(
                activity=activity,
                student=self.student,
                score=Decimal(score),
            )
        url = reverse("gradingscheme-breakdown", kwargs={"pk": scheme.id})
        r = self.client.get(url, {"student": str(self.student.id)})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Decimal(str(r.data["suggested_grade"])), Decimal("4.42"))
        self.assertEqual(len(r.data["components"]), 2)

    def test_suggested_grade_endpoint(self):
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        SubjectComponent.objects.filter(subject=self.subject).exclude(
            name="Cognitivo"
        ).delete()
        SubjectComponent.objects.filter(subject=self.subject).update(
            weight_percent=Decimal("100.00")
        )
        ComponentSegment.objects.filter(grading_scheme=scheme).exclude(
            name="Evaluaciones"
        ).delete()
        ComponentSegment.objects.filter(
            grading_scheme=scheme, name="Evaluaciones"
        ).update(weight_percent=Decimal("100.00"))
        StudentActivityScore.objects.create(
            activity=quiz1, student=self.student, score=Decimal("4.50")
        )
        url = reverse("grade-suggested")
        r = self.client.get(
            url,
            {
                "student": str(self.student.id),
                "course_assignment": str(self.ca.id),
                "academic_period": str(self.period.id),
            },
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Decimal(str(r.data["suggested_grade"])), Decimal("4.50"))

    def test_apply_suggestion_updates_numerical_not_definitive(self):
        self._create_default_grading_scales()
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        SubjectComponent.objects.filter(subject=self.subject).exclude(
            name="Cognitivo"
        ).delete()
        SubjectComponent.objects.filter(subject=self.subject).update(
            weight_percent=Decimal("100.00")
        )
        ComponentSegment.objects.filter(grading_scheme=scheme).exclude(
            name="Evaluaciones"
        ).delete()
        ComponentSegment.objects.filter(
            grading_scheme=scheme, name="Evaluaciones"
        ).update(weight_percent=Decimal("100.00"))
        StudentActivityScore.objects.create(
            activity=quiz1, student=self.student, score=Decimal("4.80")
        )
        grade = Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("3.00"),
            definitive_grade=Decimal("3.50"),
        )
        url = reverse("gradingscheme-apply-suggestion", kwargs={"pk": scheme.id})
        r = self.client.post(url, {"student": str(self.student.id)}, format="json")
        self.assertEqual(r.status_code, 200)
        grade.refresh_from_db()
        self.assertEqual(grade.numerical_grade, Decimal("4.80"))
        self.assertEqual(grade.definitive_grade, Decimal("3.50"))
        self.assertIsNotNone(grade.performance_level_id)
        self.assertEqual(grade.performance_level.code, "SP")
        self.assertEqual(r.data["performance_level_name"], "Superior")

    def _score_all_activities_for_student(self, student, activities, scores=None):
        default_scores = [Decimal("4.50"), Decimal("4.00"), Decimal("5.00"), Decimal("4.00")]
        for index, activity in enumerate(activities):
            score = scores[index] if scores else default_scores[index]
            StudentActivityScore.objects.create(
                activity=activity,
                student=student,
                score=score,
            )

    def test_bulk_apply_suggestion_applies_eligible_only(self):
        self._create_default_grading_scales()
        scheme, quiz1, partial, workshop, attitude_act = self._build_valid_scheme()
        activities = [quiz1, partial, workshop, attitude_act]
        self._score_all_activities_for_student(self.student, activities)

        student2 = Student.objects.create(
            document_number="GS2",
            first_name="María",
            first_last_name="López",
            full_name="María López",
        )
        Enrollment.objects.create(
            student=student2,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )
        StudentActivityScore.objects.create(
            activity=quiz1, student=student2, score=Decimal("3.00")
        )

        url = reverse("gradingscheme-apply-suggestion-bulk", kwargs={"pk": scheme.id})
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["applied_count"], 1)
        self.assertEqual(r.data["skipped_count"], 1)
        self.assertEqual(r.data["eligible_count"], 1)
        self.assertTrue(r.data["ranking_recalculated"])
        self.assertEqual(r.data["skipped"][0]["reason"], "incomplete_scores")

        grade = Grade.objects.get(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
        )
        self.assertEqual(grade.numerical_grade, Decimal("4.42"))
        self.assertFalse(
            Grade.objects.filter(
                student=student2,
                course_assignment=self.ca,
                academic_period=self.period,
            ).exists()
        )

    def test_bulk_apply_preview_does_not_persist_or_recalc_ranking(self):
        self._create_default_grading_scales()
        scheme, quiz1, partial, workshop, attitude_act = self._build_valid_scheme()
        self._score_all_activities_for_student(
            self.student, [quiz1, partial, workshop, attitude_act]
        )

        preview_url = reverse(
            "gradingscheme-apply-suggestion-bulk-preview", kwargs={"pk": scheme.id}
        )
        r = self.client.get(preview_url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["applied_count"], 1)
        self.assertTrue(r.data["dry_run"])
        self.assertFalse(r.data["ranking_recalculated"])
        self.assertFalse(
            Grade.objects.filter(
                student=self.student,
                course_assignment=self.ca,
                academic_period=self.period,
            ).exists()
        )
        self.assertFalse(
            PerformanceSummary.objects.filter(
                student=self.student, group=self.group
            ).exists()
        )

    def test_bulk_apply_no_activities_returns_400(self):
        SubjectComponent.objects.create(
            subject=self.subject,
            name="Cognitivo",
            weight_percent=Decimal("100.00"),
            sort_order=1,
        )
        scheme = GradingScheme.objects.create(
            course_assignment=self.ca,
            academic_period=self.period,
        )
        url = reverse("gradingscheme-apply-suggestion-bulk", kwargs={"pk": scheme.id})
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("actividades", r.data["error"].lower())

    def test_bulk_apply_recalculates_ranking(self):
        self._create_default_grading_scales()
        scheme, quiz1, partial, workshop, attitude_act = self._build_valid_scheme()
        activities = [quiz1, partial, workshop, attitude_act]

        student2 = Student.objects.create(
            document_number="GS3",
            first_name="Pedro",
            first_last_name="Alto",
            full_name="Pedro Alto",
        )
        Enrollment.objects.create(
            student=student2,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )
        self._score_all_activities_for_student(
            self.student,
            activities,
            [Decimal("4.50"), Decimal("4.00"), Decimal("5.00"), Decimal("4.00")],
        )
        self._score_all_activities_for_student(
            student2,
            activities,
            [Decimal("3.00"), Decimal("3.00"), Decimal("3.00"), Decimal("3.00")],
        )

        url = reverse("gradingscheme-apply-suggestion-bulk", kwargs={"pk": scheme.id})
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["applied_count"], 2)
        self.assertTrue(r.data["ranking_recalculated"])

        summary_high = PerformanceSummary.objects.get(
            student=self.student, group=self.group, academic_period=self.period
        )
        summary_low = PerformanceSummary.objects.get(
            student=student2, group=self.group, academic_period=self.period
        )
        self.assertEqual(summary_high.rank, 1)
        self.assertEqual(summary_low.rank, 2)
        self.assertGreater(summary_high.period_average, summary_low.period_average)

    def test_bulk_apply_preserves_definitive_grade(self):
        self._create_default_grading_scales()
        scheme, quiz1, partial, workshop, attitude_act = self._build_valid_scheme()
        self._score_all_activities_for_student(
            self.student, [quiz1, partial, workshop, attitude_act]
        )
        grade = Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("2.00"),
            definitive_grade=Decimal("3.50"),
        )

        url = reverse("gradingscheme-apply-suggestion-bulk", kwargs={"pk": scheme.id})
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.status_code, 200)
        grade.refresh_from_db()
        self.assertEqual(grade.numerical_grade, Decimal("4.42"))
        self.assertEqual(grade.definitive_grade, Decimal("3.50"))

    def test_teacher_cannot_see_other_teacher_scheme(self):
        other_scheme = GradingScheme.objects.create(
            course_assignment=self.other_ca,
            academic_period=self.period,
        )
        url = reverse("gradingscheme-detail", kwargs={"pk": other_scheme.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, 404)

    def test_teacher_can_list_subject_components_for_assigned_subject(self):
        SubjectComponent.objects.create(
            subject=self.subject,
            name="Cognitivo",
            weight_percent=Decimal("60.00"),
            sort_order=1,
        )
        SubjectComponent.objects.create(
            subject=self.subject,
            name="Actitudinal",
            weight_percent=Decimal("40.00"),
            sort_order=2,
        )
        other_area = AcademicArea.objects.create(
            institution=self.inst, name="Otra área"
        )
        other_subject = Subject.objects.create(
            academic_area=other_area,
            institution=self.inst,
            name="Historia",
        )
        SubjectComponent.objects.create(
            subject=other_subject,
            name="Cognitivo",
            weight_percent=Decimal("100.00"),
            sort_order=1,
        )
        url = reverse("subjectcomponent-list")
        r = self.client.get(url, {"subject": str(self.subject.id)})
        self.assertEqual(r.status_code, 200)
        names = {row["name"] for row in r.data["results"]}
        self.assertEqual(names, {"Cognitivo", "Actitudinal"})

    def test_teacher_cannot_list_subject_components_for_unassigned_subject(self):
        other_area = AcademicArea.objects.create(
            institution=self.inst, name="Otra área"
        )
        other_subject = Subject.objects.create(
            academic_area=other_area,
            institution=self.inst,
            name="Historia",
        )
        SubjectComponent.objects.create(
            subject=other_subject,
            name="Cognitivo",
            weight_percent=Decimal("100.00"),
            sort_order=1,
        )
        url = reverse("subjectcomponent-list")
        r = self.client.get(url, {"subject": str(other_subject.id)})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 0)

    def test_validate_weights_endpoint_rejects_invalid_scheme(self):
        SubjectComponent.objects.create(
            subject=self.subject,
            name="Parcial",
            weight_percent=Decimal("70.00"),
        )
        scheme = GradingScheme.objects.create(
            course_assignment=self.ca,
            academic_period=self.period,
        )
        url = reverse("gradingscheme-validate-weights", kwargs={"pk": scheme.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["valid"])
        self.assertIn("100%", r.data["message"])

    def test_student_activity_score_rejects_out_of_range(self):
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        url = reverse("studentactivityscore-list")
        r = self.client.post(
            url,
            {
                "activity": str(quiz1.id),
                "student": str(self.student.id),
                "score": "6.00",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def _csv_bytes(self, content: str) -> io.BytesIO:
        return io.BytesIO(content.encode("utf-8-sig"))

    def test_bulk_load_grading_structure_creates_hierarchy(self):
        csv = self._csv_bytes(
            "DANE_COD,ANO,SEDE,GRADO,GRUPO,ASIGNATURA_NOMBRE,PERIODO_NUM,"
            "COMPONENTE_NOMBRE,COMPONENTE_PESO,SEGMENTO_NOMBRE,SEGMENTO_PESO,"
            "ACTIVIDAD_NOMBRE,ACTIVIDAD_FECHA\n"
            f"{self.inst.dane_code},{self.ay.year},{self.campus.name},SEXTO,601,"
            f"Matemáticas,1,Cognitivo,100,Evaluaciones,100,Quiz 1,2026-03-01\n"
        )
        stats = bulk_load_grading_structure(csv)
        self.assertEqual(stats["rows_processed"], 1)
        self.assertEqual(stats["schemes_created"], 1)
        self.assertEqual(stats["components_created"], 1)
        self.assertEqual(stats["segments_created"], 1)
        self.assertEqual(stats["activities_created"], 1)
        self.assertTrue(
            GradingScheme.objects.filter(
                course_assignment=self.ca, academic_period=self.period
            ).exists()
        )

    def test_bulk_load_student_activity_scores_creates_and_updates(self):
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        csv_create = self._csv_bytes(
            "DOC_ESTUDIANTE,DANE_COD,ANO,SEDE,GRADO,GRUPO,ASIGNATURA_NOMBRE,PERIODO_NUM,"
            "COMPONENTE_NOMBRE,SEGMENTO_NOMBRE,ACTIVIDAD_NOMBRE,ACTIVIDAD_FECHA,NOTA\n"
            f"{self.student.document_number},{self.inst.dane_code},{self.ay.year},"
            f"{self.campus.name},SEXTO,601,Matemáticas,1,Cognitivo,Evaluaciones,"
            f"Quiz 1,{quiz1.activity_date},4.50\n"
        )
        stats = bulk_load_student_activity_scores(csv_create)
        self.assertEqual(stats["rows_processed"], 1)
        self.assertEqual(stats["created"], 1)
        score = StudentActivityScore.objects.get(activity=quiz1, student=self.student)
        self.assertEqual(score.score, Decimal("4.50"))

        csv_update = self._csv_bytes(
            "DOC_ESTUDIANTE,DANE_COD,ANO,SEDE,GRADO,GRUPO,ASIGNATURA_NOMBRE,PERIODO_NUM,"
            "COMPONENTE_NOMBRE,SEGMENTO_NOMBRE,ACTIVIDAD_NOMBRE,ACTIVIDAD_FECHA,NOTA\n"
            f"{self.student.document_number},{self.inst.dane_code},{self.ay.year},"
            f"{self.campus.name},SEXTO,601,Matemáticas,1,Cognitivo,Evaluaciones,"
            f"Quiz 1,{quiz1.activity_date},4.80\n"
        )
        stats2 = bulk_load_student_activity_scores(csv_update)
        self.assertEqual(stats2["updated"], 1)
        score.refresh_from_db()
        self.assertEqual(score.score, Decimal("4.80"))

    def test_bulk_load_student_activity_scores_does_not_modify_grade(self):
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
            numerical_grade=Decimal("3.00"),
            definitive_grade=Decimal("3.50"),
        )
        csv = self._csv_bytes(
            "DOC_ESTUDIANTE,DANE_COD,ANO,SEDE,GRADO,GRUPO,ASIGNATURA_NOMBRE,PERIODO_NUM,"
            "COMPONENTE_NOMBRE,SEGMENTO_NOMBRE,ACTIVIDAD_NOMBRE,ACTIVIDAD_FECHA,NOTA\n"
            f"{self.student.document_number},{self.inst.dane_code},{self.ay.year},"
            f"{self.campus.name},SEXTO,601,Matemáticas,1,Cognitivo,Evaluaciones,"
            f"Quiz 1,{quiz1.activity_date},5.00\n"
        )
        bulk_load_student_activity_scores(csv)
        grade = Grade.objects.get(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.period,
        )
        self.assertEqual(grade.numerical_grade, Decimal("3.00"))
        self.assertEqual(grade.definitive_grade, Decimal("3.50"))

    def test_bulk_load_student_activity_scores_api(self):
        scheme, quiz1, _, _, _ = self._build_valid_scheme()
        csv_body = (
            "DOC_ESTUDIANTE,DANE_COD,ANO,SEDE,GRADO,GRUPO,ASIGNATURA_NOMBRE,PERIODO_NUM,"
            "COMPONENTE_NOMBRE,SEGMENTO_NOMBRE,ACTIVIDAD_NOMBRE,ACTIVIDAD_FECHA,NOTA\n"
            f"{self.student.document_number},{self.inst.dane_code},{self.ay.year},"
            f"{self.campus.name},SEXTO,601,Matemáticas,1,Cognitivo,Evaluaciones,"
            f"Quiz 1,{quiz1.activity_date},4.20\n"
        )
        url = reverse("studentactivityscore-bulk-load")
        upload = io.BytesIO(csv_body.encode("utf-8-sig"))
        upload.name = "scores.csv"
        r = self.client.post(
            url,
            {"file": upload},
            format="multipart",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["created"], 1)
