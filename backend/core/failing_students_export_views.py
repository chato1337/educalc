"""CSV export of students who do not pass the academic year."""
from __future__ import annotations

from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .failing_students_report import iter_failing_students_csv
from .grading_consolidated_export_views import (
    _parse_uuid_optional,
    _parse_uuid_required,
    _safe_filename_part,
)
from .models import AcademicYear, Campus, GradeLevel, Group
from .permissions import IsCoordinator


class FailingStudentsCsvExportView(APIView):
    """
    GET /api/reports/failing-students/

    **Roles:** ``ADMIN`` or ``COORDINATOR`` only.

    **Required:** ``academic_year`` (UUID).

    **Optional filters:** ``institution`` (ADMIN only; must match the year's
    institution), ``campus``, ``group``, ``grade_level``.

    Period, subject, area and teacher are not filters: the year outcome uses
    every subject and every period of the enrollment.
    """

    permission_classes = [IsAuthenticated, IsCoordinator]

    @extend_schema(
        summary="CSV: estudiantes que reprueban el año",
        description=(
            "Descarga CSV (UTF-8 con BOM) con **una fila por estudiante de matrícula "
            "activa que no aprueba el año lectivo**. La regla es la del certificado "
            "y del boletín: la definitiva de cada asignatura es el promedio oficial "
            "de las notas efectivas de todos los periodos (``definitive_grade`` si "
            "existe y, si no, ``numerical_grade``). El estudiante reprueba cuando "
            "alguna definitiva queda por debajo del mínimo de Básico, o cuando "
            "alguna asignatura sigue sin definitiva. Quien tiene todas las "
            "definitivas en ese mínimo o por encima no sale en el archivo. "
            "``detalle_reprobacion`` lista solo las asignaturas que causan la "
            "reprobación (``2.90`` o ``PENDIENTE``). "
            "No se filtra por periodo, asignatura, área ni docente: recortar ese "
            "conjunto cambiaría el resultado del año. "
            "**COORDINATOR:** el conjunto queda restringido al ``UserProfile.institution`` "
            "del usuario. **ADMIN:** sin ``institution`` se exporta el año lectivo "
            "indicado; con ``institution`` se valida que coincida con la institución "
            "del año."
        ),
        tags=["Reports"],
        parameters=[
            OpenApiParameter(
                name="academic_year",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=True,
                description="UUID del año lectivo (define cohorte e institución).",
            ),
            OpenApiParameter(
                name="institution",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Solo ADMIN: debe ser la misma institución del año lectivo (doble chequeo).",
            ),
            OpenApiParameter(
                name="campus",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por sede (de la misma institución del año).",
            ),
            OpenApiParameter(
                name="group",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por grupo (del mismo año lectivo).",
            ),
            OpenApiParameter(
                name="grade_level",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por nivel/grado (de la misma institución).",
            ),
        ],
        responses={
            (200, "text/csv"): OpenApiTypes.BINARY,
            400: OpenApiResponse(description="Parámetros inválidos o combinación no permitida."),
            403: OpenApiResponse(description="Sin permiso (solo ADMIN/COORDINATOR)."),
            404: OpenApiResponse(description="Año lectivo no encontrado."),
        },
    )
    def get(self, request):
        try:
            year_id = _parse_uuid_required(
                request.query_params.get("academic_year"), name="academic_year"
            )
            institution_param = _parse_uuid_optional(
                request.query_params.get("institution"), name="institution"
            )
            campus_id = _parse_uuid_optional(request.query_params.get("campus"), name="campus")
            group_id = _parse_uuid_optional(request.query_params.get("group"), name="group")
            grade_level_id = _parse_uuid_optional(
                request.query_params.get("grade_level"), name="grade_level"
            )
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        profile = getattr(request.user, "profile", None)
        if not profile:
            return Response(
                {"detail": "User profile required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        academic_year = AcademicYear.objects.select_related("institution").filter(pk=year_id).first()
        if not academic_year:
            return Response(
                {"detail": "Academic year not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        year_institution_id = academic_year.institution_id

        if profile.role == "COORDINATOR":
            if not profile.institution_id or profile.institution_id != year_institution_id:
                return Response(
                    {"detail": "Academic year is outside your institution scope."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif profile.role == "ADMIN":
            if institution_param and institution_param != year_institution_id:
                return Response(
                    {
                        "detail": "Query parameter `institution` must match the academic year's institution."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if campus_id and not Campus.objects.filter(
            pk=campus_id, institution_id=year_institution_id
        ).exists():
            return Response(
                {"detail": "`campus` is invalid for this academic year's institution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if group_id and not Group.objects.filter(
            pk=group_id, academic_year_id=year_id, campus__institution_id=year_institution_id
        ).exists():
            return Response(
                {"detail": "`group` is invalid for this academic year / institution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if grade_level_id and not GradeLevel.objects.filter(
            pk=grade_level_id, institution_id=year_institution_id
        ).exists():
            return Response(
                {"detail": "`grade_level` is invalid for this institution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filters: dict = {
            "academic_year_id": year_id,
            "institution_id": year_institution_id,
        }
        if campus_id:
            filters["campus_id"] = campus_id
        if group_id:
            filters["group_id"] = group_id
        if grade_level_id:
            filters["grade_level_id"] = grade_level_id

        filename = (
            f"estudiantes_reprobados_{academic_year.year}_"
            f"{_safe_filename_part(academic_year.institution.name)}.csv"
        )
        response = StreamingHttpResponse(
            iter_failing_students_csv(filters),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
