"""
Pivoted CSV export: one row per active enrollment (student) with one column per
subject (or subject × period when several periods are included).

Cells hold the student's numerical grade (or the definitive grade when available)
for that (subject, period) slot. Empty cell means the slot is still PENDIENTE.

Uses a single round-trip to the database with a LEFT JOIN to ``Grade``; optional
filters are appended as parameterized predicates (no string interpolation of user
input). The pivot is performed in Python after the fetch; for typical workloads
(a single academic year of one institution) the intermediate row set is small
enough (tens of thousands of rows at most) to materialize in memory.
"""
from __future__ import annotations

import csv
import io
from decimal import Decimal
from typing import Any, Iterable

from django.db import connection

FIXED_HEADERS = [
    "institucion_nombre",
    "institucion_dane",
    "sede_nombre",
    "sede_codigo",
    "ano_lectivo",
    "grado_nombre",
    "grupo_nombre",
    "estudiante_documento_tipo",
    "estudiante_documento",
    "estudiante_nombre_completo",
    "matricula_estado",
]

SUMMARY_HEADERS = [
    "asignaturas_calificadas",
    "asignaturas_pendientes",
    "promedio_numerico",
]


def _sql_and_params(filters: dict[str, Any]) -> tuple[str, list[Any]]:
    """
    Build SELECT + WHERE. ``filters`` must include ``academic_year_id`` (UUID)
    and optionally: ``institution_id``, ``academic_period_id``, ``campus_id``,
    ``group_id``, ``grade_level_id``, ``academic_area_id``, ``teacher_id``, ``subject_id``.
    """
    year_id = filters["academic_year_id"]
    params: list[Any] = ["active", year_id]

    extra_where: list[str] = []

    if filters.get("institution_id"):
        extra_where.append("ay.institution_id = %s")
        params.append(filters["institution_id"])

    if filters.get("academic_period_id"):
        extra_where.append("ap.id = %s")
        params.append(filters["academic_period_id"])

    if filters.get("campus_id"):
        extra_where.append("c.id = %s")
        params.append(filters["campus_id"])

    if filters.get("group_id"):
        extra_where.append("g.id = %s")
        params.append(filters["group_id"])

    if filters.get("grade_level_id"):
        extra_where.append("gl.id = %s")
        params.append(filters["grade_level_id"])

    if filters.get("academic_area_id"):
        extra_where.append("aa.id = %s")
        params.append(filters["academic_area_id"])

    if filters.get("teacher_id"):
        extra_where.append("t.id = %s")
        params.append(filters["teacher_id"])

    if filters.get("subject_id"):
        extra_where.append("s.id = %s")
        params.append(filters["subject_id"])

    where_extra = ""
    if extra_where:
        where_extra = " AND " + " AND ".join(extra_where)

    sql = f"""
SELECT
  i.name,
  COALESCE(i.dane_code, ''),
  c.name,
  COALESCE(c.code, ''),
  ay.year,
  gl.level_order,
  gl.name,
  g.name,
  aa.name,
  s.id,
  s.name,
  ap.id,
  ap.number,
  ap.name,
  st.id,
  COALESCE(st.document_type, ''),
  COALESCE(st.document_number, ''),
  st.full_name,
  e.status,
  gr.numerical_grade,
  gr.definitive_grade
FROM core_enrollment e
INNER JOIN core_student st ON st.id = e.student_id
INNER JOIN core_group g ON g.id = e.group_id
INNER JOIN core_campus c ON c.id = g.campus_id
INNER JOIN core_institution i ON i.id = c.institution_id
INNER JOIN core_academicyear ay ON ay.id = e.academic_year_id
INNER JOIN core_gradelevel gl ON gl.id = g.grade_level_id
INNER JOIN core_courseassignment ca
  ON ca.group_id = e.group_id AND ca.academic_year_id = e.academic_year_id
INNER JOIN core_subject s ON s.id = ca.subject_id
INNER JOIN core_academicarea aa ON aa.id = s.academic_area_id
INNER JOIN core_teacher t ON t.id = ca.teacher_id
INNER JOIN core_academicperiod ap ON ap.academic_year_id = e.academic_year_id
LEFT JOIN core_grade gr
  ON gr.student_id = e.student_id
  AND gr.course_assignment_id = ca.id
  AND gr.academic_period_id = ap.id
WHERE e.status = %s AND e.academic_year_id = %s
{where_extra}
"""
    return sql, params


def _format_grade(numerical: Any, definitive: Any) -> str:
    """Prefer the numerical grade; fall back to the definitive grade when set."""
    value = numerical if numerical is not None else definitive
    if value is None:
        return ""
    return str(value)


def _safe_str(v: Any) -> str:
    return "" if v is None else str(v)


