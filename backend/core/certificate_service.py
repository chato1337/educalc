"""
Student promotion certificate (certificado de estudios).

The year outcome uses the same subject definitive as the bulletin: the official
average of each period's effective grade. The student passes the year when every
subject definitive is at or above the institution's Básico minimum. One definitive
below that minimum means the year is lost.

PDF rendering follows the bulletin: Django templates and WeasyPrint.
"""
from __future__ import annotations

import unicodedata
from collections import OrderedDict
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import get_template

from .average_policy import official_average, resolve_passing_min
from .bulletin_service import (
    _fmt_num,
    _load_scales_for_institution,
    _safe_filename_part,
    _year_definitive_grade,
    bulletin_html_to_pdf_response,
)
from .models import (
    AcademicPeriod,
    AcademicYear,
    Attendance,
    CourseAssignment,
    Enrollment,
    Grade,
    GradingScale,
    Group,
    Student,
)

_MONTHS = (
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)

_DOCUMENT_PHRASES = {
    "TI": "tarjeta de identidad",
    "CC": "cédula de ciudadanía",
    "RC": "registro civil",
    "CE": "cédula de extranjería",
    "PA": "pasaporte",
    "PEP": "permiso especial de permanencia",
    "PPT": "permiso por protección temporal",
}


def _plain_upper(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    base = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return base.upper()


def _format_issued_on(value: date) -> str:
    return f"{value.day} de {_MONTHS[value.month - 1]} de {value.year}"


def parse_issued_on(raw: str | None) -> date:
    if raw is None or raw.strip() == "":
        return date.today()
    try:
        return date.fromisoformat(raw.strip())
    except ValueError as exc:
        raise ValueError("Invalid date for issued_on. Use YYYY-MM-DD.") from exc


def document_type_phrase(raw: str | None) -> str:
    text = (raw or "").strip()
    if not text:
        return "documento"
    code = text.split(":", 1)[0].strip().upper()
    if code in _DOCUMENT_PHRASES:
        return _DOCUMENT_PHRASES[code]
    if ":" in text:
        return text.split(":", 1)[1].strip().lower()
    return text.lower()


def _scale_for_score(
    score: Decimal | None, scales: list[GradingScale]
) -> GradingScale | None:
    if score is None:
        return None
    value = float(score)
    for scale in scales:
        if float(scale.min_score) <= value <= float(scale.max_score):
            return scale
    return None


def performance_label(score: Decimal | None, scales: list[GradingScale]) -> str:
    if score is None:
        return "—"
    number = _fmt_num(score)
    scale = _scale_for_score(score, scales)
    if scale is None or not (scale.name or "").strip():
        return number
    return f"{_plain_upper(scale.name)}({number})"


def _place_clause(campus) -> str:
    locality = (campus.locality or "").strip()
    municipality = (campus.municipality or "").strip()
    department = (campus.department or "").strip()
    if locality and municipality and department:
        return f"la vereda {locality} del municipio de {municipality} {department}"
    if locality and municipality:
        return f"la vereda {locality} del municipio de {municipality}"
    if municipality and department:
        return f"el municipio de {municipality} {department}"
    if municipality:
        return f"el municipio de {municipality}"
    return campus.name


def _annual_absence_total(student: Student, group: Group, periods: list) -> int:
    """Group roll-call total when it exists; otherwise the per-subject rows."""
    base = Attendance.objects.filter(
        student=student,
        group=group,
        academic_period__in=periods,
    )
    general = base.filter(course_assignment__isnull=True)
    rows = general if general.exists() else base.filter(course_assignment__isnull=False)
    totals = rows.aggregate(
        unexcused=Sum("unexcused_absences"),
        excused=Sum("excused_absences"),
    )
    return int(totals["unexcused"] or 0) + int(totals["excused"] or 0)


def _passed_year(definitives: list[Decimal | None], passing_min: Decimal) -> bool:
    if not definitives:
        return False
    minimum = passing_min.quantize(Decimal("0.01"))
    return all(value is not None and value >= minimum for value in definitives)


def build_certificate_context(
    *,
    student: Student,
    academic_year: AcademicYear,
    issued_on: date,
    group: Group | None = None,
) -> dict[str, Any]:
    """When ``group`` is set, the active enrollment for that group+year is used."""
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
    passing_min = resolve_passing_min(institution.id)
    periods = list(
        AcademicPeriod.objects.filter(academic_year=academic_year).order_by("number")
    )
    if not periods:
        raise ValueError("No academic periods available for this certificate.")
    period_order = [period.id for period in periods]

    assignments = list(
        CourseAssignment.objects.filter(group=group, academic_year=academic_year)
        .select_related("subject", "subject__academic_area")
        .order_by("subject__academic_area__name", "subject__name")
    )
    grades = Grade.objects.filter(
        student=student,
        academic_period__in=periods,
        course_assignment__in=[item.id for item in assignments],
    ).select_related("academic_period")
    grades_by_assignment: dict[Any, list[Grade]] = {}
    for grade in grades:
        grades_by_assignment.setdefault(grade.course_assignment_id, []).append(grade)

    areas: OrderedDict[Any, dict[str, Any]] = OrderedDict()
    subject_definitives: list[Decimal | None] = []
    for assignment in assignments:
        definitive = _year_definitive_grade(
            grades_by_assignment.get(assignment.id, []),
            period_order,
            passing_min,
        )
        subject_definitives.append(definitive)
        area = assignment.subject.academic_area
        bucket = areas.get(area.id)
        if bucket is None:
            bucket = {
                "area_name": _plain_upper(area.name),
                "emphases": [],
                "definitives": [],
            }
            areas[area.id] = bucket
        emphasis = (assignment.subject.emphasis or "").strip()
        if emphasis and emphasis not in bucket["emphases"]:
            bucket["emphases"].append(emphasis)
        bucket["definitives"].append(definitive)

    area_rows: list[dict[str, str]] = []
    for bucket in areas.values():
        values = bucket["definitives"]
        present = [value for value in values if value is not None]
        if present and len(present) == len(values):
            area_definitive = official_average(present, passing_min)
            performance = performance_label(area_definitive, scales)
        else:
            performance = "—"
        emphasis_text = ", ".join(bucket["emphases"])
        emphasis_line = (
            f"Énfasis en {emphasis_text}" if emphasis_text else "Énfasis en"
        )
        area_rows.append(
            {
                "area_name": bucket["area_name"],
                "emphasis_line": emphasis_line,
                "performance": performance,
            }
        )

    passed = _passed_year(subject_definitives, passing_min)
    outcome = "aprobó" if passed else "no aprobó"
    grade_name = _plain_upper(group.grade_level.name)
    year = academic_year.year
    document_number = (student.document_number or "").strip()
    if document_number:
        identity = (
            f" con {document_type_phrase(student.document_type)} número {document_number}"
        )
    else:
        identity = ""
    student_paragraph = (
        f"Que el estudiante {student.full_name}{identity}, cursó y {outcome} "
        f"en este plantel educativo el grado {grade_name} durante el periodo lectivo "
        f"{year}. Habiendo alcanzado las siguientes valoraciones, de acuerdo con los "
        "decretos y las resoluciones reglamentarias vigentes."
    )
    promotion_paragraph = (
        f"En cuanto a los compromisos adquiridos por el estudiante durante el año "
        f"lectivo {year} la comisión de EVALUACION Y PROMOCION {outcome} promover "
        f"al grado siguiente al estudiante teniendo en cuenta el artículo 6 del "
        f"decreto 1290 de 2009 y el sistema interno de evaluación de la "
        f"{institution.name}."
    )

    return {
        "institution_name": institution.name,
        "certificate_subtitle": (institution.certificate_subtitle or "").strip(),
        "certificate_authorization": (
            institution.certificate_authorization or ""
        ).strip(),
        "legal_reference": (institution.legal_reference or "").strip(),
        "nit": (institution.nit or "").strip(),
        "dane_code": (institution.dane_code or "").strip(),
        "logo_left_url": institution.bulletin_logo_left_url or "",
        "logo_right_url": institution.bulletin_logo_right_url or "",
        "student_name": student.full_name,
        "grade_name": grade_name,
        "year": year,
        "grade_line": f"Grado {grade_name}, año lectivo {year}",
        "student_paragraph": student_paragraph,
        "area_rows": area_rows,
        "absence_total": _annual_absence_total(student, group, periods),
        "promotion_paragraph": promotion_paragraph,
        "place_clause": _place_clause(group.campus),
        "issued_on_text": _format_issued_on(issued_on),
        "passed_year": passed,
        "rector_name": (institution.rector_name or "").strip(),
        "rector_document_number": (institution.rector_document_number or "").strip(),
        "rector_signature_url": institution.rector_signature_url or "",
        "secretary_name": (institution.secretary_name or "").strip(),
        "secretary_document_number": (
            institution.secretary_document_number or ""
        ).strip(),
        "secretary_signature_url": institution.secretary_signature_url or "",
        "subject_definitives": [
            _fmt_num(value) if value is not None else None
            for value in subject_definitives
        ],
    }


def render_certificate_html(context: dict[str, Any]) -> str:
    return get_template("core/academic_certificate.html").render(context)


def certificate_pdf_for_request(
    *,
    student_id: UUID,
    academic_year_id: UUID,
    issued_on_raw: str | None,
) -> HttpResponse:
    student = get_object_or_404(Student, pk=student_id)
    academic_year = get_object_or_404(AcademicYear, pk=academic_year_id)
    context = build_certificate_context(
        student=student,
        academic_year=academic_year,
        issued_on=parse_issued_on(issued_on_raw),
    )
    html = render_certificate_html(context)
    doc_part = _safe_filename_part(
        student.document_number,
        f"estudiante{str(student.id).replace('-', '')[:12]}",
    )
    filename = f"certificado_{doc_part}_{academic_year.year}.pdf"
    return bulletin_html_to_pdf_response(html, filename)


def certificate_pdf_for_group_request(
    *,
    group_id: UUID,
    academic_year_id: UUID,
    issued_on_raw: str | None,
) -> HttpResponse:
    group = get_object_or_404(
        Group.objects.select_related("academic_year", "grade_level", "campus"),
        pk=group_id,
    )
    academic_year = get_object_or_404(AcademicYear, pk=academic_year_id)
    if group.academic_year_id != academic_year.id:
        raise ValueError("The group does not belong to the given academic year.")

    issued_on = parse_issued_on(issued_on_raw)
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
    for enrollment in enrollments:
        try:
            contexts.append(
                build_certificate_context(
                    student=enrollment.student,
                    academic_year=academic_year,
                    issued_on=issued_on,
                    group=group,
                )
            )
        except ValueError:
            continue
    if not contexts:
        raise ValueError("Could not build a certificate for any student in this group.")

    fragment = get_template("core/academic_certificate_fragment.html")
    parts = [fragment.render(context) for context in contexts]
    bundle_html = get_template("core/academic_certificate_bundle.html").render(
        {
            "bundle_title": f"Certificados {group.name} — {academic_year.year}",
            "certificate_html_parts": parts,
        }
    )
    group_part = _safe_filename_part(group.name, "grupo")
    filename = f"certificado_{group_part}_{academic_year.year}.pdf"
    return bulletin_html_to_pdf_response(bundle_html, filename)
