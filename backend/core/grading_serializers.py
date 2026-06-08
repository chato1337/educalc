"""Serializers for activity-based grading module."""
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from .grading_suggestion_service import validate_scheme_weights
from .models import (
    ComponentSegment,
    GradingActivity,
    GradingScheme,
    StudentActivityScore,
    SubjectComponent,
    WEIGHT_SUM_TARGET,
)


@extend_schema_serializer(component_name="GradingScheme")
class GradingSchemeSerializer(serializers.ModelSerializer):
    course_assignment_subject_name = serializers.CharField(
        source="course_assignment.subject.name", read_only=True
    )
    course_assignment_group_name = serializers.CharField(
        source="course_assignment.group.name", read_only=True
    )
    course_assignment_teacher_name = serializers.CharField(
        source="course_assignment.teacher.full_name", read_only=True
    )
    academic_period_name = serializers.CharField(
        source="academic_period.name", read_only=True
    )
    academic_period_number = serializers.IntegerField(
        source="academic_period.number", read_only=True
    )
    subject_component_weights_valid = serializers.SerializerMethodField()
    segment_weights_valid = serializers.SerializerMethodField()

    class Meta:
        model = GradingScheme
        fields = [
            "id",
            "course_assignment",
            "course_assignment_subject_name",
            "course_assignment_group_name",
            "course_assignment_teacher_name",
            "academic_period",
            "academic_period_name",
            "academic_period_number",
            "is_active",
            "subject_component_weights_valid",
            "segment_weights_valid",
            "created_at",
            "updated_at",
        ]

    def get_subject_component_weights_valid(self, obj) -> bool:
        return obj.subject_component_weights_valid()

    def get_segment_weights_valid(self, obj) -> bool:
        return obj.segment_weights_valid()

    def validate(self, attrs):
        course_assignment = attrs.get("course_assignment") or (
            self.instance.course_assignment if self.instance else None
        )
        academic_period = attrs.get("academic_period") or (
            self.instance.academic_period if self.instance else None
        )
        if (
            course_assignment
            and academic_period
            and course_assignment.academic_year_id != academic_period.academic_year_id
        ):
            raise serializers.ValidationError(
                "La asignación de curso y el periodo deben pertenecer al mismo año lectivo."
            )
        return attrs


@extend_schema_serializer(component_name="SubjectComponent")
class SubjectComponentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = SubjectComponent
        fields = [
            "id",
            "subject",
            "subject_name",
            "name",
            "description",
            "weight_percent",
            "sort_order",
            "created_at",
            "updated_at",
        ]

    def validate_weight_percent(self, value):
        if value < 0 or value > WEIGHT_SUM_TARGET:
            raise serializers.ValidationError(
                "El peso del componente debe estar entre 0 y 100."
            )
        return value


@extend_schema_serializer(component_name="ComponentSegment")
class ComponentSegmentSerializer(serializers.ModelSerializer):
    subject_component_name = serializers.CharField(
        source="subject_component.name", read_only=True
    )

    class Meta:
        model = ComponentSegment
        fields = [
            "id",
            "grading_scheme",
            "subject_component",
            "subject_component_name",
            "name",
            "description",
            "weight_percent",
            "sort_order",
            "created_at",
            "updated_at",
        ]

    def validate_weight_percent(self, value):
        if value < 0 or value > WEIGHT_SUM_TARGET:
            raise serializers.ValidationError(
                "El peso del segmento debe estar entre 0 y 100."
            )
        return value

    def validate(self, attrs):
        grading_scheme = attrs.get("grading_scheme") or (
            self.instance.grading_scheme if self.instance else None
        )
        subject_component = attrs.get("subject_component") or (
            self.instance.subject_component if self.instance else None
        )
        if (
            grading_scheme
            and subject_component
            and grading_scheme.course_assignment.subject_id
            != subject_component.subject_id
        ):
            raise serializers.ValidationError(
                "El componente debe pertenecer a la misma asignatura del esquema."
            )
        return attrs


@extend_schema_serializer(component_name="GradingActivity")
class GradingActivitySerializer(serializers.ModelSerializer):
    segment_name = serializers.CharField(source="segment.name", read_only=True)
    component_name = serializers.CharField(
        source="segment.subject_component.name", read_only=True
    )

    class Meta:
        model = GradingActivity
        fields = [
            "id",
            "segment",
            "segment_name",
            "component_name",
            "name",
            "description",
            "activity_date",
            "max_score",
            "sort_order",
            "created_at",
            "updated_at",
        ]

    def validate_max_score(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "La nota máxima debe ser mayor que 0."
            )
        return value


