"""
URL configuration for educalc project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter

from core.auth_views import LoginView, MeView, RefreshTokenView
from core.academic_grades_report_views import AcademicGradesBulletinPdfView
from core.report_views import (
    AcademicIndicatorsReportByStudentPeriodView,
    SchoolRecordByStudentYearView,
)
from core.views import (
    AcademicAreaViewSet,
    AcademicIndicatorViewSet,
    AcademicIndicatorsReportViewSet,
    AcademicPeriodViewSet,
    AcademicYearViewSet,
    AttendanceViewSet,
    CampusViewSet,
    CourseAssignmentViewSet,
    DisciplinaryReportViewSet,
    EnrollmentViewSet,
    GradeDirectorViewSet,
    GradeLevelViewSet,
    GradeViewSet,
    GradingScaleViewSet,
    GroupViewSet,
    InstitutionViewSet,
    ParentViewSet,
    PerformanceSummaryViewSet,
    SchoolRecordViewSet,
    StudentGuardianViewSet,
    StudentViewSet,
    SubjectViewSet,
    TeacherViewSet,
    UserProfileViewSet,
)

router = DefaultRouter()
router.register(r"institutions", InstitutionViewSet, basename="institution")
router.register(r"campuses", CampusViewSet, basename="campus")
router.register(r"academic-years", AcademicYearViewSet, basename="academicyear")
router.register(r"grade-levels", GradeLevelViewSet, basename="gradelevel")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"students", StudentViewSet, basename="student")
router.register(r"teachers", TeacherViewSet, basename="teacher")
router.register(r"parents", ParentViewSet, basename="parent")
router.register(r"academic-areas", AcademicAreaViewSet, basename="academicarea")
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"course-assignments", CourseAssignmentViewSet, basename="courseassignment")
router.register(r"academic-periods", AcademicPeriodViewSet, basename="academicperiod")
router.register(r"grading-scales", GradingScaleViewSet, basename="gradingscale")
router.register(r"grades", GradeViewSet, basename="grade")
router.register(r"attendances", AttendanceViewSet, basename="attendance")
router.register(r"academic-indicators", AcademicIndicatorViewSet, basename="academicindicator")
router.register(r"performance-summaries", PerformanceSummaryViewSet, basename="performancesummary")
router.register(r"disciplinary-reports", DisciplinaryReportViewSet, basename="disciplinaryreport")
router.register(r"student-guardians", StudentGuardianViewSet, basename="studentguardian")
router.register(r"grade-directors", GradeDirectorViewSet, basename="gradedirector")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")
router.register(r"school-records", SchoolRecordViewSet, basename="schoolrecord")
router.register(
    r"academic-indicators-reports",
    AcademicIndicatorsReportViewSet,
    basename="academicindicatorsreport",
)
router.register(r"users", UserProfileViewSet, basename="userprofile")

urlpatterns = [
    path("admin/", admin.site.urls),
    # Authentication
    path("api/auth/login/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    # Composite report endpoints (must be before router to avoid pk conflict)
    path(
        "api/school-records/<uuid:student_id>/<uuid:academic_year_id>/",
        SchoolRecordByStudentYearView.as_view(),
        name="school-record-by-student-year",
    ),
    path(
        "api/academic-indicators-reports/<uuid:student_id>/<uuid:period_id>/",
        AcademicIndicatorsReportByStudentPeriodView.as_view(),
        name="academic-indicators-report-by-student-period",
    ),
    path(
        "api/academic-grades/bulletin/",
        AcademicGradesBulletinPdfView.as_view(),
        name="academic-grades-bulletin-pdf",
    ),
    # API
    path("api/", include(router.urls)),
    # OpenAPI / Swagger
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
