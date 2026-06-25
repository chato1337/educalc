"""Compute suggested grades from activity scores and weighted grading structure."""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count

from .indicator_utils import resolve_grading_scale_for_score
from .models import (
    ComponentSegment,
    Grade,
    GradingActivity,
    GradingScheme,
    GradingScale,
    Student,
    StudentActivityScore,
    WEIGHT_SUM_TARGET,
    WEIGHT_SUM_TOLERANCE,
)
from .performance_summary_service import (
    suppress_performance_summary_sync,
    sync_performance_summaries_for_group_period,
)


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _weights_sum_to_target(weights) -> bool:
    total = sum(weights, Decimal("0"))
    return abs(total - WEIGHT_SUM_TARGET) <= WEIGHT_SUM_TOLERANCE


def validate_scheme_weights(scheme: GradingScheme) -> None:
    """Raise ValidationError if subject component or segment weights do not sum to 100%."""
    subject = scheme.course_assignment.subject
    if not subject.component_weights_valid():
        raise ValidationError(
            "Los pesos de los componentes de la asignatura deben sumar 100%."
        )
    for component in subject.grading_components.all():
        weights = scheme.segments.filter(
            subject_component=component
        ).values_list("weight_percent", flat=True)
        if not weights:
            continue
        if not _weights_sum_to_target(weights):
            raise ValidationError(
                f"Los pesos de los segmentos del componente «{component.name}» "
                "deben sumar 100%."
            )


def _segment_average(student_id, segment) -> Optional[Decimal]:
    scores = StudentActivityScore.objects.filter(
        student_id=student_id,
        activity__segment=segment,
        score__isnull=False,
    ).values_list("score", flat=True)
    if not scores:
        return None
    total = sum(scores, Decimal("0"))
    return _quantize(total / len(scores))


def _weighted_average(
    items: List[Tuple[Optional[Decimal], Decimal]],
) -> Optional[Decimal]:
    """Weighted average excluding items with None values; renormalizes weights."""
    valid = [(value, weight) for value, weight in items if value is not None]
    if not valid:
        return None
    weight_total = sum(weight for _, weight in valid)
    if weight_total <= 0:
        return None
    weighted_sum = sum(value * weight for value, weight in valid)
    return _quantize(weighted_sum / weight_total)


def compute_suggested_grade(student: Student, scheme: GradingScheme) -> Optional[Decimal]:
    """Return suggested period grade for a student, or None if weights/scores are incomplete."""
    validate_scheme_weights(scheme)
    subject = scheme.course_assignment.subject
    component_items = []
    for component in subject.grading_components.all().order_by("sort_order", "name"):
        segments = scheme.segments.filter(
            subject_component=component
        ).order_by("sort_order", "name")
        segment_items = [
            (_segment_average(student.id, segment), segment.weight_percent)
            for segment in segments
        ]
        component_score = _weighted_average(segment_items)
        component_items.append((component_score, component.weight_percent))
    return _weighted_average(component_items)


def get_scheme_activity_ids(scheme: GradingScheme) -> List:
    return list(
        GradingActivity.objects.filter(
            segment__grading_scheme=scheme,
        ).values_list("id", flat=True)
    )


def get_enrolled_students_for_scheme(scheme: GradingScheme):
    """Active enrollments in the scheme's course assignment group and academic year."""
    course_assignment = scheme.course_assignment
    return (
        Student.objects.filter(
            enrollments__group_id=course_assignment.group_id,
            enrollments__academic_year_id=course_assignment.academic_year_id,
            enrollments__status="active",
        )
        .distinct()
        .order_by("full_name", "document_number")
    )


def scored_activity_counts_for_students(
    activity_ids: List,
    student_ids: List,
) -> dict:
    """Map student_id -> count of distinct activities with a non-null score."""
    if not activity_ids or not student_ids:
        return {}
    rows = (
        StudentActivityScore.objects.filter(
            activity_id__in=activity_ids,
            student_id__in=student_ids,
            score__isnull=False,
        )
        .values("student_id")
        .annotate(scored_count=Count("activity_id", distinct=True))
    )
    return {row["student_id"]: row["scored_count"] for row in rows}


def student_has_all_activities_graded(
    student_id,
    activity_ids: List,
    scored_counts: dict,
) -> bool:
    if not activity_ids:
        return False
    return scored_counts.get(student_id, 0) >= len(activity_ids)


