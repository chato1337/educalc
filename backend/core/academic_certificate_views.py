"""PDF certificate endpoint for the student year outcome."""
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .certificate_service import (
    certificate_pdf_for_group_request,
    certificate_pdf_for_request,
)
from .scope_utils import (
    user_can_access_academic_year,
    user_can_access_group,
    user_can_access_student,
)


class AcademicCertificatePdfView(APIView):
    """
    GET /api/academic-grades/certificate/

    One PDF for a student, or one PDF with a certificate per active student in a group.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Download student certificate PDF",
        description=(
            "Returns the year certificate. The student passes when every subject "
            "definitive (official average of the period grades) is at or above "
            "Básico. One definitive below that minimum means the year is lost. "
            "**Single student:** `student` + `academic_year`. "
            "**Whole group:** `group` + `academic_year`. "
            "Provide exactly one of `student` or `group`. "
            "Optional `issued_on` is the expedition date (`YYYY-MM-DD`); the default is today."
        ),
        tags=["Grades"],
        parameters=[
            OpenApiParameter(
                name="student",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Student UUID. Mutually exclusive with `group`.",
            ),
            OpenApiParameter(
                name="group",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Group UUID. One certificate per active student.",
            ),
            OpenApiParameter(
                name="academic_year",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=True,
            ),
            OpenApiParameter(
                name="issued_on",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Expedition date, YYYY-MM-DD. Defaults to today.",
            ),
        ],
        responses={(200, "application/pdf"): OpenApiTypes.BINARY},
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
            year_id = UUID(academic_year.strip())
        except ValueError:
            return Response(
                {"detail": "Invalid UUID for academic_year."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            if has_student:
                student_id = UUID(str(student).strip())
                if not user_can_access_student(request, student_id):
                    return Response(
                        {"detail": "Student not found or not accessible for your role."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                if not user_can_access_academic_year(request, year_id):
                    return Response(
                        {"detail": "Academic year not found or not accessible for your role."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                return certificate_pdf_for_request(
                    student_id=student_id,
                    academic_year_id=year_id,
                    issued_on_raw=request.query_params.get("issued_on"),
                )
            group_id = UUID(str(group).strip())
            if not user_can_access_group(request, group_id):
                return Response(
                    {"detail": "Group not found or not accessible for your role."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if not user_can_access_academic_year(request, year_id):
                return Response(
                    {"detail": "Academic year not found or not accessible for your role."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return certificate_pdf_for_group_request(
                group_id=group_id,
                academic_year_id=year_id,
                issued_on_raw=request.query_params.get("issued_on"),
            )
        except ValueError as exc:
            message = str(exc).lower()
            if "badly formed" in message or "hexadecimal" in message:
                return Response(
                    {"detail": "Invalid UUID for student or group."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
