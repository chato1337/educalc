"""Admin configuration for core models."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model

from .models import (
    AcademicArea,
    AcademicIndicatorCatalog,
    AcademicIndicatorsReport,
    AcademicIndicator,
    AcademicPeriod,
    AcademicYear,
    Attendance,
    Campus,
    CourseAssignment,
    DisciplinaryReport,
    Enrollment,
    Grade,
    GradeDirector,
    GradingScale,
    GradeLevel,
    Group,
    Institution,
    Parent,
    PerformanceSummary,
    SchoolRecord,
    Student,
    StudentGuardian,
    Subject,
    Teacher,
    UserProfile,
)

User = get_user_model()


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


@admin.register(AcademicIndicatorCatalog)
class AcademicIndicatorCatalogAdmin(admin.ModelAdmin):
    list_display = (
        "academic_area",
        "grade_level",
        "created_at",
    )
    list_filter = ("academic_area__institution", "grade_level__institution")
    search_fields = (
        "academic_area__name",
        "grade_level__name",
        "achievement_below_basic",
        "achievement_basic_or_above",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("academic_area", "grade_level")


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


# Phase 2
@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "document_number", "date_of_birth", "created_at")
    search_fields = ("full_name", "first_name", "first_last_name", "document_number")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "specialty", "created_at")
    search_fields = ("full_name", "email")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "kinship", "created_at")
    search_fields = ("full_name", "email")
    readonly_fields = ("id", "created_at", "updated_at")


# Phase 3
@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "grade_level", "academic_year", "campus", "created_at")
    list_filter = ("academic_year", "grade_level")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("grade_level", "academic_year", "campus")


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_area", "institution", "emphasis", "hours", "created_at")
    list_filter = ("institution", "academic_area")
    search_fields = ("name", "emphasis")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("academic_area", "institution")


@admin.register(AcademicPeriod)
class AcademicPeriodAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_year", "number", "start_date", "end_date", "created_at")
    list_filter = ("academic_year",)
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("academic_year",)
    ordering = ("academic_year", "number")


@admin.register(CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ("subject", "teacher", "group", "academic_year", "created_at")
    list_filter = ("academic_year",)
    search_fields = ("subject__name", "teacher__full_name")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("subject", "teacher", "group", "academic_year")


@admin.register(GradeDirector)
class GradeDirectorAdmin(admin.ModelAdmin):
    list_display = ("teacher", "group", "academic_year", "created_at")
    list_filter = ("academic_year",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("teacher", "group", "academic_year")


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "group", "academic_year", "status", "enrollment_date", "created_at")
    list_filter = ("academic_year", "status")
    search_fields = ("student__full_name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "group", "academic_year")


@admin.register(StudentGuardian)
class StudentGuardianAdmin(admin.ModelAdmin):
    list_display = ("student", "parent", "is_primary", "created_at")
    list_filter = ("is_primary",)
    search_fields = ("student__full_name", "parent__full_name")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "parent")


# Phase 4
@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("student", "course_assignment", "academic_period", "numerical_grade", "created_at")
    list_filter = ("academic_period",)
    search_fields = ("student__full_name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "course_assignment", "academic_period", "performance_level")


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("student", "course_assignment", "academic_period", "unexcused_absences", "excused_absences", "created_at")
    list_filter = ("academic_period",)
    search_fields = ("student__full_name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "course_assignment", "academic_period")


@admin.register(AcademicIndicator)
class AcademicIndicatorAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "course_assignment",
        "academic_period",
        "catalog",
        "outcome",
        "created_at",
    )
    list_filter = ("academic_period", "outcome", "catalog")
    search_fields = ("student__full_name", "description")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "course_assignment", "academic_period", "catalog")


@admin.register(PerformanceSummary)
class PerformanceSummaryAdmin(admin.ModelAdmin):
    list_display = ("student", "group", "academic_period", "period_average", "rank", "created_at")
    list_filter = ("academic_period",)
    search_fields = ("student__full_name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "group", "academic_period")


@admin.register(DisciplinaryReport)
class DisciplinaryReportAdmin(admin.ModelAdmin):
    list_display = ("student", "academic_period", "created_by", "created_at")
    list_filter = ("academic_period",)
    search_fields = ("student__full_name", "report_text")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "academic_period", "created_by")


# Phase 5
@admin.register(SchoolRecord)
class SchoolRecordAdmin(admin.ModelAdmin):
    list_display = ("student", "group", "academic_year", "institution", "generated_at", "created_at")
    list_filter = ("academic_year",)
    search_fields = ("student__full_name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "group", "academic_year", "institution", "campus")


@admin.register(AcademicIndicatorsReport)
class AcademicIndicatorsReportAdmin(admin.ModelAdmin):
    list_display = ("student", "group", "academic_period", "grade_director", "generated_at", "created_at")
    list_filter = ("academic_period",)
    search_fields = ("student__full_name",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("student", "group", "academic_period", "grade_director")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "institution", "teacher", "parent", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("user", "teacher", "parent", "institution")
