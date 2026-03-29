"""Authentication views with OpenAPI documentation."""
from rest_framework import serializers

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiExample,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .auth_serializers import CustomTokenObtainPairSerializer


LoginResponseSerializer = inline_serializer(
    name="LoginResponse",
    fields={
        "access": serializers.CharField(help_text="JWT access token. Use in Authorization: Bearer <token>"),
        "refresh": serializers.CharField(help_text="JWT refresh token. Use to obtain a new access token."),
        "user": inline_serializer(
            name="LoginUser",
            fields={
                "id": serializers.IntegerField(help_text="User primary key"),
                "username": serializers.CharField(),
                "email": serializers.CharField(),
                "role": serializers.CharField(
                    allow_null=True,
                    help_text="User role: ADMIN, COORDINADOR, DOCENTE, PADRE_FAMILIA",
                ),
                "institution_id": serializers.CharField(
                    allow_null=True,
                    help_text="UUID of the institution the user belongs to (if any)",
                ),
            },
        ),
    },
)


@extend_schema_view(
    post=extend_schema(
        summary="Login",
        description="Authenticate with username and password. Returns JWT access and refresh tokens plus user profile. "
        "Use the `access` token in the `Authorization: Bearer <token>` header for protected endpoints.",
        tags=["Authentication"],
        request=CustomTokenObtainPairSerializer,
        responses={200: LoginResponseSerializer},
        examples=[
            OpenApiExample(
                "Login request",
                value={"username": "admin", "password": "your-password"},
                request_only=True,
                summary="Request body",
            ),
            OpenApiExample(
                "Login response",
                value={
                    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                    "user": {
                        "id": 1,
                        "username": "admin",
                        "email": "admin@example.com",
                        "role": "ADMIN",
                        "institution_id": "550e8400-e29b-41d4-a716-446655440000",
                    },
                },
                response_only=True,
                summary="Response",
            ),
        ],
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
