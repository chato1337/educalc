from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from .indicator_utils import resolve_indicator_catalog
from .models import AcademicArea, AcademicIndicatorCatalog, GradeLevel, Institution


class ResolveIndicatorCatalogTests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name="IE Test", dane_code="DANE990010")
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.generic = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="Genérico bajo",
            achievement_basic_or_above="Genérico básico+",
        )
        self.p1 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="P1 bajo",
            achievement_basic_or_above="P1 básico+",
        )
        self.p2 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=2,
            achievement_below_basic="P2 bajo",
            achievement_basic_or_above="P2 básico+",
        )

    def test_returns_period_specific_catalog(self):
        cat = resolve_indicator_catalog(self.area, self.gl, 1)
        self.assertEqual(cat.id, self.p1.id)

    def test_falls_back_to_generic_when_period_missing(self):
        cat = resolve_indicator_catalog(self.area, self.gl, 3)
        self.assertEqual(cat.id, self.generic.id)

    def test_returns_none_when_no_match(self):
        other_area = AcademicArea.objects.create(
            institution=self.inst, name="Lenguaje"
        )
        self.assertIsNone(resolve_indicator_catalog(other_area, self.gl, 1))

    def test_accepts_ids_instead_of_instances(self):
        cat = resolve_indicator_catalog(self.area.id, self.gl.id, 2)
        self.assertEqual(cat.id, self.p2.id)


class AcademicIndicatorCatalogPeriodModelTests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name="IE Test", dane_code="DANE990011")
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )

    def test_clean_rejects_invalid_period_number(self):
        catalog = AcademicIndicatorCatalog(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=5,
            achievement_below_basic="x",
            achievement_basic_or_above="y",
        )
        with self.assertRaises(ValidationError):
            catalog.full_clean()

    def test_unique_period_specific_per_area_grade(self):
        AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="a",
            achievement_basic_or_above="b",
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AcademicIndicatorCatalog.objects.create(
                    academic_area=self.area,
                    grade_level=self.gl,
                    period_number=1,
                    achievement_below_basic="c",
                    achievement_basic_or_above="d",
                )

    def test_unique_generic_per_area_grade(self):
        AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="a",
            achievement_basic_or_above="b",
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AcademicIndicatorCatalog.objects.create(
                    academic_area=self.area,
                    grade_level=self.gl,
                    achievement_below_basic="c",
                    achievement_basic_or_above="d",
                )

    def test_generic_and_period_specific_can_coexist(self):
        generic = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="gen bajo",
            achievement_basic_or_above="gen básico+",
        )
        specific = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="p1 bajo",
            achievement_basic_or_above="p1 básico+",
        )
        self.assertEqual(
            resolve_indicator_catalog(self.area, self.gl, 1).id,
            specific.id,
        )
        self.assertEqual(
            resolve_indicator_catalog(self.area, self.gl, 4).id,
            generic.id,
        )

    def test_str_includes_period_when_set(self):
        catalog = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=2,
            achievement_below_basic="a",
            achievement_basic_or_above="b",
        )
        self.assertIn("P2", str(catalog))
