"""Year-end congratulations on the bulletin.

The box appears only when the printed periods include the closing period of the
year (highest ``number``, not a fixed 4) and every subject definitive reaches
Básico. The destination grade is the next ``level_order`` in the institution.
"""
from decimal import Decimal

from django.test import TestCase

from core.bulletin_service import build_bulletin_context, render_bulletin_html
from core.models import (
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
    Student,
    Subject,
    Teacher,
)


class BulletinPromotionTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name="IE Carrizales",
            dane_code="DANE-PROMO-1",
        )
        campus = Campus.objects.create(institution=self.institution, name="Sede")
        self.year = AcademicYear.objects.create(
            institution=self.institution, year=2024
        )
        self.p1 = AcademicPeriod.objects.create(
            academic_year=self.year, number=1, name="P1"
        )
        self.p2 = AcademicPeriod.objects.create(
            academic_year=self.year, number=2, name="P2"
        )
        self.p3 = AcademicPeriod.objects.create(
            academic_year=self.year, number=3, name="P3"
        )
        self.quinto = GradeLevel.objects.create(
            institution=self.institution, name="Quinto", level_order=5
        )
        self.sexto = GradeLevel.objects.create(
            institution=self.institution, name="Sexto", level_order=6
        )
        self.group = Group.objects.create(
            grade_level=self.quinto,
            academic_year=self.year,
            campus=campus,
            name="501",
        )
        area = AcademicArea.objects.create(
            institution=self.institution, name="Lengua"
        )
        teacher = Teacher.objects.create(
            document_number="PROMO1",
            first_name="Luz",
            first_last_name="Gómez",
            full_name="Luz Gómez",
        )
        subject = Subject.objects.create(
            academic_area=area,
            institution=self.institution,
            name="Castellano",
        )
        self.assignment = CourseAssignment.objects.create(
            subject=subject,
            teacher=teacher,
            group=self.group,
            academic_year=self.year,
        )
        self.student = Student.objects.create(
            first_name="Juan",
            first_last_name="Atillo",
            full_name="Atillo Juan",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.year,
            status="active",
        )

    def _grade(self, period, value, assignment=None):
        Grade.objects.create(
            student=self.student,
            course_assignment=assignment or self.assignment,
            academic_period=period,
            numerical_grade=Decimal(value),
        )

    def _context(self, period_ids=None):
        return build_bulletin_context(
            student=self.student,
            academic_year=self.year,
            period_ids=period_ids,
        )

    def test_promoted_on_closing_period_even_when_it_is_not_period_four(self):
        for period in (self.p1, self.p2, self.p3):
            self._grade(period, "4.00")

        context = self._context()

        self.assertEqual(context["promotion"], {"next_grade": "SEXTO"})
        html = render_bulletin_html(context)
        self.assertIn("...FELICITACIONES...", html)
        self.assertIn("Has sido promovido al grado:", html)
        self.assertIn("SEXTO", html)

    def test_box_stays_hidden_when_the_closing_period_is_not_printed(self):
        for period in (self.p1, self.p2, self.p3):
            self._grade(period, "4.00")

        context = self._context(period_ids=[self.p1.id, self.p2.id])

        self.assertIsNone(context["promotion"])
        self.assertNotIn("FELICITACIONES", render_bulletin_html(context))

    def test_printing_only_the_last_period_still_uses_the_whole_year(self):
        self._grade(self.p1, "2.00")
        self._grade(self.p2, "4.00")
        self._grade(self.p3, "4.50")

        context = self._context(period_ids=[self.p3.id])

        self.assertIsNone(context["promotion"])

    def test_recovered_loss_promotes_to_the_next_level_order(self):
        self._grade(self.p1, "2.50")
        grade = Grade.objects.get(student=self.student, academic_period=self.p1)
        grade.definitive_grade = Decimal("3.00")
        grade.save(update_fields=["definitive_grade"])
        self._grade(self.p2, "3.50")
        self._grade(self.p3, "3.20")

        context = self._context(period_ids=[self.p3.id])

        self.assertEqual(context["promotion"]["next_grade"], "SEXTO")

    def test_no_box_without_a_following_grade(self):
        once = GradeLevel.objects.create(
            institution=self.institution, name="Once", level_order=11
        )
        self.group.grade_level = once
        self.group.save(update_fields=["grade_level"])
        for period in (self.p1, self.p2, self.p3):
            self._grade(period, "4.00")

        self.assertIsNone(self._context()["promotion"])