@extend_schema_serializer(component_name="StudentActivityScore")
class StudentActivityScoreSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_document_number = serializers.CharField(
        source="student.document_number", read_only=True
    )
    activity_name = serializers.CharField(source="activity.name", read_only=True)
    activity_date = serializers.DateField(
        source="activity.activity_date", read_only=True
    )
    max_score = serializers.DecimalField(
        source="activity.max_score",
        max_digits=4,
        decimal_places=2,
        read_only=True,
    )
    score_pending = serializers.SerializerMethodField()

    class Meta:
        model = StudentActivityScore
        fields = [
            "id",
            "activity",
            "activity_name",
            "activity_date",
            "max_score",
            "student",
            "student_name",
            "student_document_number",
            "score",
            "score_pending",
            "notes",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "score": {"required": False, "allow_null": True},
        }

    def get_score_pending(self, obj) -> bool:
        return obj.score is None

    def validate(self, attrs):
        activity = attrs.get("activity") or (
            self.instance.activity if self.instance else None
        )
        student = attrs.get("student") or (
            self.instance.student if self.instance else None
        )
        score = attrs.get("score", serializers.empty)
        if score is serializers.empty and self.instance:
            score = self.instance.score
        if activity and score is not None:
            if score < 0 or score > activity.max_score:
                raise serializers.ValidationError(
                    {
                        "score": (
                            f"La nota debe estar entre 0 y {activity.max_score}."
                        )
                    }
                )
        if activity and student:
            instance = StudentActivityScore(
                activity=activity,
                student=student,
                score=score if score is not serializers.empty else None,
            )
            try:
                instance.clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict or exc.messages)
        return attrs


@extend_schema_serializer(component_name="ApplySuggestionRequest")
class ApplySuggestionSerializer(serializers.Serializer):
    student = serializers.UUIDField(help_text="UUID del estudiante.")

    def validate_student(self, value):
        from .models import Student

        if not Student.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Estudiante no encontrado.")
        return value


@extend_schema_serializer(component_name="GradeBreakdownActivity")
class GradeBreakdownActivitySerializer(serializers.Serializer):
    activity_id = serializers.UUIDField()
    name = serializers.CharField()
    activity_date = serializers.CharField()
    max_score = serializers.DecimalField(max_digits=4, decimal_places=2)
    score = serializers.DecimalField(
        max_digits=4, decimal_places=2, allow_null=True
    )
    notes = serializers.CharField(allow_blank=True)


@extend_schema_serializer(component_name="GradeBreakdownSegment")
class GradeBreakdownSegmentSerializer(serializers.Serializer):
    segment_id = serializers.UUIDField()
    name = serializers.CharField()
    weight_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    segment_average = serializers.DecimalField(
        max_digits=4, decimal_places=2, allow_null=True
    )
    activities = GradeBreakdownActivitySerializer(many=True)


@extend_schema_serializer(component_name="GradeBreakdownComponent")
class GradeBreakdownComponentSerializer(serializers.Serializer):
    component_id = serializers.UUIDField()
    name = serializers.CharField()
    weight_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    component_score = serializers.DecimalField(
        max_digits=4, decimal_places=2, allow_null=True
    )
    segments = GradeBreakdownSegmentSerializer(many=True)


@extend_schema_serializer(component_name="GradeBreakdown")
class GradeBreakdownSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    student_name = serializers.CharField()
    grading_scheme_id = serializers.UUIDField()
    suggested_grade = serializers.DecimalField(
        max_digits=4, decimal_places=2, allow_null=True
    )
    components = GradeBreakdownComponentSerializer(many=True)


@extend_schema_serializer(component_name="ValidateWeights")
class ValidateWeightsSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    message = serializers.CharField(allow_blank=True)


@extend_schema_serializer(component_name="ApplySuggestionResponse")
class ApplySuggestionResponseSerializer(serializers.Serializer):
    grade_id = serializers.UUIDField()
    numerical_grade = serializers.DecimalField(max_digits=4, decimal_places=2)
    performance_level = serializers.UUIDField(allow_null=True)
    performance_level_name = serializers.CharField(allow_null=True)
    definitive_grade = serializers.DecimalField(
        max_digits=4, decimal_places=2, allow_null=True
    )
    created = serializers.BooleanField(
        help_text="True si se creó un nuevo registro Grade."
    )


@extend_schema_serializer(component_name="BulkLoadGradingStructureStats")
class BulkLoadGradingStructureStatsSerializer(serializers.Serializer):
    rows_processed = serializers.IntegerField()
    rows_skipped = serializers.IntegerField()
    schemes_created = serializers.IntegerField()
    components_created = serializers.IntegerField()
    components_updated = serializers.IntegerField()
    segments_created = serializers.IntegerField()
    segments_updated = serializers.IntegerField()
    activities_created = serializers.IntegerField()
    activities_updated = serializers.IntegerField()
    errors = serializers.ListField(
        child=serializers.DictField(), help_text="Lista de {row, error}."
    )


@extend_schema_serializer(component_name="BulkLoadStudentActivityScoresStats")
class BulkLoadStudentActivityScoresStatsSerializer(serializers.Serializer):
    rows_processed = serializers.IntegerField()
    rows_skipped = serializers.IntegerField()
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
    errors = serializers.ListField(
        child=serializers.DictField(), help_text="Lista de {row, error}."
    )


def scheme_weights_error(scheme: GradingScheme):
    try:
        validate_scheme_weights(scheme)
    except DjangoValidationError as exc:
        messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
        return messages[0] if messages else "Pesos inválidos."
    return None
