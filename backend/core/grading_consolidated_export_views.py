"""CSV export: pivoted consolidated grading per student (subjects as columns)."""
from __future__ import annotations

import re
from uuid import UUID

from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .grading_consolidated_report import iter_grading_consolidated_csv
from .models import (
    AcademicArea,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    GradeLevel,
    Group,
    Subject,
)
from .permissions import IsCoordinator


def _parse_uuid_optional(raw: str | None, *, name: str) -> UUID | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return UUID(str(raw).strip())
    except (ValueError, TypeError, AttributeError):
        raise serializers.ValidationError({name: ["Must be a valid UUID."]})


def _parse_uuid_required(raw: str | None, *, name: str) -> UUID:
    v = _parse_uuid_optional(raw, name=name)
    if v is None:
        raise serializers.ValidationError({name: ["This field is required."]})
    return v


def _safe_filename_part(s: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", s, flags=re.UNICODE)[:80] or "export"


class GradingConsolidatedCsvExportView(APIView):
    """
    GET /api/reports/grading-consolidated/

    **Roles:** ``ADMIN`` or ``COORDINATOR`` only (internal audit).

    **Required:** ``academic_year`` (UUID).

    **Optional filters:** ``academic_period``, ``institution`` (ADMIN only; must match the year's
    institution), ``campus``, ``group``, ``grade_level``, ``academic_area``, ``teacher``, ``subject``.
    """

    permission_classes = [IsAuthenticated, IsCoordinator]

    @extend_schema(
        summary="CSV: consolidado de calificaciones pivoteado por estudiante",
        description=(
            "Descarga CSV (UTF-8 con BOM) con **una única fila por estudiante** (matrícula "
            "activa) y **una columna por asignatura**. Cuando la exportación cubre más de un "
            "periodo, cada asignatura se despliega en varias columnas con el sufijo "
            "``(P1)``, ``(P2)``, … por número de periodo. "
            "El valor de cada celda es la nota numérica (o la definitiva si no hay numérica) "
            "para esa terna (estudiante, asignatura, periodo); una celda vacía significa "
            "**PENDIENTE**. Al final se incluyen columnas de resumen "
            "``asignaturas_calificadas``, ``asignaturas_pendientes`` y ``promedio_numerico`` "
            "(promedio simple sobre las notas existentes del estudiante). "
            "La consulta base usa un único ``SELECT`` con ``JOIN``/``LEFT JOIN`` (sin "
            "subconsultas correlacionadas por fila); el pivoteo se realiza en memoria tras el "
            "fetch. "
            "**COORDINATOR:** el conjunto queda restringido al ``UserProfile.institution`` "
            "del usuario. **ADMIN:** sin ``institution`` se exporta el año lectivo indicado "
            "(una institución por año); con ``institution`` se valida que coincida con la "
            "institución del año."
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
                name="academic_period",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="UUID del periodo; si se omite, se incluyen todos los periodos del año.",
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
            OpenApiParameter(
                name="academic_area",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por área académica (misma institución).",
            ),
            OpenApiParameter(
                name="teacher",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por docente (con asignación en ese año lectivo).",
            ),
            OpenApiParameter(
                name="subject",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por asignatura (misma institución).",
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
            period_id = _parse_uuid_optional(
                request.query_params.get("academic_period"), name="academic_period"
            )
            institution_param = _parse_uuid_optional(
                request.query_params.get("institution"), name="institution"
            )
            campus_id = _parse_uuid_optional(request.query_params.get("campus"), name="campus")
            group_id = _parse_uuid_optional(request.query_params.get("group"), name="group")
            grade_level_id = _parse_uuid_optional(
                request.query_params.get("grade_level"), name="grade_level"
            )
            area_id = _parse_uuid_optional(
                request.query_params.get("academic_area"), name="academic_area"
            )
            teacher_id = _parse_uuid_optional(request.query_params.get("teacher"), name="teacher")
            subject_id = _parse_uuid_optional(request.query_params.get("subject"), name="subject")
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

        if period_id and not AcademicPeriod.objects.filter(
            pk=period_id, academic_year_id=year_id
        ).exists():
            return Response(
                {"detail": "`academic_period` is not a period of the given `academic_year`."},
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

        if area_id and not AcademicArea.objects.filter(
            pk=area_id, institution_id=year_institution_id
        ).exists():
            return Response(
                {"detail": "`academic_area` is invalid for this institution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if subject_id and not Subject.objects.filter(
            pk=subject_id, institution_id=year_institution_id
        ).exists():
            return Response(
                {"detail": "`subject` is invalid for this institution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if teacher_id and not CourseAssignment.objects.filter(
            teacher_id=teacher_id, academic_year_id=year_id
        ).exists():
            return Response(
                {"detail": "`teacher` has no course assignment in this academic year."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filters: dict = {"academic_year_id": year_id}
        filters["institution_id"] = year_institution_id

        if period_id:
            filters["academic_period_id"] = period_id
        if campus_id:
            filters["campus_id"] = campus_id
        if group_id:
            filters["group_id"] = group_id
        if grade_level_id:
            filters["grade_level_id"] = grade_level_id
        if area_id:
            filters["academic_area_id"] = area_id
        if teacher_id:
            filters["teacher_id"] = teacher_id
        if subject_id:
            filters["subject_id"] = subject_id

        filename = (
            f"consolidado_calificaciones_{academic_year.year}_"
            f"{_safe_filename_part(academic_year.institution.name)}.csv"
        )

        response = StreamingHttpResponse(
            iter_grading_consolidated_csv(filters),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
