"""
Pivoted CSV export: one row per active enrollment (student) with one column per
subject (or subject × period when several periods are included).

Cells hold the same effective grade as the bulletin: the recovered grade
(``definitive_grade``) when set, otherwise the numerical grade. Empty cell means
the slot is still PENDIENTE. Subject ``(DEF)`` columns and the per-period
promedio use ``official_average``, the same rule as the bulletin.

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

from .average_policy import effective_grade, official_average, resolve_passing_min

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

COUNT_HEADERS = [
    "asignaturas_calificadas",
    "asignaturas_pendientes",
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
  gr.definitive_grade,
  i.id
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


def _format_grade(numerical: Any, definitive: Any) -> tuple[str, Decimal | None]:
    """Bulletin cell: recovered grade when set, otherwise the numerical grade."""
    value = effective_grade(numerical, definitive)
    if value is None:
        return "", None
    return f"{value:.2f}", value


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
            institution_id,
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
                "institution_id": institution_id,
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
            grades[key] = _format_grade(numerical_grade, definitive_grade)

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
    """Return ``(headers, column_keys)`` aligned by index.

    A grade key is ``("grade", subject_id, period_id)``. When the export covers
    more than one period, a ``("def", subject_id)`` key follows that subject and
    matches the bulletin DEF column.
    """
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
            column_keys.append(("grade", subj["subject_id"], period["period_id"]))
        if multi_period:
            headers.append(f"{subj['subject_nombre']} (DEF)")
            column_keys.append(("def", subj["subject_id"]))
    return headers, column_keys


def _summary_headers(periods: list[dict]) -> list[str]:
    """Per-period promedio matches the bulletin row. ``promedio_numerico`` is the
    official average of every filled cell in the export."""
    headers = list(COUNT_HEADERS)
    if len(periods) > 1:
        headers.extend(f"promedio (P{period['period_number']})" for period in periods)
    headers.append("promedio_numerico")
    return headers


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
    summary_headers = _summary_headers(periods)
    passing_by_inst = {
        institution_id: resolve_passing_min(institution_id)
        for institution_id in {student["institution_id"] for student in students}
    }

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(FIXED_HEADERS + dyn_headers + summary_headers)
    yield ("\ufeff" + buf.getvalue()).encode("utf-8")
    buf.seek(0)
    buf.truncate(0)

    for student in students:
        fixed_values = [student[h] for h in FIXED_HEADERS]
        passing_min = passing_by_inst[student["institution_id"]]
        by_period: dict[Any, list[Decimal]] = {period["period_id"]: [] for period in periods}
        all_values: list[Decimal] = []

        dynamic_values: list[str] = []
        calificadas = 0
        pendientes = 0
        for key in col_keys:
            if key[0] == "def":
                subject_values = [
                    grades[(student["student_id"], key[1], period["period_id"])][1]
                    for period in periods
                    if (student["student_id"], key[1], period["period_id"]) in grades
                    and grades[(student["student_id"], key[1], period["period_id"])][1]
                    is not None
                ]
                def_avg = official_average(subject_values, passing_min)
                dynamic_values.append("" if def_avg is None else f"{def_avg:.2f}")
                continue

            _, subject_id, period_id = key
            pair = grades.get((student["student_id"], subject_id, period_id))
            if pair is None:
                dynamic_values.append("")
                pendientes += 1
                continue
            text_value, decimal_value = pair
            dynamic_values.append(text_value)
            if text_value == "" or decimal_value is None:
                pendientes += 1
                continue
            calificadas += 1
            by_period[period_id].append(decimal_value)
            all_values.append(decimal_value)

        def _cell(values: list[Decimal]) -> str:
            average = official_average(values, passing_min)
            return "" if average is None else f"{average:.2f}"

        summary_values = [str(calificadas), str(pendientes)]
        if len(periods) > 1:
            summary_values.extend(_cell(by_period[period["period_id"]]) for period in periods)
        summary_values.append(_cell(all_values))

        writer.writerow(fixed_values + dynamic_values + summary_values)
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)
