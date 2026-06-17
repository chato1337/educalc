import io
from decimal import Decimal

from django.test import TestCase

from .bulk_load_extended import bulk_load_academic_indicators
from .bulletin_service import build_bulletin_context
from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicIndicatorCatalog,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    Enrollment,
    Grade,
    GradeLevel,
    GradingScale,
    Group,
    Institution,
    Student,
    Subject,
    Teacher,
)


class BulkLoadIndicatorCatalogPeriodTests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name="IE Bulk Cat", dane_code="DANE990030")
        self.area = AcademicArea.objects.create(
            institution=self.inst, name="Matemáticas"
        )
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )

    def _csv_bytes(self, body: str) -> io.BytesIO:
        buf = io.BytesIO(body.encode("utf-8-sig"))
        buf.name = "catalog.csv"
        return buf

    def test_catalog_template_upsert_by_period(self):
        header = (
            "DANE_COD,AREA_ACADEMICA,GRADO,PERIODO_NUM,LOGRO_POSITIVO,LOGRO_NEGATIVO\n"
        )
        row1 = (
            f"{self.inst.dane_code},Matemáticas,6,1,"
            "Logro P1 positivo,Logro P1 negativo\n"
        )
        row2 = (
            f"{self.inst.dane_code},Matemáticas,6,2,"
            "Logro P2 positivo,Logro P2 negativo\n"
        )
        stats = bulk_load_academic_indicators(self._csv_bytes(header + row1 + row2))
        self.assertEqual(stats["created"], 2)
        p1 = AcademicIndicatorCatalog.objects.get(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
        )
        p2 = AcademicIndicatorCatalog.objects.get(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=2,
        )
        self.assertEqual(p1.achievement_basic_or_above, "Logro P1 positivo")
        self.assertEqual(p2.achievement_basic_or_above, "Logro P2 positivo")

        row1_update = (
            f"{self.inst.dane_code},Matemáticas,6,1,"
            "Logro P1 actualizado,Logro P1 negativo nuevo\n"
        )
        stats2 = bulk_load_academic_indicators(self._csv_bytes(header + row1_update))
        self.assertEqual(stats2["updated"], 1)
        p1.refresh_from_db()
        self.assertEqual(p1.achievement_basic_or_above, "Logro P1 actualizado")

    def test_catalog_template_without_period_is_generic(self):
        header = "DANE_COD,AREA_ACADEMICA,GRADO,LOGRO_POSITIVO,LOGRO_NEGATIVO\n"
        row = f"{self.inst.dane_code},Matemáticas,6,Gen positivo,Gen negativo\n"
        bulk_load_academic_indicators(self._csv_bytes(header + row))
        generic = AcademicIndicatorCatalog.objects.get(
            academic_area=self.area,
            grade_level=self.gl,
            period_number__isnull=True,
        )
        self.assertEqual(generic.achievement_basic_or_above, "Gen positivo")


class BulkLoadStudentIndicatorPeriodTests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name="IE Bulk Ind", dane_code="DANE990031")
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
            document_number="TB31",
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
            document_number="SB31",
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
            code="AL",
            name="Alto",
            min_score=Decimal("4.00"),
            max_score=Decimal("4.59"),
        )
        AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="P1 bajo",
            achievement_basic_or_above="P1 básico+",
        )
        AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=2,
            achievement_below_basic="P2 bajo",
            achievement_basic_or_above="P2 básico+",
        )

    def _csv_bytes(self, body: str) -> io.BytesIO:
        buf = io.BytesIO(body.encode("utf-8-sig"))
        buf.name = "indicators.csv"
        return buf

    def test_student_row_uses_period_specific_catalog(self):
        header = (
            "DOC_ESTUDIANTE,DANE_COD,ANO,SEDE,GRADO,GRUPO,ASIGNATURA_NOMBRE,"
            "PERIODO_NUM,DESCRIPCION,NOTA\n"
        )
        row_p2 = (
            f"{self.student.document_number},{self.inst.dane_code},{self.ay.year},"
            f"{self.campus.name},SEXTO,601,Matemáticas,2,placeholder,4.20\n"
        )
        stats = bulk_load_academic_indicators(self._csv_bytes(header + row_p2))
        self.assertEqual(stats["created"], 1)
        indicator = AcademicIndicator.objects.get(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p2,
        )
        self.assertEqual(indicator.description, "P2 básico+")
        self.assertEqual(indicator.catalog.period_number, 2)


class BulletinIndicatorPeriodTests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name="IE Bulletin", dane_code="DANE990032")
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
            document_number="TB32",
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
            document_number="SB32",
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
            code="AL",
            name="Alto",
            min_score=Decimal("4.00"),
            max_score=Decimal("4.59"),
        )
        self.catalog_p1 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=1,
            achievement_below_basic="Cat P1 bajo",
            achievement_basic_or_above="Cat P1 básico+",
        )
        self.catalog_p2 = AcademicIndicatorCatalog.objects.create(
            academic_area=self.area,
            grade_level=self.gl,
            period_number=2,
            achievement_below_basic="Cat P2 bajo",
            achievement_basic_or_above="Cat P2 básico+",
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p1,
            numerical_grade=Decimal("4.10"),
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p2,
            numerical_grade=Decimal("4.30"),
        )

    def test_bulletin_catalog_fallback_uses_selected_period(self):
        ctx_p1 = build_bulletin_context(
            student=self.student,
            academic_year=self.ay,
            period_ids=[self.p1.id],
        )
        ctx_p2 = build_bulletin_context(
            student=self.student,
            academic_year=self.ay,
            period_ids=[self.p2.id],
        )
        self.assertEqual(ctx_p1["indicators"][0]["description"], "Cat P1 básico+")
        self.assertEqual(ctx_p2["indicators"][0]["description"], "Cat P2 básico+")

    def test_bulletin_uses_stored_indicator_for_matching_period(self):
        AcademicIndicator.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p1,
            description="Indicador guardado P1",
            numerical_grade=Decimal("4.10"),
        )
        AcademicIndicator.objects.create(
            student=self.student,
            course_assignment=self.ca,
            academic_period=self.p2,
            description="Indicador guardado P2",
            numerical_grade=Decimal("4.30"),
        )
        ctx_p1 = build_bulletin_context(
            student=self.student,
            academic_year=self.ay,
            period_ids=[self.p1.id],
        )
        self.assertEqual(ctx_p1["indicators"][0]["description"], "Indicador guardado P1")
