"""Admin configuration for core models."""
from django.contrib import admin

from .models import (
    AcademicArea,
    AcademicYear,
    Campus,
    GradeLevel,
    GradingScale,
    Institution,
)


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("name", "dane_code", "nit", "created_at")
    search_fields = ("name", "dane_code")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = ("name", "institution", "code", "created_at")
    list_filter = ("institution",)
    search_fields = ("name", "code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("institution",)


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("year", "institution", "is_active", "start_date", "end_date", "created_at")
    list_filter = ("institution", "is_active")
    search_fields = ("year",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("institution",)


@admin.register(GradeLevel)
class GradeLevelAdmin(admin.ModelAdmin):
    list_display = ("name", "institution", "level_order", "created_at")
    list_filter = ("institution",)
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("institution",)
    ordering = ("level_order",)


@admin.register(AcademicArea)
class AcademicAreaAdmin(admin.ModelAdmin):
    list_display = ("name", "institution", "code", "created_at")
    list_filter = ("institution",)
    search_fields = ("name", "code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("institution",)


@admin.register(GradingScale)
class GradingScaleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "institution", "score_range", "created_at")
    list_filter = ("institution",)
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("institution",)
    ordering = ("-min_score",)

    def score_range(self, obj):
        return f"{obj.min_score} - {obj.max_score}"

    score_range.short_description = "Score Range"
