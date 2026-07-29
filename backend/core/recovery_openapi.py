"""OpenAPI helpers for grade recoveries."""
from drf_spectacular.utils import OpenApiParameter, extend_schema

from .serializers import (
    GradeRecoveryCreateSerializer,
    GradeRecoverySerializer,
    GradeSerializer,
)


def grade_recovery_create_schema():
    return extend_schema(
        summary="Apply grade recovery",
        description=(
            "Registra una recuperación para una calificación en escala Baja (BJ) "
            "y sobrescribe ``Grade.definitive_grade`` con ``recovery_grade``. "
            "El alcance por rol aplica como en ``/api/grades/`` "
            "(docente: solo sus asignaciones)."
        ),
        request=GradeRecoveryCreateSerializer,
        responses={201: GradeRecoverySerializer},
    )


_ELIGIBLE_FILTER_PARAMS = [
    OpenApiParameter(
        name="student",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por UUID de estudiante.",
    ),
    OpenApiParameter(
        name="course_assignment",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por UUID de asignación docente-curso.",
    ),
    OpenApiParameter(
        name="course_assignment__group",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por UUID de grupo.",
    ),
    OpenApiParameter(
        name="course_assignment__academic_year",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por UUID de año lectivo.",
    ),
    OpenApiParameter(
        name="course_assignment__teacher__document_number",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por documento exacto del docente.",
    ),
    OpenApiParameter(
        name="course_assignment__subject__academic_area",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por UUID de área académica.",
    ),
    OpenApiParameter(
        name="academic_period",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por UUID de periodo académico.",
    ),
    OpenApiParameter(
        name="academic_period__number",
        type=int,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filtrar por número de periodo (1–4).",
    ),
    OpenApiParameter(
        name="search",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description=(
            "Búsqueda en documento/nombre del estudiante, asignatura, "
            "grupo y periodo."
        ),
    ),
    OpenApiParameter(
        name="hide_recovered",
        type=bool,
        location=OpenApiParameter.QUERY,
        required=False,
        description=(
            "Si es true (1/true/yes/si), excluye calificaciones que ya tienen "
            "al menos una recuperación registrada."
        ),
    ),
]


def grade_recovery_eligible_schema():
    return extend_schema(
        summary="List grades eligible for recovery (Bajo scale)",
        description=(
            "Devuelve calificaciones cuya ``numerical_grade`` está en la escala "
            "Bajo (BJ) de la institución. Si no existe esa escala, usa "
            "``max_score = 2.99`` como fallback. Respuesta paginada de ``Grade``. "
            "Scope por rol como ``/api/grades/``. "
            "Con ``hide_recovered=true`` se ocultan las que ya tienen recuperación."
        ),
        parameters=_ELIGIBLE_FILTER_PARAMS,
        responses={200: GradeSerializer(many=True)},
    )
