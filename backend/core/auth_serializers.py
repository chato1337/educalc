"""Custom JWT serializers with user profile in response."""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


def build_login_user(user):
    """Login/me-shaped user payload used by password login and Face-Auth exchange."""
    data = {
        "id": user.pk,
        "username": user.username,
        "email": user.email or "",
        "role": None,
        "institution_id": None,
    }
    if hasattr(user, "profile"):
        profile = user.profile
        data["role"] = profile.role
        data["institution_id"] = str(profile.institution_id) if profile.institution_id else None
    return data


def build_login_response(user):
    """Issue eduCalc access/refresh tokens plus the same user object as password login."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": build_login_user(user),
    }


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Add user profile data (role, institution_id) to token response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = build_login_user(self.user)
        return data


class FaceAuthCallbackRequestSerializer(serializers.Serializer):
    token = serializers.CharField(
        help_text="One-time Face-Auth SSO redirect token from the callback query string."
    )
