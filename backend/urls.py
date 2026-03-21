"""
URL configuration for educalc project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from core.auth_views import LoginView, MeView, RefreshTokenView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Authentication
    path("api/auth/login/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    # OpenAPI / Swagger
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
