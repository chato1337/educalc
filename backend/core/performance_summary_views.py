"""Manual triggers for performance summary (desempeño) recalculation."""
import logging

from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AcademicPeriod, AcademicYear, Campus, GradeLevel, Group, Institution
from .performance_summary_service import (
    collect_sync_pairs_for_grade_scope,
    collect_sync_pairs_for_institution_scope,
    sync_many_group_periods,
)

logger = logging.getLogger(__name__)


class PerformanceSummaryRecalculateByGradeRequestSerializer(serializers.Serializer):
    """Body for POST /api/performance-summaries/recalculate-by-grade/."""

    grade_level = serializers.UUIDField(
        help_text="UUID del nivel (grado), p. ej. SEXTO.",
    )
    academic_year = serializers.UUIDField(
        help_text="UUID del año lectivo del cohorte.",
    )
    campus = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID de sede opcional: solo grupos de esa sede.",
    )
    academic_period = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID del periodo académico opcional; si se omite se usan todos los periodos que tengan notas (modo desde notas).",
    )
    sync_all_group_period_combinations = serializers.BooleanField(
        required=False,
        default=False,
        help_text=(
            "Si es true, recalcula el producto cartesiano grupo × periodos del año "
            "(o solo el periodo indicado), aunque aún no existan notas."
        ),
    )


PerformanceSummaryRecalculateByGradeResponseSerializer = inline_serializer(
    name="PerformanceSummaryRecalculateByGradeResponse",
    fields={
        "pairs_synced": serializers.IntegerField(
            help_text="Número de pares (grupo, periodo) ejecutados.",
        ),
        "groups_in_scope": serializers.IntegerField(
            help_text="Cantidad de grupos que coinciden con grado + año (+ sede).",
        ),
        "mode": serializers.ChoiceField(
            choices=["from_grades", "all_combinations"],
            help_text="from_grades: solo pares con al menos una nota; all_combinations: producto completo.",
        ),
    },
)


