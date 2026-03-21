"""Authentication views with OpenAPI documentation."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .auth_serializers import CustomTokenObtainPairSerializer


@extend_schema_view(
    post=extend_schema(
        summary="Obtain JWT token pair",
        description="Login with username and password. Returns access and refresh tokens plus user profile.",
        tags=["Authentication"],
    )
)
class LoginView(TokenObtainPairView):
    """Obtain access and refresh tokens. Returns user profile in response."""
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


@extend_schema_view(
    post=extend_schema(
        summary="Refresh access token",
        description="Exchange refresh token for a new access token.",
        tags=["Authentication"],
    )
)
class RefreshTokenView(TokenRefreshView):
    """Refresh access token using refresh token."""
    permission_classes = [AllowAny]


@extend_schema(
    summary="Current user profile",
    description="Get authenticated user profile including role and institution.",
    tags=["Authentication"],
    responses={
        200: OpenApiTypes.OBJECT,
    },
)
class MeView(APIView):
    """Return current authenticated user profile with role and scope."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            "id": user.pk,
            "username": user.username,
            "email": user.email or "",
            "role": None,
            "institution_id": None,
            "teacher_id": None,
            "parent_id": None,
        }
        if hasattr(user, "profile"):
            profile = user.profile
            data["role"] = profile.role
            data["institution_id"] = str(profile.institution_id) if profile.institution_id else None
            data["teacher_id"] = str(profile.teacher_id) if profile.teacher_id else None
            data["parent_id"] = str(profile.parent_id) if profile.parent_id else None
        return Response(data, status=status.HTTP_200_OK)
