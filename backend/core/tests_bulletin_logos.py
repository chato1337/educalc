"""Bulletin crest uploads and the URLs the student bulletin renders."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from core.bulletin_service import build_bulletin_context
from core.models import (
    AcademicPeriod,
    AcademicYear,
    Campus,
    Enrollment,
    GradeLevel,
    Group,
    Institution,
    Student,
)

User = get_user_model()

LEFT_URL = "https://cdn.example.com/bulletin-logos/left.jpg"
RIGHT_URL = "https://cdn.example.com/bulletin-logos/right.jpg"


def _png(name="crest.png"):
    return SimpleUploadedFile(name, b"\x89PNG\r\n", content_type="image/png")


class BulletinLogoApiTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name="IE Escudos",
            dane_code="DANE-LOGO-1",
            bulletin_logo_left_url="https://cdn.example.com/old-left.jpg",
            bulletin_logo_right_url="https://cdn.example.com/old-right.jpg",
        )
        self.other = Institution.objects.create(
            name="Otra IE",
            dane_code="DANE-LOGO-2",
        )
        self.admin = self._user("logo_admin", "ADMIN")
        self.coordinator = self._user("logo_coord", "COORDINATOR", self.institution)
        self.other_coordinator = self._user(
            "logo_coord_other", "COORDINATOR", self.other
        )
        self.teacher = self._user("logo_teacher", "TEACHER", self.institution)

    def _user(self, username, role, institution=None):
        user = User.objects.create_user(username=username, password="x")
        profile = user.profile
        profile.role = role
        profile.institution = institution
        profile.save()
        return user

    def _post(self, institution, slot, uploaded=None, data=None):
        self.client.force_authenticate(self.admin)
        payload = data if data is not None else {"file": uploaded or _png()}
        return self.client.post(
            f"/api/institutions/{institution.id}/bulletin-logo-{slot}/",
            payload,
            format="multipart",
        )

    @patch("core.services.file_utils.delete_file_from_s3", return_value=True)
    @patch("core.services.file_utils.upload_file_to_s3", return_value=LEFT_URL)
    def test_upload_persists_left_url(self, upload_mock, delete_mock):
        response = self._post(self.institution, "left")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["bulletin_logo_left_url"], LEFT_URL)
        self.assertEqual(
            response.data["bulletin_logo_right_url"],
            "https://cdn.example.com/old-right.jpg",
        )
        self.institution.refresh_from_db()
        self.assertEqual(self.institution.bulletin_logo_left_url, LEFT_URL)
        delete_mock.assert_called_once_with("https://cdn.example.com/old-left.jpg")
        self.assertEqual(upload_mock.call_args.kwargs["folder"], "bulletin-logos")

    @patch("core.services.file_utils.upload_file_to_s3", return_value=RIGHT_URL)
    @patch("core.services.file_utils.delete_file_from_s3", return_value=True)
    def test_upload_persists_right_url(self, _delete_mock, _upload_mock):
        response = self._post(self.institution, "right")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.institution.refresh_from_db()
        self.assertEqual(self.institution.bulletin_logo_right_url, RIGHT_URL)
        self.assertEqual(
            self.institution.bulletin_logo_left_url,
            "https://cdn.example.com/old-left.jpg",
        )

    def test_missing_file_does_not_change_url(self):
        response = self._post(self.institution, "left", data={})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.institution.refresh_from_db()
        self.assertEqual(
            self.institution.bulletin_logo_left_url,
            "https://cdn.example.com/old-left.jpg",
        )

    def test_unsupported_type_does_not_change_url(self):
        uploaded = SimpleUploadedFile("notes.txt", b"hola", content_type="text/plain")
        response = self._post(self.institution, "left", uploaded=uploaded)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.institution.refresh_from_db()
        self.assertEqual(
            self.institution.bulletin_logo_left_url,
            "https://cdn.example.com/old-left.jpg",
        )

    @patch("core.services.file_utils.delete_file_from_s3", return_value=False)
    @patch("core.services.file_utils.upload_file_to_s3", return_value=None)
    def test_failed_upload_does_not_write_url(self, _upload_mock, delete_mock):
        response = self._post(self.institution, "left")
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.institution.refresh_from_db()
        self.assertEqual(
            self.institution.bulletin_logo_left_url,
            "https://cdn.example.com/old-left.jpg",
        )
        delete_mock.assert_called_once()

    def test_patch_cannot_set_logo_urls(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/institutions/{self.institution.id}/",
            {
                "bulletin_logo_left_url": "https://evil.example/left.jpg",
                "bulletin_logo_right_url": "https://evil.example/right.jpg",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.institution.refresh_from_db()
        self.assertEqual(
            self.institution.bulletin_logo_left_url,
            "https://cdn.example.com/old-left.jpg",
        )
        self.assertEqual(
            self.institution.bulletin_logo_right_url,
            "https://cdn.example.com/old-right.jpg",
        )

    @patch("core.services.file_utils.upload_file_to_s3", return_value=LEFT_URL)
    @patch("core.services.file_utils.delete_file_from_s3", return_value=True)
    def test_coordinator_uploads_own_institution(self, _delete_mock, _upload_mock):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/institutions/{self.institution.id}/bulletin-logo-left/",
            {"file": _png()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("core.services.file_utils.upload_file_to_s3", return_value=LEFT_URL)
    def test_coordinator_cannot_upload_another_institution(self, _upload_mock):
        self.client.force_authenticate(self.other_coordinator)
        response = self.client.post(
            f"/api/institutions/{self.institution.id}/bulletin-logo-left/",
            {"file": _png()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.institution.refresh_from_db()
        self.assertEqual(
            self.institution.bulletin_logo_left_url,
            "https://cdn.example.com/old-left.jpg",
        )

    def test_teacher_cannot_upload(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            f"/api/institutions/{self.institution.id}/bulletin-logo-left/",
            {"file": _png()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class BulletinLogoContextTests(APITestCase):
    def test_bulletin_uses_institution_logos_and_omits_them_when_empty(self):
        institution = Institution.objects.create(
            name="IE Boletín",
            dane_code="DANE-BOL-LOGO",
            bulletin_logo_left_url=LEFT_URL,
            bulletin_logo_right_url=RIGHT_URL,
        )
        campus = Campus.objects.create(institution=institution, name="Sede")
        year = AcademicYear.objects.create(institution=institution, year=2026)
        AcademicPeriod.objects.create(academic_year=year, number=1, name="P1")
        grade = GradeLevel.objects.create(
            institution=institution, name="SEXTO", level_order=6
        )
        group = Group.objects.create(
            grade_level=grade,
            academic_year=year,
            campus=campus,
            name="601",
        )
        student = Student.objects.create(
            first_name="Ana",
            first_last_name="López",
            full_name="Ana López",
        )
        Enrollment.objects.create(
            student=student,
            group=group,
            academic_year=year,
            status="active",
        )

        ctx = build_bulletin_context(student=student, academic_year=year, period_ids=None)
        self.assertEqual(ctx["logo_left_url"], LEFT_URL)
        self.assertEqual(ctx["logo_right_url"], RIGHT_URL)

        institution.bulletin_logo_left_url = ""
        institution.bulletin_logo_right_url = ""
        institution.save()
        ctx = build_bulletin_context(student=student, academic_year=year, period_ids=None)
        self.assertEqual(ctx["logo_left_url"], "")
        self.assertEqual(ctx["logo_right_url"], "")
