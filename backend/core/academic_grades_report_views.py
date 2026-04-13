"""PDF bulletin endpoint for academic grades (boletín)."""
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .bulletin_service import bulletin_pdf_for_group_request, bulletin_pdf_for_request


class AcademicGradesBulletinPdfView(APIView):
    """
    GET /api/academic-grades/bulletin/

    Returns a PDF built from ``core/templates/core/academic_grades_bulletin.html`` (WeasyPrint).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Download bulletin PDF (grades)",
        description="**Single student:** pass `student` + `academic_year` (active enrollment). "
        "**Whole group:** pass `group` + `academic_year` where the group belongs to that year — returns one PDF with one boletín per active student, in name order. "
        "Optional `period_ids` (comma-separated academic period UUIDs) limits columns. "
        "Provide **exactly one** of `student` or `group`. "
        "Query param `grade_level_ids` is ignored (reserved for compatibility).",
        tags=["Grades"],
        parameters=[
            OpenApiParameter(
                name="student",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Student UUID (single-boletín mode; mutually exclusive with `group`).",
            ),
            OpenApiParameter(
                name="group",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Group UUID (multi-boletín PDF for all active enrollments in that group; mutually exclusive with `student`).",
            ),
            OpenApiParameter(
                name="academic_year",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=True,
                description="Academic year UUID (must match the group's year in group mode).",
            ),
            OpenApiParameter(
                name="period_ids",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Comma-separated academic period UUIDs to include (subset of the year's periods).",
            ),
            OpenApiParameter(
                name="grade_level_ids",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Ignored. Reserved for future use.",
            ),
        ],
        responses={
            (200, "application/pdf"): OpenApiTypes.BINARY,
        },
    )
    def get(self, request):
        student = request.query_params.get("student")
        group = request.query_params.get("group")
        academic_year = request.query_params.get("academic_year")
        if not academic_year:
            return Response(
                {"detail": "Query parameter `academic_year` is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        has_student = bool(student and str(student).strip())
        has_group = bool(group and str(group).strip())
        if has_student == has_group:
            return Response(
                {
                    "detail": "Provide exactly one of `student` or `group`, together with `academic_year`.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            yid = UUID(academic_year.strip())
        except ValueError:
            return Response(
                {"detail": "Invalid UUID for academic_year."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            if has_student:
                sid = UUID(str(student).strip())
                return bulletin_pdf_for_request(
                    student_id=sid,
                    academic_year_id=yid,
                    period_ids_raw=request.query_params.get("period_ids"),
                    grade_level_ids_raw=request.query_params.get("grade_level_ids"),
                )
            gid = UUID(str(group).strip())
            return bulletin_pdf_for_group_request(
                group_id=gid,
                academic_year_id=yid,
                period_ids_raw=request.query_params.get("period_ids"),
                grade_level_ids_raw=request.query_params.get("grade_level_ids"),
            )
        except ValueError as e:
            msg = str(e).lower()
            if "badly formed" in msg or "hexadecimal" in msg:
                return Response(
                    {"detail": "Invalid UUID for student or group."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
