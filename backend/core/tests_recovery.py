"""Tests for grade recoveries (Bajo scale + definitive_grade overwrite)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .models import (
    AcademicArea,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    Enrollment,
    Grade,
    GradeLevel,
    GradeRecovery,
    GradingScale,
    Group,
    Institution,
    Student,
    Subject,
    Teacher,
    UserProfile,
)


class GradeRecoveryApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.teacher_user = User.objects.create_user(username="rec_teacher", password="x")
        self.other_teacher_user = User.objects.create_user(
            username="rec_other", password="x"
        )

        self.inst = Institution.objects.create(name="IE Recovery", dane_code="DANE996001")
        GradingScale.objects.create(
            institution=self.inst,
            code="BJ",
            name="Bajo",
            min_score=Decimal("0.00"),
            max_score=Decimal("2.99"),
        )
        GradingScale.objects.create(
            institution=self.inst,
            code="BS",
            name="Básico",
            min_score=Decimal("3.00"),
            max_score=Decimal("3.99"),
        )
        self.campus = Campus.objects.create(institution=self.inst, name="Sede Rec")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay, number=1, name="P1"
        )
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.group_a = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="601",
        )
        self.group_b = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus,
            name="602",
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Matemáticas")
        self.teacher = Teacher.objects.create(
            document_number="RECT1",
            first_name="Ana",
            first_last_name="Rec",
            full_name="Ana Rec",
        )
        self.other_teacher = Teacher.objects.create(
            document_number="RECT2",
            first_name="Otro",
            first_last_name="Doc",
            full_name="Otro Doc",
        )
        self.subject = Subject.objects.create(
            academic_area=self.area,
            institution=self.inst,
            name="Matemáticas",
        )
        self.ca_a = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.teacher,
            group=self.group_a,
            academic_year=self.ay,
        )
        self.ca_b = CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.other_teacher,
            group=self.group_b,
            academic_year=self.ay,
        )
        self.student_a = Student.objects.create(
            document_number="RECS1",
            first_name="Pedro",
            first_last_name="Bajo",
            full_name="Pedro Bajo",
        )
        self.student_b = Student.objects.create(
            document_number="RECS2",
            first_name="Laura",
            first_last_name="Otro",
            full_name="Laura Otro",
        )
        self.student_pass = Student.objects.create(
            document_number="RECS3",
            first_name="Ok",
            first_last_name="Pasa",
            full_name="Ok Pasa",
        )
        Enrollment.objects.create(
            student=self.student_a,
            group=self.group_a,
            academic_year=self.ay,
            status="active",
        )
        Enrollment.objects.create(
            student=self.student_b,
            group=self.group_b,
            academic_year=self.ay,
            status="active",
        )
        Enrollment.objects.create(
            student=self.student_pass,
            group=self.group_a,
            academic_year=self.ay,
            status="active",
        )
        self.grade_bajo = Grade.objects.create(
            student=self.student_a,
            course_assignment=self.ca_a,
            academic_period=self.period,
            numerical_grade=Decimal("2.50"),
        )
        self.grade_other = Grade.objects.create(
            student=self.student_b,
            course_assignment=self.ca_b,
            academic_period=self.period,
            numerical_grade=Decimal("2.00"),
        )
        self.grade_pass = Grade.objects.create(
            student=self.student_pass,
            course_assignment=self.ca_a,
            academic_period=self.period,
            numerical_grade=Decimal("3.50"),
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
        self.client.force_authenticate(user=self.teacher_user)

    def test_eligible_lists_only_own_bajo_grades(self):
        url = reverse("graderecovery-eligible")
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.grade_bajo.id)})
        self.assertNotIn(str(self.grade_other.id), ids)
        self.assertNotIn(str(self.grade_pass.id), ids)

    def test_apply_recovery_overwrites_definitive_grade(self):
        url = reverse("graderecovery-list")
        r = self.client.post(
            url,
            {
                "grade": str(self.grade_bajo.id),
                "recovery_grade": "3.20",
                "description": "Sustentación oral de competencias pendientes.",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.grade_bajo.refresh_from_db()
        self.assertEqual(self.grade_bajo.definitive_grade, Decimal("3.20"))
        self.assertEqual(GradeRecovery.objects.count(), 1)
        recovery = GradeRecovery.objects.get()
        self.assertEqual(recovery.description, "Sustentación oral de competencias pendientes.")
        self.assertEqual(recovery.created_by_id, self.teacher.id)
        self.assertIsNone(recovery.previous_definitive_grade)

    def test_cannot_recover_other_teacher_grade(self):
        url = reverse("graderecovery-list")
        r = self.client.post(
            url,
            {
                "grade": str(self.grade_other.id),
                "recovery_grade": "3.00",
                "description": "Intento indebido",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 404)

    def test_cannot_recover_non_bajo_grade(self):
        url = reverse("graderecovery-list")
        r = self.client.post(
            url,
            {
                "grade": str(self.grade_pass.id),
                "recovery_grade": "4.00",
                "description": "No aplica",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_fallback_bajo_max_when_scale_missing(self):
        GradingScale.objects.filter(institution=self.inst, code="BJ").delete()
        grade_edge = Grade.objects.create(
            student=self.student_a,
            course_assignment=self.ca_a,
            academic_period=AcademicPeriod.objects.create(
                academic_year=self.ay, number=2, name="P2"
            ),
            numerical_grade=Decimal("2.99"),
        )
        grade_above = Grade.objects.create(
            student=self.student_pass,
            course_assignment=self.ca_a,
            academic_period=grade_edge.academic_period,
            numerical_grade=Decimal("3.00"),
        )
        url = reverse("graderecovery-eligible")
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertIn(str(self.grade_bajo.id), ids)
        self.assertIn(str(grade_edge.id), ids)
        self.assertNotIn(str(grade_above.id), ids)
        self.assertNotIn(str(self.grade_pass.id), ids)

    def test_hide_recovered_excludes_grades_with_recovery(self):
        GradeRecovery.objects.create(
            grade=self.grade_bajo,
            recovery_grade=Decimal("3.10"),
            description="Ya recuperó",
            created_by=self.teacher,
        )
        url = reverse("graderecovery-eligible")
        r_all = self.client.get(url)
        self.assertEqual(r_all.status_code, 200)
        ids_all = {row["id"] for row in r_all.data["results"]}
        self.assertIn(str(self.grade_bajo.id), ids_all)

        r_hidden = self.client.get(url, {"hide_recovered": "true"})
        self.assertEqual(r_hidden.status_code, 200)
        ids_hidden = {row["id"] for row in r_hidden.data["results"]}
        self.assertNotIn(str(self.grade_bajo.id), ids_hidden)
