"""API tests for grade directors (campus column and sede filter)."""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .models import (
    AcademicYear,
    Campus,
    GradeDirector,
    GradeLevel,
    Group,
    Institution,
    Teacher,
    UserProfile,
)


class GradeDirectorCampusApiTests(APITestCase):
    """GET /api/grade-directors/ exposes campus and filters by sede."""

    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.admin = User.objects.create_user(username="gd_admin", password="x")
        UserProfile.objects.filter(user=self.admin).update(role="ADMIN")
        self.admin = User.objects.select_related("profile").get(pk=self.admin.pk)
        self.client.force_authenticate(user=self.admin)

        self.inst = Institution.objects.create(name="IE GD", dane_code="DANE996100")
        self.campus_n = Campus.objects.create(institution=self.inst, name="Sede Norte")
        self.campus_s = Campus.objects.create(institution=self.inst, name="Sede Sur")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.gl = GradeLevel.objects.create(
            institution=self.inst, name="SEXTO", level_order=6
        )
        self.group_n = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus_n,
            name="601",
        )
        self.group_s = Group.objects.create(
            grade_level=self.gl,
            academic_year=self.ay,
            campus=self.campus_s,
            name="601",
        )
        self.teacher_n = Teacher.objects.create(
            document_number="GDN1",
            first_name="Nora",
            first_last_name="Norte",
            full_name="Nora Norte",
        )
        self.teacher_s = Teacher.objects.create(
            document_number="GDS1",
            first_name="Sara",
            first_last_name="Sur",
            full_name="Sara Sur",
        )
        self.gd_n = GradeDirector.objects.create(
            teacher=self.teacher_n,
            group=self.group_n,
            academic_year=self.ay,
        )
        self.gd_s = GradeDirector.objects.create(
            teacher=self.teacher_s,
            group=self.group_s,
            academic_year=self.ay,
        )
        self.url = reverse("gradedirector-list")

    def test_list_includes_campus_fields(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        by_id = {row["id"]: row for row in r.data["results"]}
        north = by_id[str(self.gd_n.id)]
        self.assertEqual(north["campus"], str(self.campus_n.id))
        self.assertEqual(north["campus_name"], "Sede Norte")
        south = by_id[str(self.gd_s.id)]
        self.assertEqual(south["campus"], str(self.campus_s.id))
        self.assertEqual(south["campus_name"], "Sede Sur")

    def test_filter_by_campus(self):
        r = self.client.get(self.url, {"campus": str(self.campus_n.id)})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["id"], str(self.gd_n.id))

    def test_filter_by_campus_name(self):
        r = self.client.get(self.url, {"campus__name": "Sede Sur"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["id"], str(self.gd_s.id))

    def test_search_by_campus_name(self):
        r = self.client.get(self.url, {"search": "Norte"})
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.data["results"]}
        self.assertEqual(ids, {str(self.gd_n.id)})

    def test_patch_teacher_returns_updated_denormalized_fields(self):
        r = self.client.patch(
            reverse("gradedirector-detail", args=[self.gd_n.id]),
            {"teacher": str(self.teacher_s.id)},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(str(r.data["teacher"]), str(self.teacher_s.id))
        self.assertEqual(r.data["teacher_name"], "Sara Sur")
        self.assertEqual(r.data["campus_name"], "Sede Norte")
