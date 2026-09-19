"""API tests for teacher create with automatic login user."""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .models import Teacher, UserProfile

User = get_user_model()


class TeacherCreateLoginUserTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="t_admin", password="x")
        UserProfile.objects.filter(user=self.admin).update(role="ADMIN")
        self.admin = User.objects.select_related("profile").get(pk=self.admin.pk)
        self.client.force_authenticate(user=self.admin)
        self.url = reverse("teacher-list")

    def test_create_teacher_creates_login_user_like_bulk_load(self):
        payload = {
            "document_type": "CC",
            "document_number": "8001122334",
            "first_name": "José",
            "first_last_name": "Pérez",
            "full_name": "José Pérez",
            "email": "jose.perez@colegio.edu.co",
        }
        r = self.client.post(self.url, payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["username"], "jose.perez")

        teacher = Teacher.objects.get(pk=r.data["id"])
        user = User.objects.get(username="jose.perez")
        self.assertTrue(user.check_password("8001122334"))
        self.assertEqual(user.email, "jose.perez@colegio.edu.co")
        profile = user.profile
        self.assertEqual(profile.role, "TEACHER")
        self.assertEqual(profile.teacher_id, teacher.id)

    def test_create_teacher_requires_document_number(self):
        r = self.client.post(
            self.url,
            {
                "first_name": "Ana",
                "first_last_name": "López",
                "full_name": "Ana López",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("document_number", r.data)
        self.assertFalse(Teacher.objects.filter(first_name="Ana").exists())

    def test_create_teacher_suffixes_duplicate_username(self):
        User.objects.create_user(username="ana.lopez", password="other")
        r = self.client.post(
            self.url,
            {
                "document_number": "111",
                "first_name": "Ana",
                "first_last_name": "López",
                "full_name": "Ana López",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["username"], "ana.lopez1")
        self.assertTrue(User.objects.get(username="ana.lopez1").check_password("111"))
