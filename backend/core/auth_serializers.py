"""Custom JWT serializers with user profile in response."""
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Add user profile data (role, institution_id) to token response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data["user"] = {
            "id": user.pk,
            "username": user.username,
            "email": user.email or "",
        }
        # Add profile if exists
        if hasattr(user, "profile"):
            profile = user.profile
            data["user"]["role"] = profile.role
            data["user"]["institution_id"] = str(profile.institution_id) if profile.institution_id else None
        else:
            data["user"]["role"] = None
            data["user"]["institution_id"] = None
        return data