def apply_suggested_grade_to_record(
    student: Student,
    scheme: GradingScheme,
    scales: List[GradingScale],
) -> Tuple[Grade, bool, Decimal]:
    """
    Compute suggested grade and upsert Grade.numerical_grade + performance_level.
    Does not modify definitive_grade.
    """
    suggested = compute_suggested_grade(student, scheme)
    if suggested is None:
        raise ValidationError(
            "No hay notas suficientes para calcular una sugerencia."
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
    return grade, created, suggested


@dataclass
class AppliedSuggestionItem:
    student_id: str
    student_name: str
    student_document_number: str
    suggested_grade: Decimal
    grade_id: str
    numerical_grade: Decimal
    performance_level_id: Optional[str]
    performance_level_name: Optional[str]
    created: bool


@dataclass
class SkippedSuggestionItem:
    student_id: str
    student_name: str
    student_document_number: str
    reason: str
    scored_activities: int
    total_activities: int
    missing_activities: int


@dataclass
class BulkApplySuggestionResult:
    grading_scheme_id: str
    group_id: str
    group_name: str
    academic_period_id: str
    total_activities: int
    enrolled_count: int
    eligible_count: int
    applied_count: int
    skipped_count: int
    created_count: int
    updated_count: int
    dry_run: bool
    ranking_recalculated: bool
    applied: List[AppliedSuggestionItem] = field(default_factory=list)
    skipped: List[SkippedSuggestionItem] = field(default_factory=list)


def bulk_apply_suggested_grades(
    scheme: GradingScheme,
    *,
    dry_run: bool = False,
) -> BulkApplySuggestionResult:
    """
    Apply suggested grades to enrolled students with all scheme activities graded.

    When not dry_run, suppresses signal-driven ranking sync during the loop and
    recalculates PerformanceSummary once for the group and period.
    """
    validate_scheme_weights(scheme)
    activity_ids = get_scheme_activity_ids(scheme)
    total_activities = len(activity_ids)
    if total_activities == 0:
        raise ValidationError(
            "No hay actividades definidas en el esquema."
        )

    course_assignment = scheme.course_assignment
    group = course_assignment.group
    enrolled_students = list(get_enrolled_students_for_scheme(scheme))
    enrolled_ids = [s.id for s in enrolled_students]
    scored_counts = scored_activity_counts_for_students(activity_ids, enrolled_ids)

    institution_id = course_assignment.subject.institution_id
    scales = list(
        GradingScale.objects.filter(institution_id=institution_id).order_by(
            "-min_score"
        )
    )

    eligible: List[Student] = []
    skipped: List[SkippedSuggestionItem] = []

    for student in enrolled_students:
        scored = scored_counts.get(student.id, 0)
        missing = max(total_activities - scored, 0)
        if student_has_all_activities_graded(student.id, activity_ids, scored_counts):
            eligible.append(student)
            continue
        skipped.append(
            SkippedSuggestionItem(
                student_id=str(student.id),
                student_name=student.full_name,
                student_document_number=student.document_number,
                reason="incomplete_scores",
                scored_activities=scored,
                total_activities=total_activities,
                missing_activities=missing,
            )
        )

    applied: List[AppliedSuggestionItem] = []
    created_count = 0
    updated_count = 0

    def _persist_eligible() -> None:
        nonlocal created_count, updated_count
        for student in eligible:
            try:
                grade, created, suggested = apply_suggested_grade_to_record(
                    student, scheme, scales
                )
            except ValidationError:
                skipped.append(
                    SkippedSuggestionItem(
                        student_id=str(student.id),
                        student_name=student.full_name,
                        student_document_number=student.document_number,
                        reason="suggestion_unavailable",
                        scored_activities=scored_counts.get(student.id, 0),
                        total_activities=total_activities,
                        missing_activities=0,
                    )
                )
                continue
            if created:
                created_count += 1
            else:
                updated_count += 1
            applied.append(
                AppliedSuggestionItem(
                    student_id=str(student.id),
                    student_name=student.full_name,
                    student_document_number=student.document_number,
                    suggested_grade=suggested,
                    grade_id=str(grade.id),
                    numerical_grade=grade.numerical_grade,
                    performance_level_id=(
                        str(grade.performance_level_id)
                        if grade.performance_level_id
                        else None
                    ),
                    performance_level_name=(
                        grade.performance_level.name
                        if grade.performance_level
                        else None
                    ),
                    created=created,
                )
            )

    ranking_recalculated = False

    if dry_run:
        for student in eligible:
            suggested = compute_suggested_grade(student, scheme)
            if suggested is None:
                skipped.append(
                    SkippedSuggestionItem(
                        student_id=str(student.id),
                        student_name=student.full_name,
                        student_document_number=student.document_number,
                        reason="suggestion_unavailable",
                        scored_activities=scored_counts.get(student.id, 0),
                        total_activities=total_activities,
                        missing_activities=0,
                    )
                )
                continue
            applied.append(
                AppliedSuggestionItem(
                    student_id=str(student.id),
                    student_name=student.full_name,
                    student_document_number=student.document_number,
                    suggested_grade=suggested,
                    grade_id="",
                    numerical_grade=suggested,
                    performance_level_id=None,
                    performance_level_name=None,
                    created=False,
                )
            )
    else:
        with transaction.atomic():
            with suppress_performance_summary_sync():
                _persist_eligible()
            if applied:
                sync_performance_summaries_for_group_period(
                    group.id, scheme.academic_period_id
                )
                ranking_recalculated = True

    eligible_count = sum(
        1
        for student in enrolled_students
        if student_has_all_activities_graded(
            student.id, activity_ids, scored_counts
        )
    )

    return BulkApplySuggestionResult(
        grading_scheme_id=str(scheme.id),
        group_id=str(group.id),
        group_name=group.name,
        academic_period_id=str(scheme.academic_period_id),
        total_activities=total_activities,
        enrolled_count=len(enrolled_students),
        eligible_count=eligible_count,
        applied_count=len(applied),
        skipped_count=len(skipped),
        created_count=created_count,
        updated_count=updated_count,
        dry_run=dry_run,
        ranking_recalculated=ranking_recalculated,
        applied=applied,
        skipped=skipped,
    )


def build_grade_breakdown(student: Student, scheme: GradingScheme) -> dict:
    """
    Return detailed breakdown with per-component, per-segment and per-activity scores.
    Raises ValidationError if weights are invalid.
    """
    validate_scheme_weights(scheme)
    subject = scheme.course_assignment.subject
    components_data = []
    component_items = []

    for component in subject.grading_components.all().order_by("sort_order", "name"):
        segments_data = []
        segment_items = []
        segments = (
            ComponentSegment.objects.filter(
                grading_scheme=scheme, subject_component=component
            )
            .prefetch_related("activities")
            .order_by("sort_order", "name")
        )
        for segment in segments:
            activities_data = []
            scores = []
            for activity in segment.activities.order_by(
                "activity_date", "sort_order", "name"
            ):
                score_obj = StudentActivityScore.objects.filter(
                    student=student,
                    activity=activity,
                ).first()
                activity_score = score_obj.score if score_obj else None
                if activity_score is not None:
                    scores.append(activity_score)
                activities_data.append(
                    {
                        "activity_id": str(activity.id),
                        "name": activity.name,
                        "activity_date": activity.activity_date.isoformat(),
                        "max_score": activity.max_score,
                        "score": activity_score,
                        "notes": score_obj.notes if score_obj else "",
                    }
                )
            segment_avg = (
                _quantize(sum(scores, Decimal("0")) / len(scores))
                if scores
                else None
            )
            segment_items.append((segment_avg, segment.weight_percent))
            segments_data.append(
                {
                    "segment_id": str(segment.id),
                    "name": segment.name,
                    "weight_percent": segment.weight_percent,
                    "segment_average": segment_avg,
                    "activities": activities_data,
                }
            )
        component_score = _weighted_average(segment_items)
        component_items.append((component_score, component.weight_percent))
        components_data.append(
            {
                "component_id": str(component.id),
                "name": component.name,
                "weight_percent": component.weight_percent,
                "component_score": component_score,
                "segments": segments_data,
            }
        )

    suggested = _weighted_average(component_items)
    return {
        "student_id": str(student.id),
        "student_name": student.full_name,
        "grading_scheme_id": str(scheme.id),
        "suggested_grade": suggested,
        "components": components_data,
    }


def bulk_apply_result_to_dict(result: BulkApplySuggestionResult) -> dict:
    """Serialize BulkApplySuggestionResult for API responses."""
    return {
        "grading_scheme_id": result.grading_scheme_id,
        "group_id": result.group_id,
        "group_name": result.group_name,
        "academic_period_id": result.academic_period_id,
        "total_activities": result.total_activities,
        "enrolled_count": result.enrolled_count,
        "eligible_count": result.eligible_count,
        "applied_count": result.applied_count,
        "skipped_count": result.skipped_count,
        "created_count": result.created_count,
        "updated_count": result.updated_count,
        "dry_run": result.dry_run,
        "ranking_recalculated": result.ranking_recalculated,
        "applied": [
            {
                "student_id": item.student_id,
                "student_name": item.student_name,
                "student_document_number": item.student_document_number,
                "suggested_grade": item.suggested_grade,
                "grade_id": item.grade_id or None,
                "numerical_grade": item.numerical_grade,
                "performance_level": item.performance_level_id,
                "performance_level_name": item.performance_level_name,
                "created": item.created,
            }
            for item in result.applied
        ],
        "skipped": [
            {
                "student_id": item.student_id,
                "student_name": item.student_name,
                "student_document_number": item.student_document_number,
                "reason": item.reason,
                "scored_activities": item.scored_activities,
                "total_activities": item.total_activities,
                "missing_activities": item.missing_activities,
            }
            for item in result.skipped
        ],
    }
