"""ViewSets for activity-based grading module."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .bulk_load_grading import (
    bulk_load_grading_structure,
    bulk_load_student_activity_scores,
)
from .grading_openapi import (
    grading_scheme_apply_suggestion_schema,
    grading_scheme_breakdown_schema,
    grading_scheme_bulk_load_schema,
    grading_scheme_validate_weights_schema,
    student_activity_scores_bulk_load_schema,
)
from .grading_serializers import (
    ApplySuggestionSerializer,
    ComponentSegmentSerializer,
    GradingActivitySerializer,
    GradingSchemeSerializer,
    StudentActivityScoreSerializer,
    SubjectComponentSerializer,
    scheme_weights_error,
)
from .grading_suggestion_service import build_grade_breakdown, compute_suggested_grade
from .indicator_utils import resolve_grading_scale_for_score
from .models import GradingScale
from .models import (
    ComponentSegment,
    Grade,
    GradingActivity,
    GradingScheme,
    Student,
    StudentActivityScore,
    SubjectComponent,
)
from .permissions import IsAdminUserOrReadOnlyStaff, IsTeacher, RoleScopeMixin
from .views import _bulk_csv_response, schema_viewset


def _course_assignment_institution_filter(queryset, institution_id):
    return queryset.filter(
        course_assignment__subject__institution_id=institution_id
    )


def _component_institution_filter(queryset, institution_id):
    return queryset.filter(subject__institution_id=institution_id)


def _segment_institution_filter(queryset, institution_id):
    return queryset.filter(
        grading_scheme__course_assignment__subject__institution_id=institution_id
    )


def _activity_institution_filter(queryset, institution_id):
    return queryset.filter(
        segment__grading_scheme__course_assignment__subject__institution_id=institution_id
    )


def _score_institution_filter(queryset, institution_id):
    return queryset.filter(
        activity__segment__grading_scheme__course_assignment__subject__institution_id=institution_id
    )


class GradingRoleScopeMixin(RoleScopeMixin):
    institution_filter = _course_assignment_institution_filter

    def _filter_by_institution(self, queryset, institution_id):
        return self.institution_filter(queryset, institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(course_assignment__teacher=teacher)


class SubjectComponentRoleScopeMixin(RoleScopeMixin):
    institution_filter = _component_institution_filter

    def _filter_by_institution(self, queryset, institution_id):
        return self.institution_filter(queryset, institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        profile = getattr(request.user, "profile", None)
        if profile and profile.institution_id:
            return queryset.filter(subject__institution_id=profile.institution_id)
        return queryset.none()


class ComponentSegmentRoleScopeMixin(GradingRoleScopeMixin):
    institution_filter = _segment_institution_filter

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(
            grading_scheme__course_assignment__teacher=teacher
        )


class GradingActivityRoleScopeMixin(GradingRoleScopeMixin):
    institution_filter = _activity_institution_filter

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(
            segment__grading_scheme__course_assignment__teacher=teacher
        )


class StudentActivityScoreRoleScopeMixin(GradingRoleScopeMixin):
    institution_filter = _score_institution_filter

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(
            activity__segment__grading_scheme__course_assignment__teacher=teacher
        )


@schema_viewset(
    ["Grading Schemes"],
    "Esquema ponderado de evaluación por asignación de curso y periodo académico. "
    "Los componentes son catálogo por asignatura (admin); los docentes configuran segmentos. "
    "La nota sugerida calculada es autocompletado; la nota oficial permanece en Grade.",
    search_fields=[
        "course_assignment__subject__name",
        "course_assignment__group__name",
        "course_assignment__teacher__full_name",
        "academic_period__name",
    ],
    filter_fields=[
        "course_assignment",
        "course_assignment__group",
        "academic_period",
        "is_active",
    ],
)
class GradingSchemeViewSet(GradingRoleScopeMixin, viewsets.ModelViewSet):
    queryset = GradingScheme.objects.select_related(
        "course_assignment",
        "course_assignment__subject",
        "course_assignment__group",
        "course_assignment__teacher",
        "academic_period",
    ).all()
    serializer_class = GradingSchemeSerializer
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = [
        "course_assignment",
        "course_assignment__group",
        "academic_period",
        "is_active",
    ]
    search_fields = [
        "course_assignment__subject__name",
        "course_assignment__group__name",
        "course_assignment__teacher__full_name",
        "academic_period__name",
    ]

    def get_queryset(self):
        return self.filter_queryset_by_role(super().get_queryset(), self.request)

    @grading_scheme_bulk_load_schema()
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_grading_structure)

    @grading_scheme_breakdown_schema()
    @action(detail=True, methods=["get"], url_path="breakdown")
    def breakdown(self, request, pk=None):
        scheme = self.get_object()
        student_id = request.query_params.get("student")
        if not student_id:
            return Response(
                {"error": "El parámetro student es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        student = get_object_or_404(Student, pk=student_id)
        weight_error = scheme_weights_error(scheme)
        if weight_error:
            return Response(
                {"error": weight_error},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            data = build_grade_breakdown(student, scheme)
        except DjangoValidationError as exc:
            messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
            return Response(
                {"error": messages[0] if messages else "Error de validación."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(data)

    @grading_scheme_validate_weights_schema()
    @action(detail=True, methods=["get"], url_path="validate-weights")
    def validate_weights(self, request, pk=None):
        scheme = self.get_object()
        error = scheme_weights_error(scheme)
        if error:
            return Response({"valid": False, "message": error})
        return Response({"valid": True, "message": ""})

    @grading_scheme_apply_suggestion_schema()
    @action(detail=True, methods=["post"], url_path="apply-suggestion")
    def apply_suggestion(self, request, pk=None):
        scheme = self.get_object()
        serializer = ApplySuggestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = get_object_or_404(Student, pk=serializer.validated_data["student"])
        weight_error = scheme_weights_error(scheme)
        if weight_error:
            return Response(
                {"error": weight_error},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            suggested = compute_suggested_grade(student, scheme)
        except DjangoValidationError as exc:
            messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
            return Response(
                {"error": messages[0] if messages else "Error de validación."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if suggested is None:
            return Response(
                {"error": "No hay notas suficientes para calcular una sugerencia."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        institution_id = scheme.course_assignment.subject.institution_id
        scales = list(
            GradingScale.objects.filter(institution_id=institution_id).order_by(
                "-min_score"
            )
        )
        performance_level = resolve_grading_scale_for_score(suggested, scales)
        grade, created = Grade.objects.get_or_create(
            student=student,
            course_assignment=scheme.course_assignment,
            academic_period=scheme.academic_period,
            defaults={
                "numerical_grade": suggested,
                "performance_level": performance_level,
            },
        )
        if not created:
            grade.numerical_grade = suggested
            grade.performance_level = performance_level
            grade.save(
                update_fields=[
                    "numerical_grade",
                    "performance_level",
                    "updated_at",
                ]
            )
        return Response(
            {
                "grade_id": str(grade.id),
                "numerical_grade": grade.numerical_grade,
                "performance_level": (
                    str(grade.performance_level_id)
                    if grade.performance_level_id
                    else None
                ),
                "performance_level_name": (
                    grade.performance_level.name if grade.performance_level else None
                ),
                "definitive_grade": grade.definitive_grade,
                "created": created,
            }
        )


@schema_viewset(
    ["Subject Components"],
    "Catálogo de dimensiones de evaluación por asignatura (ej. cognitivo, actitudinal). "
    "Solo administradores pueden crear o modificar; los pesos deben sumar 100% por asignatura.",
    search_fields=["name", "subject__name"],
    filter_fields=["subject"],
)
class SubjectComponentViewSet(SubjectComponentRoleScopeMixin, viewsets.ModelViewSet):
    queryset = SubjectComponent.objects.select_related("subject").all()
    serializer_class = SubjectComponentSerializer
    permission_classes = [IsAuthenticated, IsAdminUserOrReadOnlyStaff]
    filterset_fields = ["subject"]
    search_fields = ["name", "subject__name"]

    def get_queryset(self):
        return self.filter_queryset_by_role(super().get_queryset(), self.request)


@schema_viewset(
    ["Component Segments"],
    "Subdivisiones configurables por el docente dentro de un componente de la asignatura. "
    "Los pesos de segmentos deben sumar 100% dentro de cada componente del esquema.",
    search_fields=["name", "subject_component__name"],
    filter_fields=["grading_scheme", "subject_component", "subject_component__subject"],
)
class ComponentSegmentViewSet(ComponentSegmentRoleScopeMixin, viewsets.ModelViewSet):
    queryset = ComponentSegment.objects.select_related(
        "grading_scheme",
        "subject_component",
    ).all()
    serializer_class = ComponentSegmentSerializer
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = [
        "grading_scheme",
        "subject_component",
        "subject_component__subject",
    ]
    search_fields = ["name", "subject_component__name"]

    def get_queryset(self):
        return self.filter_queryset_by_role(super().get_queryset(), self.request)


@schema_viewset(
    ["Grading Activities"],
    "Actividades puntuales dentro de un segmento (plantilla compartida por el grupo).",
    search_fields=["name", "segment__name"],
    filter_fields=[
        "segment",
        "segment__grading_scheme",
        "segment__subject_component",
    ],
)
class GradingActivityViewSet(GradingActivityRoleScopeMixin, viewsets.ModelViewSet):
    queryset = GradingActivity.objects.select_related(
        "segment",
        "segment__subject_component",
    ).all()
    serializer_class = GradingActivitySerializer
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = [
        "segment",
        "segment__grading_scheme",
        "segment__subject_component",
    ]
    search_fields = ["name", "segment__name"]

    def get_queryset(self):
        return self.filter_queryset_by_role(super().get_queryset(), self.request)


@schema_viewset(
    ["Student Activity Scores"],
    "Notas individuales de estudiantes por actividad. score null = pendiente. "
    "No actualiza Grade automáticamente.",
    search_fields=[
        "student__full_name",
        "student__document_number",
        "activity__name",
    ],
    filter_fields=[
        "activity",
        "student",
        "student__document_number",
        "activity__segment",
        "activity__segment__grading_scheme",
    ],
)
class StudentActivityScoreViewSet(
    StudentActivityScoreRoleScopeMixin, viewsets.ModelViewSet
):
    queryset = StudentActivityScore.objects.select_related(
        "student",
        "activity",
        "activity__segment",
    ).all()
    serializer_class = StudentActivityScoreSerializer
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = [
        "activity",
        "student",
        "student__document_number",
        "activity__segment",
        "activity__segment__grading_scheme",
    ]
    search_fields = [
        "student__full_name",
        "student__document_number",
        "activity__name",
    ]

    def get_queryset(self):
        return self.filter_queryset_by_role(super().get_queryset(), self.request)

    @student_activity_scores_bulk_load_schema()
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_student_activity_scores)
