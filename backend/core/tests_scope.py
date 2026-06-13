"""Tests for core API role-based queryset scoping."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .models import (
    AcademicArea,
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
    UserProfile,
)


class CoreApiTeacherScopeTests(APITestCase):
    """Teacher users only see data tied to their course assignments."""

    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.teacher_user = User.objects.create_user(username="scope_teacher", password="x")
        self.other_teacher_user = User.objects.create_user(
            username="scope_other", password="x"
        )

        self.inst = Institution.objects.create(name="IE Scope", dane_code="DANE995001")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede Scope")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
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
            document_number="SCT1",
            first_name="Ana",
            first_last_name="Scope",
            full_name="Ana Scope",
        )
        self.other_teacher = Teacher.objects.create(
            document_number="SCT2",
            first_name="Otro",
            first_last_name="Docente",
            full_name="Otro Docente",
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
        CourseAssignment.objects.create(
            subject=self.subject,
            teacher=self.other_teacher,
            group=self.group_b,
            academic_year=self.ay,
        )
        self.student_a = Student.objects.create(
            document_number="SCS1",
            first_name="Pedro",
            first_last_name="GrupoA",
            full_name="Pedro GrupoA",
        )
        self.student_b = Student.objects.create(
            document_number="SCS2",
            first_name="Laura",
            first_last_name="GrupoB",
            full_name="Laura GrupoB",
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

    def test_teacher_students_list_scoped(self):
        r = self.client.get(reverse("student-list"))
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.student_a.id)})
        self.assertNotIn(str(self.student_b.id), ids)

    def test_teacher_cannot_retrieve_other_student(self):
        url = reverse("student-detail", kwargs={"pk": self.student_b.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, 404)

    def test_teacher_groups_list_scoped(self):
        r = self.client.get(reverse("group-list"))
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.group_a.id)})

    def test_teacher_course_assignments_scoped(self):
        r = self.client.get(reverse("courseassignment-list"))
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.ca_a.id)})

    def test_teacher_bulk_load_forbidden(self):
        url = reverse("grade-bulk-load")
        r = self.client.post(url, {}, format="multipart")
        self.assertEqual(r.status_code, 403)


class CoreApiAdminScopeTests(APITestCase):
    """Administrators retain access to all records."""

    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.admin_user = User.objects.create_user(username="scope_admin", password="x")
        UserProfile.objects.filter(user=self.admin_user).update(role="ADMIN")
        self.admin_user = User.objects.select_related("profile").get(pk=self.admin_user.pk)
        self.client.force_authenticate(user=self.admin_user)

        self.inst = Institution.objects.create(name="IE Admin", dane_code="DANE995002")
        self.student1 = Student.objects.create(
            document_number="ADM1",
            first_name="Uno",
            first_last_name="Est",
            full_name="Uno Est",
        )
        self.student2 = Student.objects.create(
            document_number="ADM2",
            first_name="Dos",
            first_last_name="Est",
            full_name="Dos Est",
        )

    def test_admin_sees_all_students(self):
        r = self.client.get(reverse("student-list"))
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertIn(str(self.student1.id), ids)
        self.assertIn(str(self.student2.id), ids)
