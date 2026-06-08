"""Helpers for academic indicators vs grading scales (Bajo vs Básico o superior)."""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import GradingScale


def _grading_scales_matching_score(
    score: float, scales: list[GradingScale]
) -> list[GradingScale]:
    matches: list[GradingScale] = []
    for sc in scales:
        lo, hi = float(sc.min_score), float(sc.max_score)
        if lo <= score <= hi:
            matches.append(sc)
    return matches


def resolve_grading_scale_for_score(
    score: Decimal | float | int | None, scales: list[GradingScale]
) -> GradingScale | None:
    """Return GradingScale whose [min_score, max_score] contains the score."""
    if score is None or not scales:
        return None
    matches = _grading_scales_matching_score(float(score), scales)
    if matches:
        if len(matches) == 1:
            return matches[0]
        matches.sort(
            key=lambda sc: (
                float(sc.max_score) - float(sc.min_score),
                sc.name,
            )
        )
        return matches[0]
    code = performance_code_from_score(score, scales)
    if not code:
        return None
    for sc in scales:
        if (sc.code or "").strip().upper() == code:
            return sc
    return None


def performance_code_from_score(
    score: Decimal | float | int | None, scales: list[GradingScale]
) -> str | None:
    """Return scale code (e.g. BJ, BS) for a numerical grade, or None."""
    if score is None:
        return None
    matches = _grading_scales_matching_score(float(score), scales)
    if matches:
        return (matches[0].code or "").strip().upper() or None
    s = float(score)
    if s >= 4.6:
        return "SP"
    if s >= 4.0:
        return "AL"
    if s >= 3.0:
        return "BS"
    return "BJ"


def outcome_from_performance_code(code: str | None) -> str | None:
    """
    Map Decreto 1290-style code to catalog outcome.

    BJ → below_basic; BS, AL, SP → basic_or_above.
    """
    if not code:
        return None
    c = code.strip().upper()
    if c == "BJ":
        return "below_basic"
    if c in ("BS", "AL", "SP"):
        return "basic_or_above"
    return None


_LEVEL_NAME_TO_CODE = {
    "BAJO": "BJ",
    "BÁSICO": "BS",
    "BASICO": "BS",
    "ALTO": "AL",
    "SUPERIOR": "SP",
}


def performance_code_from_level_text(raw: str | None) -> str | None:
    """Best-effort parse of NIVEL_DESEMPENO_TEXTO (name or code)."""
    if not raw:
        return None
    t = raw.strip().upper()
    if t in ("SP", "AL", "BS", "BJ"):
        return t
    return _LEVEL_NAME_TO_CODE.get(t)


def resolve_indicator_outcome(
    numerical_grade: Decimal | float | int | None,
    performance_level_text: str | None,
    scales: list[GradingScale],
) -> str | None:
    """Prefer explicit level text; otherwise derive from score and scales."""
    code = performance_code_from_level_text(performance_level_text)
    if code is None and numerical_grade is not None:
        code = performance_code_from_score(numerical_grade, scales)
    return outcome_from_performance_code(code)