def _build_pivot(
    rows: Iterable[tuple],
) -> tuple[list[dict], list[dict], list[dict], dict]:
    """
    Walk the raw row set and build:
      * ``students``: list of student dicts (one per active enrollment).
      * ``subjects``: ordered list of subject dicts (area, name, id).
      * ``periods``: ordered list of period dicts (id, number, name).
      * ``grades``: ``{(student_id, subject_id, period_id): (numerical_str, numerical_decimal)}``.
    """
    students_by_id: dict[Any, dict] = {}
    subjects_by_id: dict[Any, dict] = {}
    periods_by_id: dict[Any, dict] = {}
    grades: dict[tuple, tuple[str, Decimal | None]] = {}

    for row in rows:
        (
            inst_name,
            inst_dane,
            campus_name,
            campus_code,
            ay_year,
            grade_order,
            grade_name,
            group_name,
            area_name,
            subject_id,
            subject_name,
            period_id,
            period_number,
            period_name,
            student_id,
            doc_type,
            doc_number,
            student_fullname,
            enrollment_status,
            numerical_grade,
            definitive_grade,
        ) = row

        if student_id not in students_by_id:
            students_by_id[student_id] = {
                "student_id": student_id,
                "institucion_nombre": _safe_str(inst_name),
                "institucion_dane": _safe_str(inst_dane),
                "sede_nombre": _safe_str(campus_name),
                "sede_codigo": _safe_str(campus_code),
                "ano_lectivo": _safe_str(ay_year),
                "grado_orden": grade_order if grade_order is not None else 0,
                "grado_nombre": _safe_str(grade_name),
                "grupo_nombre": _safe_str(group_name),
                "estudiante_documento_tipo": _safe_str(doc_type),
                "estudiante_documento": _safe_str(doc_number),
                "estudiante_nombre_completo": _safe_str(student_fullname),
                "matricula_estado": _safe_str(enrollment_status),
            }

        if subject_id not in subjects_by_id:
            subjects_by_id[subject_id] = {
                "subject_id": subject_id,
                "area_nombre": _safe_str(area_name),
                "subject_nombre": _safe_str(subject_name),
            }

        if period_id not in periods_by_id:
            periods_by_id[period_id] = {
                "period_id": period_id,
                "period_number": period_number if period_number is not None else 0,
                "period_nombre": _safe_str(period_name),
            }

        key = (student_id, subject_id, period_id)
        if key not in grades:
            value = numerical_grade if numerical_grade is not None else definitive_grade
            decimal_value = value if isinstance(value, Decimal) else None
            grades[key] = (_format_grade(numerical_grade, definitive_grade), decimal_value)

    students = sorted(
        students_by_id.values(),
        key=lambda s: (
            s["grado_orden"],
            s["grado_nombre"],
            s["grupo_nombre"],
            s["estudiante_nombre_completo"],
        ),
    )
    subjects = sorted(
        subjects_by_id.values(),
        key=lambda s: (s["area_nombre"], s["subject_nombre"]),
    )
    periods = sorted(
        periods_by_id.values(),
        key=lambda p: (p["period_number"], p["period_nombre"]),
    )
    return students, subjects, periods, grades


def _dynamic_headers(
    subjects: list[dict], periods: list[dict]
) -> tuple[list[str], list[tuple]]:
    """Return ``(headers, column_keys)`` aligned by index. ``column_keys[i]`` is
    ``(subject_id, period_id)`` for the i-th dynamic column."""
    multi_period = len(periods) > 1
    headers: list[str] = []
    column_keys: list[tuple] = []
    for subj in subjects:
        for period in periods:
            if multi_period:
                header = f"{subj['subject_nombre']} (P{period['period_number']})"
            else:
                header = subj["subject_nombre"]
            headers.append(header)
            column_keys.append((subj["subject_id"], period["period_id"]))
    return headers, column_keys


def iter_grading_consolidated_csv(filters: dict[str, Any]) -> Iterable[bytes]:
    """
    UTF-8 with BOM for Excel; yields byte chunks for ``StreamingHttpResponse``.

    Output shape: one row per active enrollment; columns are the fixed student
    identification block, then one column per subject (or subject × period when
    the export spans more than one period), then summary columns.
    """
    sql, params = _sql_and_params(filters)
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        raw_rows = cursor.fetchall()

    students, subjects, periods, grades = _build_pivot(raw_rows)
    dyn_headers, col_keys = _dynamic_headers(subjects, periods)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(FIXED_HEADERS + dyn_headers + SUMMARY_HEADERS)
    yield ("\ufeff" + buf.getvalue()).encode("utf-8")
    buf.seek(0)
    buf.truncate(0)

    for student in students:
        fixed_values = [student[h] for h in FIXED_HEADERS]

        dynamic_values: list[str] = []
        calificadas = 0
        pendientes = 0
        numeric_sum = Decimal("0")
        numeric_count = 0
        for subject_id, period_id in col_keys:
            pair = grades.get((student["student_id"], subject_id, period_id))
            if pair is None:
                dynamic_values.append("")
                pendientes += 1
                continue
            text_value, decimal_value = pair
            dynamic_values.append(text_value)
            if text_value == "":
                pendientes += 1
            else:
                calificadas += 1
                if decimal_value is not None:
                    numeric_sum += decimal_value
                    numeric_count += 1

        if numeric_count > 0:
            average = (numeric_sum / Decimal(numeric_count)).quantize(Decimal("0.01"))
            average_cell = str(average)
        else:
            average_cell = ""

        summary_values = [str(calificadas), str(pendientes), average_cell]

        writer.writerow(fixed_values + dynamic_values + summary_values)
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)
