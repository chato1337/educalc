"""OpenAPI helpers and response schemas for activity-based grading."""

from drf_spectacular.utils import OpenApiParameter, extend_schema

from .grading_serializers import (
    ApplySuggestionBulkResponseSerializer,
    ApplySuggestionBulkSerializer,
    ApplySuggestionResponseSerializer,
    ApplySuggestionSerializer,
    BulkLoadGradingStructureStatsSerializer,
    BulkLoadStudentActivityScoresStatsSerializer,
    GradeBreakdownSerializer,
    ValidateWeightsSerializer,
)
from .openapi_utils import bulk_csv_load_schema, openapi_error_response
from .serializers import BulkLoadFileSerializer

GRADING_SCHEME_BULK_LOAD_DESCRIPTION = (
    "Carga masiva de estructura de evaluación por fila (componente → segmento → actividad). "
    "Requiere ``CourseAssignment`` existente. Referencia: ``docs/bulk_load_grading_structure.csv``. "
    "Columnas: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS (opcional), "
    "AREA_NOMBRE (opcional), DOC_DOCENTE (opcional), PERIODO_NUM, COMPONENTE_NOMBRE, COMPONENTE_PESO, "
    "COMPONENTE_ORDEN (opcional), SEGMENTO_NOMBRE, SEGMENTO_PESO, SEGMENTO_ORDEN (opcional), "
    "ACTIVIDAD_NOMBRE, ACTIVIDAD_FECHA, NOTA_MAXIMA (opcional), ACTIVIDAD_DESCRIPCION (opcional), "
    "ACTIVIDAD_ORDEN (opcional)."
)

STUDENT_ACTIVITY_SCORES_BULK_LOAD_DESCRIPTION = (
    "Carga masiva de notas por estudiante y actividad. Requiere estructura de calificación cargada. "
    "No modifica registros ``Grade``. Referencia: ``docs/bulk_load_student_activity_scores.csv``. "
    "Columnas: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS (opcional), "
    "AREA_NOMBRE (opcional), DOC_DOCENTE (opcional), PERIODO_NUM, COMPONENTE_NOMBRE, SEGMENTO_NOMBRE, "
    "ACTIVIDAD_NOMBRE, ACTIVIDAD_FECHA (opcional), NOTA, OBSERVACIONES (opcional)."
)

GRADE_SUGGESTED_DESCRIPTION = (
    "Calcula la nota sugerida del periodo a partir de las notas por actividad registradas en el "
    "``GradingScheme`` activo. Devuelve desglose por componentes, segmentos y actividades. "
    "La sugerencia no persiste en ``Grade``; el docente decide la nota oficial."
)

BREAKDOWN_DESCRIPTION = (
    "Desglose ponderado y nota sugerida para un estudiante en el esquema indicado. "
    "Requiere que los pesos de componentes y segmentos sumen 100%."
)

STUDENT_QUERY_PARAM = OpenApiParameter(
    name="student",
    type=str,
    location=OpenApiParameter.QUERY,
    required=True,
    description="UUID del estudiante.",
)

COURSE_ASSIGNMENT_QUERY_PARAM = OpenApiParameter(
    name="course_assignment",
    type=str,
    location=OpenApiParameter.QUERY,
    required=True,
    description="UUID de la asignación de curso.",
)

ACADEMIC_PERIOD_QUERY_PARAM = OpenApiParameter(
    name="academic_period",
    type=str,
    location=OpenApiParameter.QUERY,
    required=True,
    description="UUID del periodo académico.",
)


def grading_scheme_bulk_load_schema():
    return bulk_csv_load_schema(
        summary="Bulk load grading structure from CSV",
        description=GRADING_SCHEME_BULK_LOAD_DESCRIPTION,
        tags=["Grading Schemes"],
        request_serializer=BulkLoadFileSerializer,
        response_serializer=BulkLoadGradingStructureStatsSerializer,
        response_description=(
            "Estadísticas: schemes_created, components_created/updated, "
            "segments_created/updated, activities_created/updated, rows_processed, rows_skipped, errors[]."
        ),
    )


