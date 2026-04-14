"""
Build context and HTML for the student academic grades bulletin (boletín).

Template: ``core/templates/core/academic_grades_bulletin.html`` (Django template syntax).
PDF rendering: WeasyPrint.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import get_template
from weasyprint import HTML

from .indicator_utils import resolve_indicator_outcome
from .models import (
    AcademicIndicator,
    AcademicIndicatorCatalog,
    AcademicPeriod,
    AcademicYear,
    Attendance,
    CourseAssignment,
    DisciplinaryReport,
    Enrollment,
    Grade,
    GradeDirector,
    GradingScale,
    Group,
    PerformanceSummary,
    Student,
)


def _fmt_num(value: Decimal | float | int | None) -> str:
    if value is None:
        return "—"
    d = Decimal(str(value))
    return f"{d:.2f}"


def _load_scales_for_institution(institution_id) -> list[GradingScale]:
    return list(
        GradingScale.objects.filter(institution_id=institution_id).order_by(
            "-min_score"
        )
    )


def _css_for_score(
    score: Decimal | float | None, scales: list[GradingScale]
) -> str:
    """Map score to CSS classes used in the bulletin template."""
    if score is None:
        return ""
    s = float(score)
    for sc in scales:
        lo, hi = float(sc.min_score), float(sc.max_score)
        if lo <= s <= hi:
            code = (sc.code or "").upper()
            if code == "SP":
                return "nota-sup"
            if code == "AL":
                return "nota-alto"
            if code == "BS":
                return "nota-bas"
            if code == "BJ":
                return "nota-baj"
    if s >= 4.6:
        return "nota-sup"
    if s >= 4.0:
        return "nota-alto"
    if s >= 3.0:
        return "nota-bas"
    return "nota-baj"


def _def_css_for_score(score: Decimal | float | None, scales: list[GradingScale]) -> str:
    base = _css_for_score(score, scales)
    return {
        "nota-sup": "def-sup",
        "nota-alto": "def-alto",
        "nota-bas": "def-bas",
        "nota-baj": "def-baj",
    }.get(base, "def-bas")


def _indicator_badge(score: Decimal | float | None, scales: list[GradingScale]) -> str:
    if score is None:
        return "—"
    s = float(score)
    for sc in scales:
        lo, hi = float(sc.min_score), float(sc.max_score)
        if lo <= s <= hi:
            return (sc.code or "?").upper()
    if s >= 4.6:
        return "SP"
    if s >= 4.0:
        return "AL"
    if s >= 3.0:
        return "BS"
    return "BJ"


def _indicator_badge_style(code: str) -> str:
    c = code.upper()
    if c == "SP":
        return "background:#d4f0e0;color:#1a6b3a"
    if c == "AL":
        return "background:#dce8f8;color:#1a3a6b"
    if c == "BS":
        return "background:#fdf0d0;color:#854f0b"
    return "background:#fce8e8;color:#a32d2d"


def _bulletin_indicator_description(
    ind: AcademicIndicator,
    scales: list[GradingScale],
) -> str:
    """
    Texto cualitativo para el boletín: descripción manual si existe; si no,
    logros del :class:`~core.models.AcademicIndicatorCatalog` según resultado
    (campo ``outcome`` o inferido desde nota / nivel de desempeño).
    """
    custom = (ind.description or "").strip()
    if custom:
        return custom
    cat = ind.catalog
    if cat is None:
        return ""
    outcome = (ind.outcome or "").strip()
    if not outcome:
        resolved = resolve_indicator_outcome(
            ind.numerical_grade,
            (ind.performance_level or "").strip() or None,
            scales,
        )
        outcome = resolved or ""
    return _bulletin_catalog_description_for_outcome(cat, outcome)


def _bulletin_catalog_description_for_outcome(
    cat: AcademicIndicatorCatalog, outcome: str
) -> str:
    if outcome == "below_basic":
        return (cat.achievement_below_basic or "").strip()
    if outcome == "basic_or_above":
        return (cat.achievement_basic_or_above or "").strip()
    return ""


def _latest_grade_in_periods(
    glist: list[Grade], period_order: list[UUID]
) -> Grade | None:
    """Nota del periodo más avanzado dentro de ``period_order`` que tenga calificación."""
    for pid in reversed(period_order):
        for g in glist:
            if g.academic_period_id == pid:
                return g
    return None


def _grade_level_text_for_outcome(grade: Grade) -> str | None:
    """Código o nombre de escala para ``resolve_indicator_outcome``."""
    pl = grade.performance_level
    if not pl:
        return None
    code = (pl.code or "").strip().upper()
    if code:
        return code
    name = (pl.name or "").strip()
    return name or None


def _parse_uuid_list(raw: str | None) -> list[UUID] | None:
    if raw is None or raw.strip() == "":
        return None
    out: list[UUID] = []
    for p in raw.split(","):
        p = p.strip()
        if not p:
            continue
        try:
            out.append(UUID(p))
        except ValueError as e:
            raise ValueError(f"Invalid UUID in period_ids: {p}") from e
    return out or None


def _year_definitive_grade(
    grades_for_assignment: list[Grade], period_order: list[UUID]
) -> Decimal | None:
    """Prefer the last selected period's definitive_grade; else average numerical grades."""
    by_period = {g.academic_period_id: g for g in grades_for_assignment}
    last_def: Decimal | None = None
    nums: list[Decimal] = []
    for pid in period_order:
        g = by_period.get(pid)
        if not g:
            continue
        nums.append(g.numerical_grade)
        if g.definitive_grade is not None:
            last_def = g.definitive_grade
    if last_def is not None:
        return last_def
    if not nums:
        return None
    return sum(nums) / len(nums)


