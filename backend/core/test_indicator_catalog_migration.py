from importlib import import_module

from django.apps import apps
from django.test import TestCase

from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicIndicatorCatalog,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    GradeLevel,
    Group,
    Institution,
    Student,
    Subject,
    Teacher,
)

_migration = import_module("core.migrations.0013_migrate_indicator_catalogs_to_p1")
migrate_generic_catalogs_to_period_1 = _migration.migrate_generic_catalogs_to_period_1


class MigrateIndicatorCatalogsToP1Tests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name="IE Mig", dane_code="DANE990040")
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )

    def test_migrate_sets_period_1_when_no_conflict(self):
        generic = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="bajo",
            achievement_basic_or_above="basico+",
        )
        migrate_generic_catalogs_to_period_1(apps, None)
        generic.refresh_from_db()
        self.assertEqual(generic.period_number, 1)

    def test_migrate_reassigns_indicators_when_p1_exists(self):
        generic = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            achievement_below_basic="gen bajo",
            achievement_basic_or_above="gen basico+",
        )
        p1 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="p1 bajo",
            achievement_basic_or_above="p1 basico+",
        )
        student = Student.objects.create(
            document_number="MIG1",
            first_name="A",
            first_last_name="B",
            full_name="A B",
        )
        campus = Campus.objects.create(institution=self.inst, name="Sede")
        ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        group = Group.objects.create(
            grade_level=self.gl, academic_year=ay, campus=campus, name="601"
        )
        period = AcademicPeriod.objects.create(academic_year=ay, number=1, name="P1")
        teacher = Teacher.objects.create(
            document_number="T1",
            first_name="T",
            first_last_name="D",
            full_name="T D",
        )
        subject = Subject.objects.create(
            academic_area=self.area, institution=self.inst, name="Mat"
        )
        ca = CourseAssignment.objects.create(
            subject=subject, teacher=teacher, group=group, academic_year=ay
        )
        indicator = AcademicIndicator.objects.create(
            student=student,
            course_assignment=ca,
            academic_period=period,
            catalog=generic,
            description="texto",
        )
        migrate_generic_catalogs_to_period_1(apps, None)
        self.assertFalse(
            AcademicIndicatorCatalog.objects.filter(id=generic.id).exists()
        )
        indicator.refresh_from_db()
        self.assertEqual(indicator.catalog_id, p1.id)
