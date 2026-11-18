"""GET /api/reports/failing-students/ — students who do not pass the year."""
import csv
import io
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from core.certificate_service import build_certificate_context
from core.models import (
    AcademicArea,
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
    UserProfile,
)


class FailingStudentsCsvExportApiTests(APITestCase):
    def setUp(self):
        self.admin_user = get_user_model().objects.create_user(username="failadmin", password="x")
        self.coord_user = get_user_model().objects.create_user(username="failcoord", password="x")
        self.teacher_user = get_user_model().objects.create_user(username="failteach", password="x")

        UserProfile.objects.filter(user=self.admin_user).update(role="ADMIN")
        UserProfile.objects.filter(user=self.coord_user).update(role="COORDINATOR")
        UserProfile.objects.filter(user=self.teacher_user).update(role="TEACHER")

        self.inst = Institution.objects.create(name="IE Reprobados", dane_code="DANE995500")
        for code, name, low, high in (
            ("BJ", "Bajo", "0.00", "2.99"),
            ("BS", "Básico", "3.00", "3.99"),
        ):
            GradingScale.objects.create(
                institution=self.inst,
                code=code,
                name=name,
                min_score=Decimal(low),
                max_score=Decimal(high),
            )
        self.campus = Campus.objects.create(institution=self.inst, name="Sede Norte")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.gl = GradeLevel.objects.create(institution=self.inst, name="QUINTO", level_order=5)
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
            document_number="TDOC600",
            first_name="Profe",
            first_last_name="CSV",
            full_name="Profe CSV",
        )
        self.lengua = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Lengua",
        )
        self.ciencias = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Ciencias",
        )
        self.ca_lengua = CourseAssignment.objects.create(
            subject=self.lengua,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )
        self.ca_ciencias = CourseAssignment.objects.create(
            subject=self.ciencias,
            teacher=self.teacher,
            group=self.group,
            academic_year=self.ay,
        )

        self.ana = self._student("ST600", "Ana", "Pierde", "Ana Pierde")
        self.bea = self._student("ST601", "Bea", "Aprueba", "Bea Aprueba")
        self._enroll(self.ana)
        self._enroll(self.bea)
        # Ana loses Lengua (2.50 unrecovered + 4.00 → Def 2.90) and passes Ciencias.
        self._grade(self.ana, self.ca_lengua, self.p1, "2.50")
        self._grade(self.ana, self.ca_lengua, self.p2, "4.00")
        self._grade(self.ana, self.ca_ciencias, self.p1, "4.00")
        self._grade(self.ana, self.ca_ciencias, self.p2, "4.00")
        # Bea reaches Básico in both subjects.
        self._grade(self.bea, self.ca_lengua, self.p1, "3.20")
        self._grade(self.bea, self.ca_lengua, self.p2, "4.00")
        self._grade(self.bea, self.ca_ciencias, self.p1, "3.50")
        self._grade(self.bea, self.ca_ciencias, self.p2, "3.80")

        UserProfile.objects.filter(user=self.coord_user).update(institution_id=self.inst.id)
        User = get_user_model()
        self.admin_user = User.objects.select_related("profile").get(pk=self.admin_user.pk)
        self.coord_user = User.objects.select_related("profile").get(pk=self.coord_user.pk)
        self.teacher_user = User.objects.select_related("profile").get(pk=self.teacher_user.pk)
        self.url = reverse("report-failing-students-csv")

    def _student(self, document, first, last, full):
        return Student.objects.create(
            document_number=document,
            first_name=first,
            first_last_name=last,
            full_name=full,
        )

    def _enroll(self, student, group=None, status="active"):
        return Enrollment.objects.create(
            student=student,
            group=group or self.group,
            academic_year=self.ay,
            status=status,
        )

    def _grade(self, student, assignment, period, numerical, definitive=None):
        return Grade.objects.create(
            student=student,
            course_assignment=assignment,
            academic_period=period,
            numerical_grade=Decimal(numerical),
            definitive_grade=Decimal(definitive) if definitive is not None else None,
        )

    def _rows(self, response):
        self.assertEqual(response.status_code, 200)
        body = b"".join(response.streaming_content).decode("utf-8-sig")
        return list(csv.reader(io.StringIO(body)))

    def test_teacher_forbidden(self):
        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.get(self.url, {"academic_year": str(self.ay.id)})
        self.assertEqual(response.status_code, 403)

    def test_csv_lists_only_students_who_fail_the_year(self):
        ana_ctx = build_certificate_context(
            student=self.ana, academic_year=self.ay, issued_on=date(2026, 11, 17)
        )
        bea_ctx = build_certificate_context(
            student=self.bea, academic_year=self.ay, issued_on=date(2026, 11, 17)
        )
        self.assertFalse(ana_ctx["passed_year"])
        self.assertTrue(bea_ctx["passed_year"])

        self.client.force_authenticate(user=self.admin_user)
        rows = self._rows(self.client.get(self.url, {"academic_year": str(self.ay.id)}))
        self.assertEqual(len(rows), 2)
        header = rows[0]
        self.assertIn("estudiante_nombre_completo", header)
        self.assertIn("asignaturas_perdidas", header)
        self.assertIn("asignaturas_pendientes", header)
        self.assertIn("detalle_reprobacion", header)
        by_name = {dict(zip(header, row))["estudiante_nombre_completo"]: dict(zip(header, row)) for row in rows[1:]}
        self.assertEqual(set(by_name), {"Ana Pierde"})
        ana = by_name["Ana Pierde"]
        self.assertEqual(ana["asignaturas_evaluadas"], "2")
        self.assertEqual(ana["asignaturas_perdidas"], "1")
        self.assertEqual(ana["asignaturas_pendientes"], "0")
        self.assertEqual(ana["detalle_reprobacion"], "Lengua: 2.90")
        self.assertNotIn("Ciencias", ana["detalle_reprobacion"])

    def test_recovered_loss_is_omitted_and_low_average_is_kept(self):
        fina = self._student("ST602", "Fina", "Recupera", "Fina Recupera")
        self._enroll(fina)
        self._grade(fina, self.ca_lengua, self.p1, "2.50", definitive="3.00")
        self._grade(fina, self.ca_lengua, self.p2, "4.00")
        self._grade(fina, self.ca_ciencias, self.p1, "3.00")
        self._grade(fina, self.ca_ciencias, self.p2, "3.00")

        dina = self._student("ST603", "Dina", "Baja", "Dina Baja")
        self._enroll(dina)
        self._grade(dina, self.ca_lengua, self.p1, "1.00")
        self._grade(dina, self.ca_lengua, self.p2, "1.20")
        self._grade(dina, self.ca_ciencias, self.p1, "4.00")
        self._grade(dina, self.ca_ciencias, self.p2, "4.00")

        self.client.force_authenticate(user=self.admin_user)
        rows = self._rows(self.client.get(self.url, {"academic_year": str(self.ay.id)}))
        header = rows[0]
        by_name = {
            dict(zip(header, row))["estudiante_nombre_completo"]: dict(zip(header, row))
            for row in rows[1:]
        }
        self.assertNotIn("Fina Recupera", by_name)
        self.assertEqual(by_name["Dina Baja"]["detalle_reprobacion"], "Lengua: 1.10")

    def test_pending_subject_fails_the_year(self):
        ciro = self._student("ST604", "Ciro", "Pendiente", "Ciro Pendiente")
        self._enroll(ciro)
        self._grade(ciro, self.ca_lengua, self.p1, "4.00")
        self._grade(ciro, self.ca_lengua, self.p2, "4.00")

        self.client.force_authenticate(user=self.admin_user)
        rows = self._rows(self.client.get(self.url, {"academic_year": str(self.ay.id)}))
        header = rows[0]
        by_name = {
            dict(zip(header, row))["estudiante_nombre_completo"]: dict(zip(header, row))
            for row in rows[1:]
        }
        ciro_row = by_name["Ciro Pendiente"]
        self.assertEqual(ciro_row["asignaturas_pendientes"], "1")
        self.assertEqual(ciro_row["asignaturas_perdidas"], "0")
        self.assertEqual(ciro_row["detalle_reprobacion"], "Ciencias: PENDIENTE")

    def test_withdrawn_enrollment_is_excluded(self):
        gone = self._student("ST605", "Omar", "Retirado", "Omar Retirado")
        self._enroll(gone, status="withdrawn")
        self._grade(gone, self.ca_lengua, self.p1, "1.00")
        self._grade(gone, self.ca_lengua, self.p2, "1.00")
        self._grade(gone, self.ca_ciencias, self.p1, "1.00")
        self._grade(gone, self.ca_ciencias, self.p2, "1.00")

        self.client.force_authenticate(user=self.admin_user)
        rows = self._rows(self.client.get(self.url, {"academic_year": str(self.ay.id)}))
        names = [dict(zip(rows[0], row))["estudiante_nombre_completo"] for row in rows[1:]]
        self.assertNotIn("Omar Retirado", names)

    def test_group_filter(self):
        other = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="502",
        )
        ca = CourseAssignment.objects.create(
            subject=self.lengua,
            teacher=self.teacher,
            group=other,
            academic_year=self.ay,
        )
        luis = self._student("ST606", "Luis", "Otro", "Luis Otro")
        self._enroll(luis, group=other)
        self._grade(luis, ca, self.p1, "1.00")
        self._grade(luis, ca, self.p2, "1.00")

        self.client.force_authenticate(user=self.admin_user)
        rows = self._rows(
            self.client.get(
                self.url,
                {"academic_year": str(self.ay.id), "group": str(self.group.id)},
            )
        )
        names = [dict(zip(rows[0], row))["estudiante_nombre_completo"] for row in rows[1:]]
        self.assertIn("Ana Pierde", names)
        self.assertNotIn("Luis Otro", names)

    def test_coordinator_wrong_institution_forbidden(self):
        self.client.force_authenticate(user=self.coord_user)
        other = Institution.objects.create(name="Otra IE", dane_code="DANE995501")
        ay_other = AcademicYear.objects.create(institution=other, year=2030)
        response = self.client.get(self.url, {"academic_year": str(ay_other.id)})
        self.assertEqual(response.status_code, 403)

    def test_coordinator_ok(self):
        self.client.force_authenticate(user=self.coord_user)
        response = self.client.get(self.url, {"academic_year": str(self.ay.id)})
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn("estudiantes_reprobados_2026_", response["Content-Disposition"])

    def test_invalid_group_for_year(self):
        self.client.force_authenticate(user=self.admin_user)
        other = Institution.objects.create(name="IE X", dane_code="DANE995502")
        ay2 = AcademicYear.objects.create(institution=other, year=2031)
        campus2 = Campus.objects.create(institution=other, name="Sede X")
        gl2 = GradeLevel.objects.create(institution=other, name="SEXTO", level_order=6)
        group2 = Group.objects.create(
            grade_level=gl2, academic_year=ay2, campus=campus2, name="601"
        )
        response = self.client.get(
            self.url,
            {"academic_year": str(self.ay.id), "group": str(group2.id)},
        )
        self.assertEqual(response.status_code, 400)