def build_bulletin_context(
    *,
    student: Student,
    academic_year: AcademicYear,
    period_ids: list[UUID] | None,
    group: Group | None = None,
) -> dict[str, Any]:
    """When ``group`` is set, the active enrollment for that group+year is used (bulk PDF)."""
    enr_qs = Enrollment.objects.filter(
        student=student,
        academic_year=academic_year,
        status="active",
    )
    if group is not None:
        enr_qs = enr_qs.filter(group=group)
    enrollment = (
        enr_qs.select_related(
            "group",
            "group__grade_level",
            "group__campus",
            "group__campus__institution",
            "academic_year",
        ).first()
    )
    if not enrollment:
        raise ValueError(
            "No active enrollment found for this student in the given academic year."
        )

    group = enrollment.group

    institution = group.campus.institution
    scales = _load_scales_for_institution(institution.id)

    periods_qs = AcademicPeriod.objects.filter(academic_year=academic_year).order_by(
        "number"
    )
    if period_ids:
        periods = list(periods_qs.filter(id__in=period_ids))
        found_ids = {p.id for p in periods}
        missing = set(period_ids) - found_ids
        if missing:
            raise ValueError(
                "One or more period_ids do not belong to this academic year."
            )
        periods.sort(key=lambda p: p.number)
    else:
        periods = list(periods_qs)

    if not periods:
        raise ValueError("No academic periods available for this bulletin.")

    period_order = [p.id for p in periods]

    assignments = list(
        CourseAssignment.objects.filter(
            group=group,
            academic_year=academic_year,
        )
        .select_related(
            "subject",
            "subject__academic_area",
            "teacher",
        )
        .order_by("subject__academic_area__name", "subject__name")
    )

    grades_qs = Grade.objects.filter(
        student=student,
        academic_period__in=periods,
        course_assignment__in=[a.id for a in assignments],
    ).select_related("academic_period", "performance_level")

    grades_by_ca: dict[Any, list[Grade]] = defaultdict(list)
    for g in grades_qs:
        grades_by_ca[g.course_assignment_id].append(g)

    ca_ids = [a.id for a in assignments]
    att_rows = Attendance.objects.filter(
        student=student,
        course_assignment_id__in=ca_ids,
        academic_period__in=periods,
    )
    att_by_ca_period: dict[tuple[Any, Any], Attendance] = {}
    for row in att_rows:
        att_by_ca_period[(row.course_assignment_id, row.academic_period_id)] = row

    grade_rows: list[dict[str, Any]] = []
    for ca in assignments:
        glist = grades_by_ca.get(ca.id, [])
        period_cells: list[dict[str, str]] = []
        for p in periods:
            match = next((x for x in glist if x.academic_period_id == p.id), None)
            if match:
                period_cells.append(
                    {
                        "value": _fmt_num(match.numerical_grade),
                        "css": _css_for_score(match.numerical_grade, scales),
                    }
                )
            else:
                period_cells.append({"value": "—", "css": ""})

        ydef = _year_definitive_grade(glist, period_order)
        se_total = 0
        ce_total = 0
        for p in periods:
            att = att_by_ca_period.get((ca.id, p.id))
            if att:
                se_total += att.unexcused_absences
                ce_total += att.excused_absences

        subline = (ca.subject.emphasis or "").strip() or ca.subject.name
        grade_rows.append(
            {
                "area_title": ca.subject.academic_area.name,
                "subject_sub": subline,
                "teacher": ca.teacher.full_name,
                "period_cells": period_cells,
                "def_value": _fmt_num(ydef) if ydef is not None else "—",
                "def_css": _def_css_for_score(ydef, scales) if ydef is not None else "",
                "se": str(se_total),
                "ce": str(ce_total),
            }
        )

    unexcused_per_period: list[int] = []
    excused_per_period: list[int] = []
    for p in periods:
        agg = Attendance.objects.filter(
            student=student,
            academic_period=p,
            course_assignment__group=group,
        ).aggregate(
            u=Sum("unexcused_absences"),
            e=Sum("excused_absences"),
        )
        unexcused_per_period.append(int(agg["u"] or 0))
        excused_per_period.append(int(agg["e"] or 0))

    unexcused_annual = sum(unexcused_per_period)
    excused_annual = sum(excused_per_period)

    summaries = PerformanceSummary.objects.filter(
        student=student,
        group=group,
        academic_period__in=periods,
    )
    summary_by_period = {s.academic_period_id: s for s in summaries}
    rank_row: list[str] = []
    avg_row: list[str] = []
    for p in periods:
        ps = summary_by_period.get(p.id)
        rank_row.append(str(ps.rank) if ps and ps.rank is not None else "—")
        avg_row.append(
            _fmt_num(ps.period_average) if ps and ps.period_average is not None else "—"
        )

    ind_candidates = (
        AcademicIndicator.objects.filter(
            student=student,
            course_assignment_id__in=ca_ids,
            academic_period__in=periods,
        )
        .select_related(
            "academic_period",
            "catalog",
            "course_assignment__subject__academic_area",
        )
        .order_by("course_assignment_id", "-academic_period__number")
    )
    ind_by_ca: dict[Any, AcademicIndicator] = {}
    for ind in ind_candidates:
        if ind.course_assignment_id not in ind_by_ca:
            ind_by_ca[ind.course_assignment_id] = ind

    area_ids = {ca.subject.academic_area_id for ca in assignments}
    catalog_by_area: dict[Any, AcademicIndicatorCatalog] = {}
    if area_ids:
        for cat in AcademicIndicatorCatalog.objects.filter(
            grade_level_id=group.grade_level_id,
            academic_area_id__in=area_ids,
        ):
            catalog_by_area[cat.academic_area_id] = cat

    indicators_out: list[dict[str, Any]] = []
    for ca in assignments:
        ind = ind_by_ca.get(ca.id)
        if ind:
            score = ind.numerical_grade
            pl = (ind.performance_level or "").strip().upper()
            code = _indicator_badge(score, scales)
            if pl in ("SP", "AL", "BS", "BJ"):
                code = pl
            label = f"{ca.subject.academic_area.name} — {_fmt_num(score) if score is not None else '—'}"
            indicators_out.append(
                {
                    "badge_code": code,
                    "badge_style": _indicator_badge_style(code),
                    "label": label,
                    "description": _bulletin_indicator_description(ind, scales),
                }
            )
            continue

        cat = catalog_by_area.get(ca.subject.academic_area_id)
        if not cat:
            continue
        glist = grades_by_ca.get(ca.id, [])
        grade = _latest_grade_in_periods(glist, period_order)
        if not grade:
            continue
        score = grade.numerical_grade
        pl_code = ""
        if grade.performance_level_id:
            pl_code = (grade.performance_level.code or "").strip().upper()
        code = _indicator_badge(score, scales)
        if pl_code in ("SP", "AL", "BS", "BJ"):
            code = pl_code
        level_text = _grade_level_text_for_outcome(grade)
        outcome = (
            resolve_indicator_outcome(score, level_text, scales) or ""
        )
        desc = _bulletin_catalog_description_for_outcome(cat, outcome)
        label = f"{ca.subject.academic_area.name} — {_fmt_num(score)}"
        indicators_out.append(
            {
                "badge_code": code,
                "badge_style": _indicator_badge_style(code),
                "label": label,
                "description": desc,
            }
        )

    disc_reports = DisciplinaryReport.objects.filter(
        student=student,
        academic_period__in=periods,
    ).select_related("academic_period")
    disc_by_period = {d.academic_period_id: d for d in disc_reports}
    disc_parts: list[str] = []
    for p in periods:
        dr = disc_by_period.get(p.id)
        if dr and (dr.report_text or "").strip():
            disc_parts.append(f"{p.name}: {dr.report_text.strip()}")
    disciplinary_text = (
        "\n".join(disc_parts)
        if disc_parts
        else "Sin observaciones registradas."
    )

    gd = (
        GradeDirector.objects.filter(group=group, academic_year=academic_year)
        .select_related("teacher")
        .first()
    )
    director_name = gd.teacher.full_name if gd else "—"
    director_title = "Directora de grado"  # could be parametrized later

    legal_bits = [
        (institution.legal_reference or "").strip(),
        f"DANE: {institution.dane_code}" if institution.dane_code else "",
        f"NIT. {institution.nit}" if institution.nit else "",
    ]
    legal_line = " | ".join(b for b in legal_bits if b)

    grade_badge = f"{group.grade_level.name} — {group.name}"

    return {
        "institution_label": "(Art. 16 Decreto 1290 de 2009)",
        "institution_name": institution.name,
        "legal_line": legal_line,
        "logo_left_url": "http://cabildodecorinto.com/wp-content/uploads/2026/04/Screenshot_2026-04-12_at_6.12.43_PM-removebg-preview-1.png",
        "logo_right_url": "http://cabildodecorinto.com/wp-content/uploads/2026/04/Screenshot_2026-04-12_at_6.13.00_PM-removebg-preview.png",
        "campus_line": f"Sede: {group.campus.name}",
        "student_name": student.full_name,
        "grade_badge": grade_badge,
        "table_title": f"Cuadro General de Evaluaciones e Inasistencia — {academic_year.year}",
        "periods": [{"name": p.name} for p in periods],
        "grade_rows": grade_rows,
        "inas_unexcused": [str(x) for x in unexcused_per_period]
        + [str(unexcused_annual)],
        "inas_excused": [str(x) for x in excused_per_period] + [str(excused_annual)],
        "rank_row": rank_row,
        "avg_row": avg_row,
        "indicators": indicators_out,
        "disciplinary_text": disciplinary_text,
        "director_name": director_name,
        "director_title": director_title,
    }


