"""Compute suggested grades from activity scores and weighted grading structure."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple

from django.core.exceptions import ValidationError

from .models import (
    ComponentSegment,
    GradingScheme,
    Student,
    StudentActivityScore,
    WEIGHT_SUM_TARGET,
    WEIGHT_SUM_TOLERANCE,
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