def student_activity_scores_bulk_load_schema():
    return bulk_csv_load_schema(
        summary="Bulk load student activity scores from CSV",
        description=STUDENT_ACTIVITY_SCORES_BULK_LOAD_DESCRIPTION,
        tags=["Student Activity Scores"],
        request_serializer=BulkLoadFileSerializer,
        response_serializer=BulkLoadStudentActivityScoresStatsSerializer,
        response_description=(
            "Estadísticas: created, updated, rows_processed, rows_skipped, errors[]."
        ),
    )


def grading_scheme_breakdown_schema():
    return extend_schema(
        summary="Grade breakdown and suggested grade for a student",
        description=BREAKDOWN_DESCRIPTION,
        tags=["Grading Schemes"],
        methods=["GET"],
        parameters=[STUDENT_QUERY_PARAM],
        responses={200: GradeBreakdownSerializer, **openapi_error_response()},
    )


def grading_scheme_validate_weights_schema():
    return extend_schema(
        summary="Validate component and segment weights sum to 100%",
        description=(
            "Verifica que la suma de ``weight_percent`` de componentes del esquema sea 100% "
            "y que cada componente tenga segmentos que también sumen 100%."
        ),
        tags=["Grading Schemes"],
        methods=["GET"],
        responses={200: ValidateWeightsSerializer},
    )


def grading_scheme_apply_suggestion_schema():
    return extend_schema(
        summary="Apply suggested grade to Grade.numerical_grade",
        description=(
            "Calcula la nota sugerida desde las actividades y la escribe en "
            "``Grade.numerical_grade``, asignando también ``performance_level`` "
            "según la escala de la institución. No modifica ``definitive_grade``. "
            "Crea el registro ``Grade`` si no existe."
        ),
        tags=["Grading Schemes"],
        methods=["POST"],
        request=ApplySuggestionSerializer,
        responses={200: ApplySuggestionResponseSerializer, **openapi_error_response()},
    )


APPLY_SUGGESTION_BULK_DESCRIPTION = (
    "Aplica la nota sugerida a todos los estudiantes matriculados activos del grupo "
    "del esquema que tengan **todas** las actividades calificadas (``score`` no nulo). "
    "Los estudiantes con notas incompletas se omiten y se reportan en ``skipped``. "
    "Al finalizar (si ``applied_count > 0`` y ``dry_run`` es false), recalcula "
    "``PerformanceSummary`` (promedio y ranking del periodo en el grupo). "
    "No modifica ``definitive_grade``."
)

APPLY_SUGGESTION_BULK_PREVIEW_DESCRIPTION = (
    "Vista previa de la aplicación masiva de notas sugeridas: mismo criterio de elegibilidad "
    "que ``apply-suggestion-bulk`` pero sin persistir ``Grade`` ni recalcular ranking."
)


def grading_scheme_apply_suggestion_bulk_schema():
    return extend_schema(
        summary="Apply suggested grades to eligible students in the group",
        description=APPLY_SUGGESTION_BULK_DESCRIPTION,
        tags=["Grading Schemes"],
        methods=["POST"],
        request=ApplySuggestionBulkSerializer,
        responses={200: ApplySuggestionBulkResponseSerializer, **openapi_error_response()},
    )


def grading_scheme_apply_suggestion_bulk_preview_schema():
    return extend_schema(
        summary="Preview bulk apply of suggested grades for the group",
        description=APPLY_SUGGESTION_BULK_PREVIEW_DESCRIPTION,
        tags=["Grading Schemes"],
        methods=["GET"],
        responses={200: ApplySuggestionBulkResponseSerializer, **openapi_error_response()},
    )


def grade_suggested_schema():
    return extend_schema(
        summary="Suggested grade from activity scores",
        description=GRADE_SUGGESTED_DESCRIPTION,
        tags=["Grades"],
        methods=["GET"],
        parameters=[
            STUDENT_QUERY_PARAM,
            COURSE_ASSIGNMENT_QUERY_PARAM,
            ACADEMIC_PERIOD_QUERY_PARAM,
        ],
        responses={200: GradeBreakdownSerializer, **openapi_error_response()},
    )
