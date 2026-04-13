"""
Recompute PerformanceSummary (period average, rank, definitive average) from Grade rows.

Rank uses competition ranking (1,2,2,4) among active enrollments in the group that have
at least one grade in the period. Students with grades but no active enrollment still get
a summary row with rank left unset.
"""
import logging
from contextlib import contextmanager
from contextvars import ContextVar
from decimal import Decimal
from typing import Iterable, List, Optional, Tuple

from django.db import transaction
from django.db.models import Avg, Count

from .models import AcademicPeriod, CourseAssignment, Enrollment, Grade, Group, PerformanceSummary

logger = logging.getLogger(__name__)

_QUANT = Decimal("0.01")
_suppress_sync: ContextVar[bool] = ContextVar("_suppress_performance_summary_sync", default=False)


def _q2(value) -> Optional[Decimal]:
    if value is None:
        return None
    d = value if isinstance(value, Decimal) else Decimal(str(value))
    return d.quantize(_QUANT)


@contextmanager
def suppress_performance_summary_sync():
    """Disable signal-driven sync (e.g. during bulk CSV grade import)."""
    token = _suppress_sync.set(True)
    try:
        yield
    finally:
        _suppress_sync.reset(token)


def is_performance_summary_sync_suppressed() -> bool:
    return _suppress_sync.get()


def _competition_ranks(
    ordered: list[tuple],
) -> dict:
    """
    ordered: list of (student_id, average) sorted by average descending.
    Returns student_id -> rank (1-based, ties share rank; next rank skips).
    """
    ranks = {}
    i = 0
    n = len(ordered)
    while i < n:
        _sid, avg_val = ordered[i]
        j = i + 1
        while j < n and ordered[j][1] == avg_val:
            j += 1
        r = i + 1
        for k in range(i, j):
            ranks[ordered[k][0]] = r
        i = j
    return ranks


def sync_performance_summaries_for_group_period(group_id, academic_period_id) -> None:
    """
    Upsert PerformanceSummary for every student with grades in (group, period);
    delete summaries for active enrollments in the group that have no grades in that period.
    Ranks only students with active enrollment and at least one grade.
    """
    logger.info(
        "performance_summary_recalc_begin group_id=%s academic_period_id=%s",
        group_id,
        academic_period_id,
    )

    try:
        group = Group.objects.select_related("academic_year").get(pk=group_id)
    except Group.DoesNotExist:
        logger.warning(
            "performance_summary_recalc_abort reason=group_not_found group_id=%s",
            group_id,
        )
        return

    try:
        period = AcademicPeriod.objects.get(pk=academic_period_id)
    except AcademicPeriod.DoesNotExist:
        logger.warning(
            "performance_summary_recalc_abort reason=period_not_found academic_period_id=%s",
            academic_period_id,
        )
        return

    if group.academic_year_id != period.academic_year_id:
        logger.warning(
            "performance_summary_recalc_abort reason=year_mismatch group_id=%s "
            "group_academic_year_id=%s period_id=%s period_academic_year_id=%s",
            group_id,
            group.academic_year_id,
            academic_period_id,
            period.academic_year_id,
        )
        return

    stats = {
        r["student_id"]: r
        for r in Grade.objects.filter(
            academic_period_id=academic_period_id,
            course_assignment__group_id=group_id,
        )
        .values("student_id")
        .annotate(avg_num=Avg("numerical_grade"), avg_def=Avg("definitive_grade"), n=Count("id"))
    }

    enrolled_active = set(
        Enrollment.objects.filter(group_id=group_id, status="active").values_list(
            "student_id", flat=True
        )
    )

    keep_student_ids = set(stats.keys())

    with transaction.atomic():
        delete_result = PerformanceSummary.objects.filter(
            group_id=group_id, academic_period_id=academic_period_id
        ).exclude(student_id__in=keep_student_ids).delete()
        deleted_count = delete_result[0]

        ranked_pool = [
            (sid, _q2(stats[sid]["avg_num"]))
            for sid in enrolled_active
            if sid in stats and stats[sid]["n"] > 0 and stats[sid]["avg_num"] is not None
        ]
        ranked_pool.sort(key=lambda x: (-x[1], str(x[0])))
        rank_by_student = _competition_ranks(ranked_pool)

        upsert_count = 0
        for student_id, row in stats.items():
            if not row["n"]:
                continue
            avg_num = row["avg_num"]
            if avg_num is None:
                continue
            period_avg = _q2(avg_num)
            def_avg = _q2(row["avg_def"]) if row["avg_def"] is not None else None
            rank_val = rank_by_student.get(student_id)

            PerformanceSummary.objects.update_or_create(
                student_id=student_id,
                group_id=group_id,
                academic_period_id=academic_period_id,
                defaults={
                    "period_average": period_avg,
                    "rank": rank_val,
                    "definitive_average": def_avg,
                },
            )
            upsert_count += 1

    logger.info(
        "performance_summary_recalc_done group_id=%s group_name=%s academic_period_id=%s "
        "period_name=%s year=%s students_with_grades=%d active_enrolled=%d "
        "summaries_upserted=%d summaries_removed_rows=%d",
        group_id,
        group.name,
        academic_period_id,
        period.name,
        group.academic_year.year,
        len(stats),
        len(enrolled_active),
        upsert_count,
        deleted_count,
    )


