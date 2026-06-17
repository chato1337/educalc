from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from django.test import TestCase

from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicIndicatorCatalog,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    Enrollment,
    GradeLevel,
    GradingScale,
    Group,
    Institution,
    Student,
    Subject,
    Teacher,
    UserProfile,
)


class AcademicIndicatorCatalogApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_user(
            username="catadmin", password="x"
        )
        profile = UserProfile.objects.get(user=self.admin)
        profile.role = "ADMIN"
        profile.save(update_fields=["role"])
        self.admin = get_user_model().objects.select_related("profile").get(
            pk=self.admin.pk
        )
        self.client.force_authenticate(user=self.admin)

        self.inst = Institution.objects.create(name="IE Cat API", dane_code="DANE990020")
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.generic = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="Gen bajo",
            achievement_basic_or_above="Gen básico+",
        )
        self.p1 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="P1 bajo",
            achievement_basic_or_above="P1 básico+",
        )
        self.list_url = reverse("academicindicatorcatalog-list")

    def _list_params(self, **extra):
        return {
            "academic_area__institution": str(self.inst.id),
            "grade_level__institution": str(self.inst.id),
            "limit": 50,
            **extra,
        }

    def test_list_includes_period_fields(self):
        r = self.client.get(self.list_url, self._list_params())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        by_id = {row["id"]: row for row in r.data["results"]}
        self.assertEqual(by_id[str(self.p1.id)]["period_number"], 1)
        self.assertEqual(by_id[str(self.p1.id)]["period_label"], "P1")
        self.assertIsNone(by_id[str(self.generic.id)]["period_number"])
        self.assertEqual(by_id[str(self.generic.id)]["period_label"], "Todos")

    def test_filter_by_period_number(self):
        r = self.client.get(
            self.list_url,
            self._list_params(period_number=1),
        )
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.p1.id)})

    def test_create_period_specific_catalog(self):
        r = self.client.post(
            self.list_url,
            {
                "academic_area": str(self.area.id),
                "grade_level": str(self.gl.id),
                "period_number": 2,
                "achievement_below_basic": "Nuevo bajo",
                "achievement_basic_or_above": "Nuevo básico+",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["period_number"], 2)
        self.assertEqual(r.data["period_label"], "P2")

    def test_create_rejects_invalid_period_number(self):
        r = self.client.post(
            self.list_url,
            {
                "academic_area": str(self.area.id),
                "grade_level": str(self.gl.id),
                "period_number": 5,
                "achievement_below_basic": "x",
                "achievement_basic_or_above": "y",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("period_number", r.data)

    def test_create_rejects_duplicate_area_grade_period(self):
        r = self.client.post(
            self.list_url,
            {
                "academic_area": str(self.area.id),
                "grade_level": str(self.gl.id),
                "period_number": 1,
                "achievement_below_basic": "dup bajo",
                "achievement_basic_or_above": "dup básico+",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_ordering_by_period_number(self):
        AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=3,
            achievement_below_basic="P3 bajo",
            achievement_basic_or_above="P3 básico+",
        )
        r = self.client.get(
            self.list_url,
            self._list_params(ordering="period_number"),
        )
        self.assertEqual(r.status_code, 200)
        period_numbers = [
            row["period_number"] for row in r.data["results"] if row["period_number"]
        ]
        self.assertEqual(period_numbers, [1, 3])


class AcademicIndicatorApiPeriodValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_user(
            username="indadmin", password="x"
        )
        profile = UserProfile.objects.get(user=self.admin)
        profile.role = "ADMIN"
        profile.save(update_fields=["role"])
        self.admin = get_user_model().objects.select_related("profile").get(
            pk=self.admin.pk
        )
        self.client.force_authenticate(user=self.admin)

        self.inst = Institution.objects.create(name="IE Ind API", dane_code="DANE990021")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede")
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
        self.p1 = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.p2 = AcademicPeriod.objects.create(
            academic_year=self.ay, number=2, name="P2"
        )
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.teacher = Teacher.objects.create(
            document_number="T900",
            first_name="Ana",
            first_last_name="Doc",
            full_name="Ana Doc",
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
        self.student = Student.objects.create(
            document_number="S900",
            first_name="Luis",
            first_last_name="Est",
            full_name="Luis Est",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.ay,
            status="active",
        )
        GradingScale.objects.create(
            institution=self.inst,
            code="BS",
            name="Básico",
            min_score=Decimal("3.00"),
            max_score=Decimal("3.99"),
        )
        GradingScale.objects.create(
            institution=self.inst,
            code="BJ",
            name="Bajo",
            min_score=Decimal("0.00"),
            max_score=Decimal("2.99"),
        )
        self.catalog_p1 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="P1 bajo",
            achievement_basic_or_above="P1 básico+",
        )
        self.catalog_p2 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=2,
            achievement_below_basic="P2 bajo",
            achievement_basic_or_above="P2 básico+",
        )
        self.catalog_generic = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="Gen bajo",
            achievement_basic_or_above="Gen básico+",
        )
        self.list_url = reverse("academicindicator-list")

    def test_create_accepts_matching_period_catalog(self):
        r = self.client.post(
            self.list_url,
            {
                "student": str(self.student.id),
                "course_assignment": str(self.ca.id),
                "academic_period": str(self.p1.id),
                "catalog": str(self.catalog_p1.id),
                "numerical_grade": "4.00",
                "description": "",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["description"], "P1 básico+")
        self.assertIn("P1", r.data["catalog_label"])

    def test_create_accepts_generic_catalog_for_any_period(self):
        r = self.client.post(
            self.list_url,
            {
                "student": str(self.student.id),
                "course_assignment": str(self.ca.id),
                "academic_period": str(self.p2.id),
                "catalog": str(self.catalog_generic.id),
                "numerical_grade": "4.00",
                "description": "",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["description"], "Gen básico+")

    def test_create_rejects_catalog_period_mismatch(self):
        r = self.client.post(
            self.list_url,
            {
                "student": str(self.student.id),
                "course_assignment": str(self.ca.id),
                "academic_period": str(self.p2.id),
                "catalog": str(self.catalog_p1.id),
                "numerical_grade": "4.00",
                "description": "",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("catalog", r.data)

    def test_update_rejects_catalog_period_mismatch(self):
        indicator = AcademicIndicator.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p1,
            catalog=self.catalog_p1,
            outcome="basic_or_above",
            description="P1 básico+",
            numerical_grade=Decimal("4.00"),
        )
        url = reverse("academicindicator-detail", kwargs={"pk": indicator.id})
        r = self.client.patch(
            url,
            {"academic_period": str(self.p2.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("catalog", r.data)