def render_bulletin_html(context: dict[str, Any]) -> str:
    return get_template("core/academic_grades_bulletin.html").render(context)


def _safe_filename_part(raw: str | None, fallback: str) -> str:
    """Alphanumeric only for safe PDF filenames."""
    s = "".join(c for c in (raw or "") if c.isalnum())
    return s if s else fallback


def bulletin_html_to_pdf_response(html: str, filename: str) -> HttpResponse:
    base_url = str(settings.BASE_DIR) + "/"
    pdf_bytes = HTML(string=html, base_url=base_url).write_pdf()
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


def bulletin_pdf_for_request(
    *,
    student_id: UUID,
    academic_year_id: UUID,
    period_ids_raw: str | None,
    grade_level_ids_raw: str | None = None,
) -> HttpResponse:
    """Optional ``grade_level_ids_raw`` is ignored (reserved for API compatibility)."""
    _ = grade_level_ids_raw
    student = get_object_or_404(Student, pk=student_id)
    academic_year = get_object_or_404(AcademicYear, pk=academic_year_id)
    period_ids = _parse_uuid_list(period_ids_raw)

    ctx = build_bulletin_context(
        student=student,
        academic_year=academic_year,
        period_ids=period_ids,
    )

    html = render_bulletin_html(ctx)
    doc_part = _safe_filename_part(
        student.document_number,
        f"estudiante{str(student.id).replace('-', '')[:12]}",
    )
    fname = f"{doc_part}_{academic_year.year}.pdf"
    return bulletin_html_to_pdf_response(html, fname)


