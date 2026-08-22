"""Face-Auth SSO token exchange tests."""
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Institution

User = get_user_model()

FACEAUTH_SETTINGS = {
    "FACEAUTH_API": "http://faceauth.test",
    "FACEAUTH_WEB": "http://faceauth-web.test",
    "FACEAUTH_APP_ID": "app_test123",
    "FACEAUTH_API_KEY": "tenant-secret",
    "FACEAUTH_TIMEOUT_SECONDS": 5,
}

IDENTITY = {
    "valid": True,
    "user_id": str(uuid4()),
    "app_id": "app_test123",
    "email": "ada@example.com",
    "first_name": "Ada",
    "last_name": "Lovelace",
    "expires_at": "2026-07-30T23:41:12Z",
}


@override_settings(**FACEAUTH_SETTINGS)
class FaceAuthConfigTests(APITestCase):
    def test_config_enabled_when_fully_configured(self):
        response = self.client.get("/api/auth/faceauth/config/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "enabled": True,
                "web_url": "http://faceauth-web.test",
                "app_id": "app_test123",
            },
        )

    def test_config_disabled_without_secrets(self):
        with override_settings(FACEAUTH_API_KEY=""):
            response = self.client.get("/api/auth/faceauth/config/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {"enabled": False, "web_url": None, "app_id": None},
        )


@override_settings(**FACEAUTH_SETTINGS)
class FaceAuthCallbackTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name="IE Test", dane_code="DANE-FA-1"
        )
        self.user = User.objects.create_user(
            username="ada",
            password="secret",
            email="ada@example.com",
            first_name="Old",
            last_name="Name",
        )
        profile = self.user.profile
        profile.role = "TEACHER"
        profile.institution = self.institution
        profile.save()

    def test_missing_token_returns_400(self):
        response = self.client.post("/api/auth/faceauth/callback/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("core.faceauth._post_verify")
    def test_exchange_links_by_email_and_issues_local_jwt(self, mock_verify):
        mock_verify.return_value = dict(IDENTITY)
        response = self.client.post(
            "/api/auth/faceauth/callback/",
            {"token": "sso-redirect-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "ada@example.com")
        self.assertEqual(response.data["user"]["role"], "TEACHER")
        self.assertEqual(
            response.data["user"]["institution_id"], str(self.institution.id)
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Ada")
        self.assertEqual(self.user.last_name, "Lovelace")
        self.user.profile.refresh_from_db()
        self.assertEqual(str(self.user.profile.faceauth_user_id), IDENTITY["user_id"])

    @patch("core.faceauth._post_verify")
    def test_exchange_finds_user_by_faceauth_user_id(self, mock_verify):
        face_id = uuid4()
        mock_verify.return_value = dict(IDENTITY, user_id=str(face_id), email="other@x.com")
        self.user.profile.faceauth_user_id = face_id
        self.user.profile.save()
        response = self.client.post(
            "/api/auth/faceauth/callback/",
            {"token": "sso-redirect-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "ada")

    @patch("core.faceauth._post_verify")
    def test_unknown_identity_is_not_auto_created(self, mock_verify):
        mock_verify.return_value = dict(IDENTITY, email="nobody@example.com")
        response = self.client.post(
            "/api/auth/faceauth/callback/",
            {"token": "sso-redirect-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["code"], "user_not_provisioned")
        self.assertFalse(User.objects.filter(email="nobody@example.com").exists())

    @patch("core.faceauth._post_verify")
    def test_inactive_user_is_rejected(self, mock_verify):
        mock_verify.return_value = dict(IDENTITY)
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            "/api/auth/faceauth/callback/",
            {"token": "sso-redirect-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["code"], "user_inactive")

    @patch("core.faceauth._post_verify")
    def test_faceauth_invalid_token_is_forwarded(self, mock_verify):
        from core.faceauth import FaceAuthError

        mock_verify.side_effect = FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "token_already_used",
            "El token ya fue verificado (un solo uso).",
            "token",
        )
        response = self.client.post(
            "/api/auth/faceauth/callback/",
            {"token": "replayed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["code"], "token_already_used")

    def test_callback_without_config_returns_503(self):
        with override_settings(FACEAUTH_API_KEY=""):
            response = self.client.post(
                "/api/auth/faceauth/callback/",
                {"token": "anything"},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "faceauth_not_configured")
