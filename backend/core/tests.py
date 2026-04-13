from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
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
