"""API tests for user profiles and available auth users."""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .models import UserProfile

User = get_user_model()


class AvailableUsersApiTests(APITestCase):
    """GET /api/users/available/ lists auth users without a UserProfile."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="up_admin", password="x", email="admin@test.com"
        )
        UserProfile.objects.filter(user=self.admin).update(role="ADMIN")
        self.admin = User.objects.select_related("profile").get(pk=self.admin.pk)
        self.client.force_authenticate(user=self.admin)
        self.url = reverse("userprofile-available")

    def test_lists_users_without_profile(self):
        orphan = User.objects.create_user(
            username="orphan_user", password="x", email="orphan@test.com"
        )
        UserProfile.objects.filter(user=orphan).delete()

        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        usernames = {row["username"] for row in r.data["results"]}
        self.assertIn("orphan_user", usernames)
        self.assertNotIn("up_admin", usernames)
        orphan_row = next(
            row for row in r.data["results"] if row["username"] == "orphan_user"
        )
        self.assertEqual(orphan_row["id"], orphan.pk)
        self.assertEqual(orphan_row["email"], "orphan@test.com")

    def test_teacher_cannot_list_available_users(self):
        teacher = User.objects.create_user(username="up_teacher", password="x")
        UserProfile.objects.filter(user=teacher).update(role="TEACHER")
        teacher = User.objects.select_related("profile").get(pk=teacher.pk)
        self.client.force_authenticate(user=teacher)

        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 403)
