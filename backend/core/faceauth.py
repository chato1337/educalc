"""Face-Auth SSO client: verify one-time redirect token and map it to a local user."""
import json
import uuid
import urllib.error
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.response import Response

from .models import UserProfile

VERIFY_PATH = "/api/v1/auth/token/verify/"
User = get_user_model()


class FaceAuthError(Exception):
    """Transport or mapping failure when exchanging a Face-Auth token."""

    def __init__(self, http_status, code, message, field=None):
        super().__init__(message)
        self.http_status = http_status
        self.code = code
        self.message = message
        self.field = field

    def to_response(self):
        return Response(
            {
                "code": self.code,
                "message": self.message,
                "field": self.field,
                "detail": self.message,
            },
            status=self.http_status,
        )


def is_configured():
    """True when the hosted SSO button can redirect and the backend can verify."""
    return bool(
        settings.FACEAUTH_API
        and settings.FACEAUTH_WEB
        and settings.FACEAUTH_APP_ID
        and settings.FACEAUTH_API_KEY
    )


def public_config():
    enabled = is_configured()
    return {
        "enabled": enabled,
        "web_url": settings.FACEAUTH_WEB if enabled else None,
        "app_id": settings.FACEAUTH_APP_ID if enabled else None,
    }


def verify_sso_token(token):
    """Call Face-Auth token/verify (consumes the token) and return identity claims."""
    if not is_configured():
        raise FaceAuthError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "faceauth_not_configured",
            "Face-Auth no está configurado en este entorno.",
        )
    data = _post_verify(token)
    if not data.get("valid", False):
        raise FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "Token de Face-Auth inválido.",
            "token",
        )
    return data


def resolve_local_user(identity):
    """Map a verified Face-Auth identity to a provisioned Django user.

    Lookup order: ``UserProfile.faceauth_user_id`` (stable key), then email.
    Users are not auto-created: eduCalc accounts carry RBAC and must exist first.
    """
    try:
        faceauth_uid = uuid.UUID(str(identity.get("user_id")))
    except (ValueError, TypeError, AttributeError):
        raise FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "Identidad Face-Auth incompleta.",
            "token",
        )

    profile = (
        UserProfile.objects.select_related("user")
        .filter(faceauth_user_id=faceauth_uid)
        .first()
    )
    if profile is not None:
        user = profile.user
    else:
        user = _user_by_email(identity.get("email"))
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.faceauth_user_id and profile.faceauth_user_id != faceauth_uid:
            raise FaceAuthError(
                status.HTTP_401_UNAUTHORIZED,
                "identity_conflict",
                "Esta cuenta ya está vinculada a otra identidad biométrica.",
                "token",
            )
        if profile.faceauth_user_id != faceauth_uid:
            profile.faceauth_user_id = faceauth_uid
            profile.save(update_fields=["faceauth_user_id", "updated_at"])

    if not user.is_active:
        raise FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "user_inactive",
            "El usuario está desactivado.",
            "token",
        )

    _sync_user_from_identity(user, identity)
    return user


def _user_by_email(email):
    email = (email or "").strip()
    if not email:
        raise FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "user_not_provisioned",
            "No hay un usuario de la plataforma vinculado a esta identidad. "
            "Pide a administración que te cree la cuenta.",
            "email",
        )
    matches = list(User.objects.filter(email__iexact=email)[:2])
    if len(matches) > 1:
        raise FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "ambiguous_user",
            "Hay más de un usuario con este correo. Contacta a administración.",
            "email",
        )
    if not matches:
        raise FaceAuthError(
            status.HTTP_401_UNAUTHORIZED,
            "user_not_provisioned",
            "No hay un usuario de la plataforma vinculado a esta identidad. "
            "Pide a administración que te cree la cuenta.",
            "email",
        )
    return matches[0]


def _sync_user_from_identity(user, identity):
    fields = []
    first = (identity.get("first_name") or "").strip()
    last = (identity.get("last_name") or "").strip()
    email = (identity.get("email") or "").strip()
    if first and user.first_name != first:
        user.first_name = first
        fields.append("first_name")
    if last and user.last_name != last:
        user.last_name = last
        fields.append("last_name")
    if email and (user.email or "").lower() != email.lower():
        taken = User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
        if not taken:
            user.email = email
            fields.append("email")
    if fields:
        user.save(update_fields=fields)


def _post_verify(token):
    url = "{}{}".format(settings.FACEAUTH_API.rstrip("/"), VERIFY_PATH)
    payload = json.dumps(
        {"app_id": settings.FACEAUTH_APP_ID, "token": token}
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Api-Key": settings.FACEAUTH_API_KEY,
        },
        method="POST",
    )
    timeout = max(1, int(settings.FACEAUTH_TIMEOUT_SECONDS))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        raise _from_http_error(exc)
    except json.JSONDecodeError:
        raise FaceAuthError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "faceauth_unavailable",
            "Face-Auth devolvió una respuesta ilegible.",
        )
    except (urllib.error.URLError, TimeoutError, OSError):
        raise FaceAuthError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "faceauth_unavailable",
            "No se pudo contactar Face-Auth.",
        )


def _from_http_error(exc):
    code = "invalid_token"
    message = "Token de Face-Auth inválido."
    field = "token"
    http_status = exc.code if 400 <= exc.code < 500 else status.HTTP_503_SERVICE_UNAVAILABLE
    try:
        body = json.loads(exc.read().decode("utf-8"))
    except (TypeError, ValueError, json.JSONDecodeError):
        body = {}
    if isinstance(body, dict):
        code = body.get("code") or code
        message = body.get("message") or message
        if "field" in body:
            field = body.get("field")
    if exc.code >= 500:
        code = "faceauth_unavailable"
        message = "Face-Auth no está disponible."
        field = None
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    return FaceAuthError(http_status, code, message, field)