def group_period_ids_from_grade(grade) -> tuple:
    """
    Resolve (group_id, academic_period_id) from a Grade instance.
    Works on post_delete (Grade row gone) using FK ids + CourseAssignment lookup.
    """
    ca_id = getattr(grade, "course_assignment_id", None)
    period_id = getattr(grade, "academic_period_id", None)
    if not ca_id or not period_id:
        return None, None
    gid = CourseAssignment.objects.filter(pk=ca_id).values_list("group_id", flat=True).first()
    return gid, period_id


def schedule_sync_after_grade_change(group_id, academic_period_id) -> None:
    """Run sync after the surrounding transaction commits."""
    if is_performance_summary_sync_suppressed():
        logger.debug(
            "performance_summary_recalc_skipped reason=suppressed group_id=%s academic_period_id=%s",
            group_id,
            academic_period_id,
        )
        return

    def _run():
        logger.debug(
            "performance_summary_recalc_on_commit group_id=%s academic_period_id=%s",
            group_id,
            academic_period_id,
        )
        sync_performance_summaries_for_group_period(group_id, academic_period_id)

    transaction.on_commit(_run)


def sync_many_group_periods(pairs: Iterable[tuple]) -> None:
    """Batch recompute after bulk operations (dedupe recommended)."""
    seen = set()
    unique: list = []
    for group_id, academic_period_id in pairs:
        key = (group_id, academic_period_id)
        if key in seen:
            continue
        seen.add(key)
        unique.append(key)
    if not unique:
        return
    logger.info(
        "performance_summary_batch_recalc_begin unique_pairs=%d",
        len(unique),
    )
    for group_id, academic_period_id in unique:
        sync_performance_summaries_for_group_period(group_id, academic_period_id)
    logger.info(
        "performance_summary_batch_recalc_done unique_pairs=%d",
        len(unique),
    )


def collect_sync_pairs_for_grade_scope(
    *,
    grade_level_id,
    academic_year_id,
    campus_id=None,
    academic_period_id=None,
    sync_all_group_period_combinations: bool = False,
) -> List[Tuple]:
    """
    Build (group_id, academic_period_id) pairs for all groups matching grade level + year
    (optional campus), either from existing Grade rows or the full Cartesian product.
    """
    groups_qs = Group.objects.filter(
        grade_level_id=grade_level_id,
        academic_year_id=academic_year_id,
    )
    if campus_id:
        groups_qs = groups_qs.filter(campus_id=campus_id)
    group_ids = list(groups_qs.values_list("id", flat=True))
    if not group_ids:
        return []

    if sync_all_group_period_combinations:
        periods_qs = AcademicPeriod.objects.filter(academic_year_id=academic_year_id)
        if academic_period_id:
            periods_qs = periods_qs.filter(pk=academic_period_id)
        period_ids = list(periods_qs.values_list("id", flat=True))
        pairs: List[Tuple] = []
        for gid in group_ids:
            for pid in period_ids:
                pairs.append((gid, pid))
        return pairs

    grades_qs = Grade.objects.filter(course_assignment__group_id__in=group_ids)
    if academic_period_id:
        grades_qs = grades_qs.filter(academic_period_id=academic_period_id)
    raw = grades_qs.values_list(
        "course_assignment__group_id", "academic_period_id"
    ).distinct()
    return list(dict.fromkeys((g, p) for g, p in raw))


def collect_sync_pairs_for_institution_scope(
    *,
    institution_id,
    academic_year_id=None,
    campus_id=None,
    academic_period_id=None,
    sync_all_group_period_combinations: bool = False,
) -> List[Tuple]:
    """
    Build (group_id, academic_period_id) for all groups whose academic year belongs to
    ``institution_id`` (optional year and campus filters). With ``sync_all_group_period_combinations``,
    each group is paired with periods of *its* academic year (not a single global year).
    """
    groups_qs = Group.objects.filter(academic_year__institution_id=institution_id)
    if academic_year_id:
        groups_qs = groups_qs.filter(academic_year_id=academic_year_id)
    if campus_id:
        groups_qs = groups_qs.filter(campus_id=campus_id)
    group_ids = list(groups_qs.values_list("id", flat=True))
    if not group_ids:
        return []

    if sync_all_group_period_combinations:
        pairs: List[Tuple] = []
        for g in Group.objects.filter(id__in=group_ids).only("id", "academic_year_id"):
            pqs = AcademicPeriod.objects.filter(academic_year_id=g.academic_year_id)
            if academic_period_id:
                pqs = pqs.filter(pk=academic_period_id)
            for pid in pqs.values_list("id", flat=True):
                pairs.append((g.id, pid))
        return pairs

    grades_qs = Grade.objects.filter(course_assignment__group_id__in=group_ids)
    if academic_period_id:
        grades_qs = grades_qs.filter(academic_period_id=academic_period_id)
    raw = grades_qs.values_list(
        "course_assignment__group_id", "academic_period_id"
    ).distinct()
    return list(dict.fromkeys((gid, pid) for gid, pid in raw))
