"""
SQL export: expected grade slots (active enrollment × course assignment × period)
with CALIFICADO / PENDIENTE and rich join context for spreadsheets.

Uses one round-trip to the database with a LEFT JOIN to ``Grade``; optional filters
are appended as parameterized predicates (no string interpolation of user input).
"""
from __future__ import annotations

import csv
import io
from decimal import Decimal
from typing import Any, Iterable, Iterator
from uuid import UUID

from django.db import connection

CSV_HEADERS = [
    "institucion_id",
    "institucion_nombre",
    "institucion_dane",
    "sede_id",
    "sede_nombre",
    "sede_codigo",
    "ano_lectivo",
    "ano_lectivo_id",
    "grado_id",
    "grado_nombre",
    "orden_grado",
    "grupo_id",
    "grupo_nombre",
    "area_id",
    "area_nombre",
    "area_codigo",
    "asignatura_id",
    "asignatura_nombre",
    "asignatura_enfasis",
    "docente_id",
    "docente_documento",
    "docente_nombre_completo",
    "periodo_id",
    "periodo_numero",
    "periodo_nombre",
    "estudiante_id",
    "estudiante_documento_tipo",
    "estudiante_documento",
    "estudiante_nombre_completo",
    "matricula_id",
    "matricula_estado",
    "asignacion_curso_id",
    "estado_calificacion",
    "nota_id",
    "nota_numerica",
    "nota_definitiva",
    "nivel_desempeno_id",
    "nivel_desempeno_codigo",
    "nivel_desempeno_nombre",
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
  i.id,
  i.name,
  i.dane_code,
  c.id,
  c.name,
  COALESCE(c.code, ''),
  ay.year,
  ay.id,
  gl.id,
  gl.name,
  gl.level_order,
  g.id,
  g.name,
  aa.id,
  aa.name,
  COALESCE(aa.code, ''),
  s.id,
  s.name,
  COALESCE(s.emphasis, ''),
  t.id,
  COALESCE(t.document_number, ''),
  t.full_name,
  ap.id,
  ap.number,
  ap.name,
  st.id,
  COALESCE(st.document_type, ''),
  COALESCE(st.document_number, ''),
  st.full_name,
  e.id,
  e.status,
  ca.id,
  CASE WHEN gr.id IS NOT NULL THEN 'CALIFICADO' ELSE 'PENDIENTE' END,
  gr.id,
  gr.numerical_grade,
  gr.definitive_grade,
  gs.id,
  COALESCE(gs.code, ''),
  COALESCE(gs.name, '')
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
LEFT JOIN core_gradingscale gs ON gs.id = gr.performance_level_id
WHERE e.status = %s AND e.academic_year_id = %s
{where_extra}
ORDER BY
  i.name,
  c.name,
  gl.level_order,
  gl.name,
  g.name,
  aa.name,
  s.name,
  ap.number,
  st.full_name
"""
    return sql, params


def _cell(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, bool):
        return "1" if v else "0"
    return str(v)


def iter_grading_consolidated_rows(filters: dict[str, Any]) -> Iterator[list[str]]:
    """Yield data rows (list of string cells) for the consolidated report."""
    sql, params = _sql_and_params(filters)
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        while True:
            chunk = cursor.fetchmany(2000)
            if not chunk:
                break
            for row in chunk:
                yield [_cell(x) for x in row]


def iter_grading_consolidated_csv(filters: dict[str, Any]) -> Iterable[bytes]:
    """
    UTF-8 with BOM for Excel; yields byte chunks for StreamingHttpResponse.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADERS)
    yield ("\ufeff" + buf.getvalue()).encode("utf-8")
    buf.seek(0)
    buf.truncate(0)

    for data_row in iter_grading_consolidated_rows(filters):
        writer.writerow(data_row)
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)
