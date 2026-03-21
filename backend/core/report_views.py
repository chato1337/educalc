"""Composite report endpoints for Phase 8."""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AcademicIndicatorsReport,
    AcademicPeriod,
    AcademicYear,
    Enrollment,
    GradeDirector,
    SchoolRecord,
    Student,
)
from .serializers import (
    AcademicIndicatorsReportSerializer,
    SchoolRecordSerializer,
)


class SchoolRecordByStudentYearView(APIView):
    """GET /api/school-records/generate/{student_id}/{academic_year_id}/ - Generate/retrieve school record."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate school record by student and year",
        description="Get or create the School Assessment Record for a student in an academic year. "
        "Requires an active enrollment for the student in that year.",
        tags=["School Records"],
        parameters=[
            OpenApiParameter(name="student_id", type=str, location="path", required=True),
            OpenApiParameter(name="academic_year_id", type=str, location="path", required=True),
        ],
        responses={200: SchoolRecordSerializer},
    )
    def get(self, request, student_id, academic_year_id):
        student = get_object_or_404(Student, pk=student_id)
        academic_year = get_object_or_404(AcademicYear, pk=academic_year_id)

        enrollment = Enrollment.objects.filter(
            student=student, academic_year=academic_year, status="active"
        ).select_related("group__campus__institution").first()

        if not enrollment:
            return Response(
                {"detail": "No active enrollment found for this student in the given academic year."},
                status=status.HTTP_404_NOT_FOUND,
            )

        group = enrollment.group
        institution = group.campus.institution
        campus = group.campus

        record, created = SchoolRecord.objects.get_or_create(
            student=student,
            academic_year=academic_year,
            defaults={
                "group": group,
                "institution": institution,
                "campus": campus,
                "generated_at": enrollment.created_at or timezone.now(),
            },
        )
        if not created:
            record.generated_at = timezone.now()
            record.save(update_fields=["generated_at", "updated_at"])

        serializer = SchoolRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AcademicIndicatorsReportByStudentPeriodView(APIView):
    """GET /api/academic-indicators-reports/generate/{student_id}/{period_id}/ - Generate/retrieve indicators report."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate academic indicators report by student and period",
        description="Get or create the Academic Indicators Report for a student in an academic period. "
        "Requires enrollment and a grade director for the student's group.",
        tags=["Academic Indicators Reports"],
        parameters=[
            OpenApiParameter(name="student_id", type=str, location="path", required=True),
            OpenApiParameter(name="period_id", type=str, location="path", required=True),
        ],
        responses={200: AcademicIndicatorsReportSerializer},
    )
    def get(self, request, student_id, period_id):
        student = get_object_or_404(Student, pk=student_id)
        academic_period = get_object_or_404(AcademicPeriod, pk=period_id)
        academic_year = academic_period.academic_year

        enrollment = Enrollment.objects.filter(
            student=student, academic_year=academic_year, status="active"
        ).select_related("group").first()

        if not enrollment:
            return Response(
                {"detail": "No active enrollment found for this student in the period's academic year."},
                status=status.HTTP_404_NOT_FOUND,
            )

        group = enrollment.group
        grade_director = GradeDirector.objects.filter(
            group=group, academic_year=academic_year
        ).select_related("teacher").first()

        if not grade_director:
            return Response(
                {"detail": "No grade director assigned for this group in the academic year."},
                status=status.HTTP_404_NOT_FOUND,
            )

        record, created = AcademicIndicatorsReport.objects.get_or_create(
            student=student,
            academic_period=academic_period,
            defaults={
                "group": group,
                "grade_director": grade_director.teacher,
                "generated_at": timezone.now(),
            },
        )

        serializer = AcademicIndicatorsReportSerializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)
