"""Helpers for grade recoveries (escala Bajo / BJ)."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import DecimalField, Exists, F, OuterRef, Q, QuerySet, Subquery

from .models import GradeRecovery, GradingScale

BAJO_FALLBACK_MAX = Decimal("2.99")


def parse_bool_query_param(raw: str | None) -> bool:
    """Truthy query values: 1, true, t, yes, y, si, sí (case-insensitive)."""
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "t", "yes", "y", "si", "sí")


def resolve_bajo_max_score(institution_id) -> Decimal:
    """
    Max score of the institution's Bajo (BJ) grading scale.

    Falls back to ``BAJO_FALLBACK_MAX`` (2.99) when no BJ/Bajo row exists.
    """
    if not institution_id:
        return BAJO_FALLBACK_MAX
    scale = (
        GradingScale.objects.filter(institution_id=institution_id)
        .filter(Q(code__iexact="BJ") | Q(name__iexact="Bajo"))
        .order_by("code")
        .first()
    )
    if scale is None:
        return BAJO_FALLBACK_MAX
    return scale.max_score


def filter_grades_in_bajo_scale(queryset: QuerySet) -> QuerySet:
    """
    Restrict a Grade queryset to numerical grades in the Bajo band.

    Uses each grade's institution BJ ``max_score``, or ``BAJO_FALLBACK_MAX``
    when that scale is missing.
    """
    bj_max_sq = (
        GradingScale.objects.filter(
            institution_id=OuterRef(
                "course_assignment__subject__institution_id"
            )
        )
        .filter(Q(code__iexact="BJ") | Q(name__iexact="Bajo"))
        .order_by("code")
        .values("max_score")[:1]
    )
    return (
        queryset.annotate(
            _bajo_max=Subquery(bj_max_sq, output_field=DecimalField())
        )
        .filter(
            Q(_bajo_max__isnull=False, numerical_grade__lte=F("_bajo_max"))
            | Q(
                _bajo_max__isnull=True,
                numerical_grade__lte=BAJO_FALLBACK_MAX,
            )
        )
    )


def exclude_grades_with_recovery(queryset: QuerySet) -> QuerySet:
    """Exclude grades that already have at least one GradeRecovery."""
    has_recovery = Exists(
        GradeRecovery.objects.filter(grade_id=OuterRef("pk"))
    )
    return queryset.annotate(_has_recovery=has_recovery).filter(
        _has_recovery=False
    )


def grade_is_in_bajo_scale(grade) -> bool:
    """Return True if ``grade.numerical_grade`` is in Bajo for its institution."""
    institution_id = grade.course_assignment.subject.institution_id
    bajo_max = resolve_bajo_max_score(institution_id)
    return grade.numerical_grade <= bajo_max
