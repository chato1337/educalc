from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import (
    AcademicArea,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    Enrollment,
    Grade,
    GradeLevel,
    Group,
    Institution,
    PerformanceSummary,
    Student,
    Subject,
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
        self.client.force_authenticate(user=user)

        self.inst = Institution.objects.create(name="IE API", dane_code="DANE990002")
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
        self.client.force_authenticate(user=user)

        self.inst = Institution.objects.create(name="IE Full", dane_code="DANE990010")
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
        self.client.force_authenticate(user=user)
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
        self.assertEqual(r.data["count"], 3)


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