class PerformanceSummaryRecalculateByGradeView(APIView):
    """
    Recalcula resúmenes de desempeño (``PerformanceSummary``) para todos los grupos
    que pertenecen a un mismo grado (``GradeLevel``) dentro de un año lectivo.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Recalcular desempeño por grado",
        description=(
            "Ejecuta manualmente el mismo proceso que al guardar notas: promedios por periodo, "
            "promedio definitivo agregado desde notas y puestos por grupo. "
            "Por defecto solo considera pares (grupo, periodo) donde ya existen calificaciones; "
            "use ``sync_all_group_period_combinations`` para forzar todos los grupos del grado "
            "y todos los periodos del año (útil para limpiar o inicializar filas)."
        ),
        tags=["Performance Summaries"],
        request=PerformanceSummaryRecalculateByGradeRequestSerializer,
        responses={
            200: PerformanceSummaryRecalculateByGradeResponseSerializer,
        },
        examples=[
            OpenApiExample(
                "Por grado y año (desde notas)",
                value={
                    "grade_level": "00000000-0000-4000-8000-000000000001",
                    "academic_year": "00000000-0000-4000-8000-000000000002",
                },
                request_only=True,
            ),
            OpenApiExample(
                "Con sede y un solo periodo",
                value={
                    "grade_level": "00000000-0000-4000-8000-000000000001",
                    "academic_year": "00000000-0000-4000-8000-000000000002",
                    "campus": "00000000-0000-4000-8000-000000000003",
                    "academic_period": "00000000-0000-4000-8000-000000000004",
                },
                request_only=True,
            ),
            OpenApiExample(
                "Producto completo grupo × periodos",
                value={
                    "grade_level": "00000000-0000-4000-8000-000000000001",
                    "academic_year": "00000000-0000-4000-8000-000000000002",
                    "sync_all_group_period_combinations": True,
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        ser = PerformanceSummaryRecalculateByGradeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        grade_level_id = data["grade_level"]
        academic_year_id = data["academic_year"]
        campus_id = data.get("campus")
        academic_period_id = data.get("academic_period")
        sync_all = data.get("sync_all_group_period_combinations", False)

        try:
            grade_level = GradeLevel.objects.get(pk=grade_level_id)
        except GradeLevel.DoesNotExist:
            return Response(
                {"detail": "grade_level not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            academic_year = AcademicYear.objects.get(pk=academic_year_id)
        except AcademicYear.DoesNotExist:
            return Response(
                {"detail": "academic_year not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if grade_level.institution_id != academic_year.institution_id:
            return Response(
                {
                    "detail": "grade_level and academic_year must belong to the same institution."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if campus_id is not None:
            try:
                campus = Campus.objects.get(pk=campus_id)
            except Campus.DoesNotExist:
                return Response(
                    {"detail": "campus not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if campus.institution_id != academic_year.institution_id:
                return Response(
                    {"detail": "campus must belong to the same institution as academic_year."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if academic_period_id is not None:
            try:
                period = AcademicPeriod.objects.get(pk=academic_period_id)
            except AcademicPeriod.DoesNotExist:
                return Response(
                    {"detail": "academic_period not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if period.academic_year_id != academic_year.id:
                return Response(
                    {
                        "detail": "academic_period must belong to the same academic_year as requested."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        groups_qs = Group.objects.filter(
            grade_level_id=grade_level_id,
            academic_year_id=academic_year_id,
        )
        if campus_id is not None:
            groups_qs = groups_qs.filter(campus_id=campus_id)
        groups_in_scope = groups_qs.count()

        pairs = collect_sync_pairs_for_grade_scope(
            grade_level_id=grade_level_id,
            academic_year_id=academic_year_id,
            campus_id=campus_id,
            academic_period_id=academic_period_id,
            sync_all_group_period_combinations=sync_all,
        )

        logger.info(
            "performance_summary_manual_recalc_by_grade user_id=%s grade_level_id=%s "
            "academic_year_id=%s campus_id=%s academic_period_id=%s sync_all=%s pairs=%d groups=%d",
            getattr(request.user, "id", None),
            grade_level_id,
            academic_year_id,
            campus_id,
            academic_period_id,
            sync_all,
            len(pairs),
            groups_in_scope,
        )

        sync_many_group_periods(pairs)

        return Response(
            {
                "pairs_synced": len(pairs),
                "groups_in_scope": groups_in_scope,
                "mode": "all_combinations" if sync_all else "from_grades",
            },
            status=status.HTTP_200_OK,
        )


class PerformanceSummaryRecalculateByInstitutionRequestSerializer(serializers.Serializer):
    """Body for POST /api/performance-summaries/recalculate-by-institution/."""

    institution = serializers.UUIDField(
        help_text="UUID de la institución: todos los grupos cuyo año lectivo pertenece a ella.",
    )
    academic_year = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Opcional: acota a un solo año lectivo de la institución.",
    )
    campus = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Opcional: solo grupos de esa sede.",
    )
    academic_period = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Opcional: limita a un periodo (debe pertenecer al año indicado o a la institución).",
    )
    sync_all_group_period_combinations = serializers.BooleanField(
        required=False,
        default=False,
        help_text=(
            "Si es true, recorre cada grupo en alcance × los periodos del año de ese grupo "
            "(o solo ``academic_period`` si viene informado y existe en ese año)."
        ),
    )


PerformanceSummaryRecalculateByInstitutionResponseSerializer = inline_serializer(
    name="PerformanceSummaryRecalculateByInstitutionResponse",
    fields={
        "pairs_synced": serializers.IntegerField(
            help_text="Número de pares (grupo, periodo) ejecutados.",
        ),
        "groups_in_scope": serializers.IntegerField(
            help_text="Cantidad de grupos de la institución en el alcance (filtros aplicados).",
        ),
        "mode": serializers.ChoiceField(
            choices=["from_grades", "all_combinations"],
            help_text="from_grades: solo pares con al menos una nota; all_combinations: producto completo.",
        ),
    },
)


class PerformanceSummaryRecalculateByInstitutionView(APIView):
    """
    Recalcula resúmenes de desempeño para **todos los grupos** de una institución
    (opcionalmente filtrados por año lectivo, sede y periodo).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Recalcular desempeño por institución",
        description=(
            "Recalcula ``PerformanceSummary`` para todos los grupos cuyo ``AcademicYear`` "
            "pertenece a la institución indicada. Sin ``academic_year`` incluye **todos** los "
            "años lectivos de esa institución (puede ser costoso). "
            "Por defecto solo sincroniza pares (grupo, periodo) con notas registradas; "
            "``sync_all_group_period_combinations`` fuerza grupo × periodos del año de cada grupo."
        ),
        tags=["Performance Summaries"],
        request=PerformanceSummaryRecalculateByInstitutionRequestSerializer,
        responses={
            200: PerformanceSummaryRecalculateByInstitutionResponseSerializer,
        },
        examples=[
            OpenApiExample(
                "Toda la institución (desde notas)",
                value={
                    "institution": "00000000-0000-4000-8000-000000000001",
                },
                request_only=True,
            ),
            OpenApiExample(
                "Un año lectivo y producto completo",
                value={
                    "institution": "00000000-0000-4000-8000-000000000001",
                    "academic_year": "00000000-0000-4000-8000-000000000002",
                    "sync_all_group_period_combinations": True,
                },
                request_only=True,
            ),
            OpenApiExample(
                "Sede y periodo concretos",
                value={
                    "institution": "00000000-0000-4000-8000-000000000001",
                    "academic_year": "00000000-0000-4000-8000-000000000002",
                    "campus": "00000000-0000-4000-8000-000000000003",
                    "academic_period": "00000000-0000-4000-8000-000000000004",
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        ser = PerformanceSummaryRecalculateByInstitutionRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        institution_id = data["institution"]
        academic_year_id = data.get("academic_year")
        campus_id = data.get("campus")
        academic_period_id = data.get("academic_period")
        sync_all = data.get("sync_all_group_period_combinations", False)

        try:
            institution = Institution.objects.get(pk=institution_id)
        except Institution.DoesNotExist:
            return Response(
                {"detail": "institution not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        academic_year = None
        if academic_year_id is not None:
            try:
                academic_year = AcademicYear.objects.get(pk=academic_year_id)
            except AcademicYear.DoesNotExist:
                return Response(
                    {"detail": "academic_year not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if academic_year.institution_id != institution.id:
                return Response(
                    {
                        "detail": "academic_year must belong to the same institution as requested."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if campus_id is not None:
            try:
                campus = Campus.objects.get(pk=campus_id)
            except Campus.DoesNotExist:
                return Response(
                    {"detail": "campus not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if campus.institution_id != institution.id:
                return Response(
                    {"detail": "campus must belong to the same institution as requested."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if academic_period_id is not None:
            try:
                period = AcademicPeriod.objects.select_related("academic_year").get(
                    pk=academic_period_id
                )
            except AcademicPeriod.DoesNotExist:
                return Response(
                    {"detail": "academic_period not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if period.academic_year.institution_id != institution.id:
                return Response(
                    {
                        "detail": "academic_period must belong to an academic year of this institution."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if academic_year is not None and period.academic_year_id != academic_year.id:
                return Response(
                    {
                        "detail": "academic_period must belong to the same academic_year as requested."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        groups_qs = Group.objects.filter(academic_year__institution_id=institution.id)
        if academic_year_id is not None:
            groups_qs = groups_qs.filter(academic_year_id=academic_year_id)
        if campus_id is not None:
            groups_qs = groups_qs.filter(campus_id=campus_id)
        groups_in_scope = groups_qs.count()

        pairs = collect_sync_pairs_for_institution_scope(
            institution_id=institution.id,
            academic_year_id=academic_year_id,
            campus_id=campus_id,
            academic_period_id=academic_period_id,
            sync_all_group_period_combinations=sync_all,
        )

        logger.info(
            "performance_summary_manual_recalc_by_institution user_id=%s institution_id=%s "
            "academic_year_id=%s campus_id=%s academic_period_id=%s sync_all=%s pairs=%d groups=%d",
            getattr(request.user, "id", None),
            institution_id,
            academic_year_id,
            campus_id,
            academic_period_id,
            sync_all,
            len(pairs),
            groups_in_scope,
        )

        sync_many_group_periods(pairs)

        return Response(
            {
                "pairs_synced": len(pairs),
                "groups_in_scope": groups_in_scope,
                "mode": "all_combinations" if sync_all else "from_grades",
            },
            status=status.HTTP_200_OK,
        )