def bulletin_pdf_for_group_request(
    *,
    group_id: UUID,
    academic_year_id: UUID,
    period_ids_raw: str | None,
    grade_level_ids_raw: str | None = None,
) -> HttpResponse:
    """One PDF with one bulletin page per active student in the group."""
    _ = grade_level_ids_raw
    group = get_object_or_404(
        Group.objects.select_related("academic_year", "grade_level", "campus"),
        pk=group_id,
    )
    academic_year = get_object_or_404(AcademicYear, pk=academic_year_id)
    if group.academic_year_id != academic_year.id:
        raise ValueError(
            "The group does not belong to the given academic year."
        )

    period_ids = _parse_uuid_list(period_ids_raw)
    enrollments = (
        Enrollment.objects.filter(
            group=group,
            academic_year=academic_year,
            status="active",
        )
        .select_related("student")
        .order_by("student__full_name", "student__id")
    )
    if not enrollments:
        raise ValueError(
            "No active enrollments found for this group in the given academic year."
        )

    contexts: list[dict[str, Any]] = []
    for en in enrollments:
        try:
            ctx = build_bulletin_context(
                student=en.student,
                academic_year=academic_year,
                period_ids=period_ids,
                group=group,
            )
            contexts.append(ctx)
        except ValueError:
            continue

    if not contexts:
        raise ValueError(
            "Could not build bulletin for any student in this group."
        )

    frag = get_template("core/academic_grades_bulletin_fragment.html")
    parts = [frag.render(ctx) for ctx in contexts]
    bundle_title = f"Boletines {group.name} — {academic_year.year}"
    bundle_html = get_template("core/academic_grades_bulletin_bundle.html").render(
        {
            "bundle_title": bundle_title,
            "bulletin_html_parts": parts,
        }
    )
    group_part = _safe_filename_part(group.name, "grupo")
    fname = f"{group_part}_{academic_year.year}.pdf"
    return bulletin_html_to_pdf_response(bundle_html, fname)
