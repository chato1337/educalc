"""
CSV of active enrollments that do not pass the academic year.

The outcome is the certificate rule: each subject definitive is the official
average of that subject's effective period grades (recovered grade when set,
otherwise the numerical grade). The student fails the year when any definitive
is missing or sits below the institution's Básico minimum.

The row set comes from the same single SELECT as the consolidated grading CSV.
Only students who fail are emitted.
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from decimal import Decimal
from typing import Any, Iterable

from django.db import connection

from .average_policy import official_average, resolve_passing_min
from .certificate_service import _passed_year
from .grading_consolidated_report import (
    FIXED_HEADERS,
    _build_pivot,
    _sql_and_params,
)

SUMMARY_HEADERS = [
    "asignaturas_evaluadas",
    "asignaturas_perdidas",
    "asignaturas_pendientes",
    "detalle_reprobacion",
]


def _subject_label(subject: dict, name_counts: dict[str, int]) -> str:
    name = subject["subject_nombre"]
    if name_counts.get(name, 0) > 1 and subject["area_nombre"]:
        return f"{subject['area_nombre']} — {name}"
    return name


def iter_failing_students_csv(filters: dict[str, Any]) -> Iterable[bytes]:
    """
    UTF-8 with BOM for Excel; yields byte chunks for ``StreamingHttpResponse``.

    One row per active enrollment that does not pass the year. Subjects the
    student did pass are omitted from ``detalle_reprobacion``.
    """
    sql, params = _sql_and_params(filters)
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        raw_rows = cursor.fetchall()

    students, subjects, _periods, grades = _build_pivot(raw_rows)
    subjects_by_id = {subject["subject_id"]: subject for subject in subjects}
    passing_by_inst = {
        institution_id: resolve_passing_min(institution_id)
        for institution_id in {student["institution_id"] for student in students}
    }

    values_by_student_subject: dict[tuple, list[Decimal]] = defaultdict(list)
    subjects_by_student: dict[Any, set] = defaultdict(set)
    for (student_id, subject_id, _period_id), (_text, value) in grades.items():
        subjects_by_student[student_id].add(subject_id)
        if value is not None:
            values_by_student_subject[(student_id, subject_id)].append(value)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(FIXED_HEADERS + SUMMARY_HEADERS)
    yield ("\ufeff" + buf.getvalue()).encode("utf-8")
    buf.seek(0)
    buf.truncate(0)

    for student in students:
        student_id = student["student_id"]
        subject_ids = subjects_by_student.get(student_id, set())
        if not subject_ids:
            continue
        passing_min = passing_by_inst[student["institution_id"]]
        minimum = passing_min.quantize(Decimal("0.01"))
        definitives: list[Decimal | None] = []
        failures: list[tuple[str, str, str]] = []
        lost = 0
        pending = 0
        name_counts: dict[str, int] = defaultdict(int)
        resolved = []
        for subject_id in subject_ids:
            subject = subjects_by_id[subject_id]
            name_counts[subject["subject_nombre"]] += 1
            definitive = official_average(
                values_by_student_subject.get((student_id, subject_id), []),
                passing_min,
            )
            definitives.append(definitive)
            resolved.append((subject, definitive))

        if _passed_year(definitives, passing_min):
            continue

        for subject, definitive in resolved:
            label = _subject_label(subject, name_counts)
            sort_name = subject["subject_nombre"]
            if definitive is None:
                pending += 1
                failures.append((subject["area_nombre"], sort_name, f"{label}: PENDIENTE"))
            elif definitive < minimum:
                lost += 1
                failures.append(
                    (subject["area_nombre"], sort_name, f"{label}: {definitive:.2f}")
                )

        failures.sort()
        writer.writerow(
            [student[header] for header in FIXED_HEADERS]
            + [
                str(len(subject_ids)),
                str(lost),
                str(pending),
                "; ".join(item[2] for item in failures),
            ]
        )
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)
