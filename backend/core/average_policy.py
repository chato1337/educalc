"""Official averages shared by the bulletin, the period summary, and the CSV.

A recovered grade is the one stored in ``Grade.definitive_grade``. By policy that
value is the bottom of Básico (for the seeded scale, 3.00). A period or subject
still in Bajo counts as an unrecovered loss.

The average of those effective grades is then:

* kept when it is already below the loss mark (passing minimum minus one tenth);
* replaced by that loss mark when it would otherwise sit at or above it and at
  least one grade is still an unrecovered loss;
* left as the plain mean when every grade reaches Básico.
"""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Q

from .models import GradingScale

_QUANT = Decimal("0.01")
_LOSS_STEP = Decimal("0.10")
PASSING_MIN_FALLBACK = Decimal("3.00")


def resolve_passing_min(institution_id) -> Decimal:
    """Minimum score of the institution's Básico scale, or 3.00."""
    if not institution_id:
        return PASSING_MIN_FALLBACK
    scale = (
        GradingScale.objects.filter(institution_id=institution_id)
        .filter(
            Q(code__iexact="BS")
            | Q(name__iexact="Básico")
            | Q(name__iexact="Basico")
        )
        .order_by("min_score")
        .first()
    )
    if scale is None or scale.min_score is None:
        return PASSING_MIN_FALLBACK
    return scale.min_score


def loss_mark(passing_min: Decimal) -> Decimal:
    """One tenth below the passing minimum. 3.00 → 2.90."""
    return (passing_min - _LOSS_STEP).quantize(_QUANT)


def effective_grade(numerical, definitive) -> Decimal | None:
    """Recovered grade when present, otherwise the official numerical grade."""
    raw = definitive if definitive is not None else numerical
    if raw is None:
        return None
    value = raw if isinstance(raw, Decimal) else Decimal(str(raw))
    return value.quantize(_QUANT)


def official_average(values: list[Decimal], passing_min: Decimal) -> Decimal | None:
    """Mean of effective grades, capped at the loss mark when a subject stays lost."""
    if not values:
        return None
    passing = passing_min.quantize(_QUANT)
    mean = (sum(values, Decimal("0")) / Decimal(len(values))).quantize(_QUANT)
    unrecovered_loss = any(value < passing for value in values)
    floor = loss_mark(passing)
    if unrecovered_loss and mean >= floor:
        return floor
    return mean
