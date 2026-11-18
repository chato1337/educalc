"""Year promotion and the student certificate."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.certificate_service import build_certificate_context, render_certificate_html
from core.models import (
    AcademicArea,
    AcademicPeriod,
    AcademicYear,
    Attendance,
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
    UserProfile,
)


class CertificatePromotionTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name="Institución Educativa Agropecuaria Carrizales",
            dane_code="DANE219212",
            nit="817006134-1",
            legal_reference="Reconocimiento Oficial de Estudios: 0453 del 26 abril de 2004",
            certificate_subtitle="Colegio Rural Agropecuario Carrizales",
            certificate_authorization=(
                "Los suscritos Rector y Secretario de la Institución Educativa "
                "Agropecuaria Carrizales, municipio de Corinto, departamento del "
                "Cauca, autorizada a partir del año 2004 en los estudios "
                "correspondientes a los grados 6°, 7°, 8° y 9° del nivel de "
                "Educación Básica y los grados 10° y 11° del nivel de educación "
                "Media Técnica, Modalidad Agropecuaria. Institución de carácter "
                "mixto, calendario A, Jornada única, propiedad del Dpto."
            ),
            rector_name="Juan Fernando Campo Rivera",
            rector_document_number="10.633.384",
            secretary_name="Noraldo Taquinas Cuetia",
            secretary_document_number="10.634.987",
        )
        for code, name, low, high in (
            ("BJ", "Bajo", "0.00", "2.99"),
            ("BS", "Básico", "3.00", "3.99"),
            ("AL", "Alto", "4.00", "4.59"),
            ("SP", "Superior", "4.60", "5.00"),
        ):
            GradingScale.objects.create(
                institution=self.institution,
                code=code,
                name=name,
                min_score=Decimal(low),
                max_score=Decimal(high),
            )
        self.campus = Campus.objects.create(
            institution=self.institution,
            name="Sede Carrizales",
            locality="Carrizales",
            municipality="Corinto",
            department="Cauca",
        )
        self.year = AcademicYear.objects.create(
            institution=self.institution, year=2024
        )
        self.period_one = AcademicPeriod.objects.create(
            academic_year=self.year, number=1, name="P1"
        )
        self.period_two = AcademicPeriod.objects.create(
            academic_year=self.year, number=2, name="P2"
        )
        level = GradeLevel.objects.create(
            institution=self.institution, name="Quinto", level_order=5
        )
        self.group = Group.objects.create(
            grade_level=level,
            academic_year=self.year,
            campus=self.campus,
            name="501",
        )
        self.area = AcademicArea.objects.create(
            institution=self.institution, name="Bienestar y Cultura"
        )
        teacher = Teacher.objects.create(
            document_number="CERT1",
            first_name="Ana",
            first_last_name="Paz",
            full_name="Ana Paz",
        )
        subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.institution,
            name="Bienestar",
            emphasis="Educación",
        )
        self.assignment = CourseAssignment.objects.create(
            subject=subject,
            teacher=teacher,
            group=self.group,
            academic_year=self.year,
        )
        self.student = Student.objects.create(
            document_type="TI",
            document_number="1059845776",
            first_name="Juan Pablo",
            first_last_name="Atillo",
            second_last_name="Campo",
            full_name="Atillo Campo Juan Pablo",
        )
        Enrollment.objects.create(
            student=self.student,
            group=self.group,
            academic_year=self.year,
            status="active",
        )
        self.grade_one = Grade.objects.create(
            student=self.student,
            course_assignment=self.assignment,
            academic_period=self.period_one,
            numerical_grade=Decimal("2.50"),
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=self.assignment,
            academic_period=self.period_two,
            numerical_grade=Decimal("4.00"),
        )

    def _context(self, **kwargs):
        return build_certificate_context(
            student=self.student,
            academic_year=self.year,
            issued_on=kwargs.pop("issued_on", date(2026, 11, 17)),
            **kwargs,
        )

    def test_unrecovered_loss_fails_the_year(self):
        context = self._context()
        self.assertEqual(context["subject_definitives"], ["2.90"])
        self.assertFalse(context["passed_year"])
        self.assertEqual(context["area_rows"][0]["performance"], "BAJO(2.90)")
        self.assertEqual(
            context["area_rows"][0]["emphasis_line"], "Énfasis en Educación"
        )
        self.assertIn("cursó y no aprobó", context["student_paragraph"])
        self.assertIn("no aprobó promover", context["promotion_paragraph"])
        self.assertIn("tarjeta de identidad número 1059845776", context["student_paragraph"])
        self.assertIn(
            "la vereda Carrizales del municipio de Corinto Cauca",
            context["place_clause"],
        )
        self.assertEqual(context["issued_on_text"], "17 de Noviembre de 2026")
        self.assertEqual(context["rector_name"], "Juan Fernando Campo Rivera")
        self.assertIn(
            "Los suscritos Rector y Secretario",
            context["certificate_authorization"],
        )
        html = render_certificate_html(context)
        self.assertLess(
            html.index("Los suscritos Rector y Secretario"),
            html.index("CERTIFICAN"),
        )

    def test_recovery_to_basico_passes_the_year(self):
        self.grade_one.definitive_grade = Decimal("3.00")
        self.grade_one.save(update_fields=["definitive_grade"])

        context = self._context()
        self.assertEqual(context["subject_definitives"], ["3.50"])
        self.assertTrue(context["passed_year"])
        self.assertEqual(context["area_rows"][0]["performance"], "BASICO(3.50)")
        self.assertIn("cursó y aprobó", context["student_paragraph"])
        self.assertNotIn("no aprobó", context["student_paragraph"])
        self.assertIn("aprobó promover", context["promotion_paragraph"])
        self.assertNotIn("no aprobó promover", context["promotion_paragraph"])

    def test_one_lost_subject_fails_the_year(self):
        self.grade_one.definitive_grade = Decimal("3.00")
        self.grade_one.save(update_fields=["definitive_grade"])
        other_area = AcademicArea.objects.create(
            institution=self.institution, name="Pensamiento Matemático"
        )
        other_subject = Subject.objects.create(
            academic_area=other_area,
            institution=self.institution,
            name="Matemáticas",
            emphasis="Cálculo",
        )
        other_assignment = CourseAssignment.objects.create(
            subject=other_subject,
            teacher=self.assignment.teacher,
            group=self.group,
            academic_year=self.year,
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=other_assignment,
            academic_period=self.period_one,
            numerical_grade=Decimal("2.00"),
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=other_assignment,
            academic_period=self.period_two,
            numerical_grade=Decimal("2.40"),
        )

        context = self._context()
        self.assertEqual(context["subject_definitives"], ["3.50", "2.20"])
        self.assertFalse(context["passed_year"])
        self.assertEqual(len(context["area_rows"]), 2)
        self.assertEqual(context["area_rows"][1]["performance"], "BAJO(2.20)")

    def test_subjects_in_one_area_use_the_official_average(self):
        self.grade_one.numerical_grade = Decimal("3.20")
        self.grade_one.save(update_fields=["numerical_grade"])
        Grade.objects.filter(
            student=self.student, academic_period=self.period_two
        ).update(numerical_grade=Decimal("3.80"))
        sibling = Subject.objects.create(
            academic_area=self.area,
            institution=self.institution,
            name="Cultura",
            emphasis="Arte",
        )
        sibling_assignment = CourseAssignment.objects.create(
            subject=sibling,
            teacher=self.assignment.teacher,
            group=self.group,
            academic_year=self.year,
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=sibling_assignment,
            academic_period=self.period_one,
            numerical_grade=Decimal("4.00"),
        )
        Grade.objects.create(
            student=self.student,
            course_assignment=sibling_assignment,
            academic_period=self.period_two,
            numerical_grade=Decimal("4.00"),
        )

        context = self._context()
        self.assertTrue(context["passed_year"])
        self.assertEqual(len(context["area_rows"]), 1)
        # (3.50 + 4.00) / 2 = 3.75
        self.assertEqual(context["area_rows"][0]["performance"], "BASICO(3.75)")
        self.assertEqual(
            context["area_rows"][0]["emphasis_line"], "Énfasis en Educación, Arte"
        )

    def test_absences_prefer_the_group_roll_call(self):
        Attendance.objects.create(
            student=self.student,
            group=self.group,
            academic_period=self.period_one,
            unexcused_absences=2,
            excused_absences=1,
        )
        Attendance.objects.create(
            student=self.student,
            course_assignment=self.assignment,
            group=self.group,
            academic_period=self.period_one,
            unexcused_absences=9,
            excused_absences=0,
        )
        context = self._context()
        self.assertEqual(context["absence_total"], 3)

    def test_pdf_download_for_a_passing_student(self):
        self.grade_one.definitive_grade = Decimal("3.00")
        self.grade_one.save(update_fields=["definitive_grade"])
        user = get_user_model().objects.create_user(
            username="cert-admin", password="secret", is_superuser=True
        )
        UserProfile.objects.filter(user=user).update(role="ADMIN")
        self.client.force_authenticate(user=user)

        response = self.client.get(
            "/api/academic-grades/certificate/",
            {
                "student": str(self.student.id),
                "academic_year": str(self.year.id),
                "issued_on": "2026-11-17",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("certificado_", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_invalid_issued_on_is_rejected(self):
        user = get_user_model().objects.create_user(
            username="cert-admin-2", password="secret", is_superuser=True
        )
        UserProfile.objects.filter(user=user).update(role="ADMIN")
        self.client.force_authenticate(user=user)
        response = self.client.get(
            "/api/academic-grades/certificate/",
            {
                "student": str(self.student.id),
                "academic_year": str(self.year.id),
                "issued_on": "17/11/2026",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
