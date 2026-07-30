"""
Roll call (llamado a lista) domain rules.

A roll call is *accumulable*: the same date may be called several times, either
generally for the whole group or by each subject teacher. Every call keeps its
own ``DailyAttendance`` row so the origin stays auditable, but a date only ever
counts once. The consolidated value per (student, date) uses the precedence

    falta con excusa > falta sin excusa > presente

and the resulting day counts are projected onto the group-level ``Attendance``
row (``course_assignment`` null) of the period, which is what the bulletin and
the KPIs read together with the per-subject rows.
"""
from dataclasses import dataclass, field
from datetime import date as date_type
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from django.db import transaction

from .models import (
    AcademicPeriod,
    Attendance,
    CourseAssignment,
    DailyAttendance,
    Enrollment,
    Group,
    Student,
)

STATUS_PRESENT = DailyAttendance.STATUS_PRESENT
STATUS_EXCUSED = DailyAttendance.STATUS_EXCUSED
STATUS_UNEXCUSED = DailyAttendance.STATUS_UNEXCUSED

#: Higher wins when a date has conflicting entries from different roll calls.
STATUS_PRECEDENCE: Dict[str, int] = {
    STATUS_PRESENT: 0,
    STATUS_UNEXCUSED: 1,
    STATUS_EXCUSED: 2,
}


class RollCallError(Exception):
    """Business rule violation while saving a roll call."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class RollCallSaveResult:
    group: Group
    academic_period: AcademicPeriod
    date: date_type
    course_assignment: Optional[CourseAssignment]
    created: int
    updated: int
    students_processed: int
    attendance_rows_synced: int
    present_count: int
    excused_count: int
    unexcused_count: int
    warnings: List[str] = field(default_factory=list)


def consolidate_statuses(statuses: Iterable[str]) -> Optional[str]:
    """Single value for a date given every roll-call entry recorded for it."""
    best: Optional[str] = None
    for status in statuses:
        if status not in STATUS_PRECEDENCE:
            continue
        if best is None or STATUS_PRECEDENCE[status] > STATUS_PRECEDENCE[best]:
            best = status
    return best


def resolve_academic_period(group: Group, day: date_type) -> Optional[AcademicPeriod]:
    """Period of the group's academic year containing ``day``, if its dates are configured."""
    return (
        AcademicPeriod.objects.filter(
            academic_year_id=group.academic_year_id,
            start_date__lte=day,
            end_date__gte=day,
        )
        .order_by("number")
        .first()
    )


def group_roster(group: Group):
    """Students actively enrolled in the group for its academic year."""
    return (
        Student.objects.filter(
            enrollments__group_id=group.id,
            enrollments__academic_year_id=group.academic_year_id,
            enrollments__status="active",
        )
        .distinct()
        .order_by("full_name", "document_number")
    )


def consolidated_day_statuses(
    *,
    group_id,
    academic_period_id,
    student_ids: Optional[Sequence] = None,
) -> Dict[Tuple, str]:
    """Map ``(student_id, date)`` to its single consolidated status."""
    rows = DailyAttendance.objects.filter(
        group_id=group_id, academic_period_id=academic_period_id
    )
    if student_ids is not None:
        rows = rows.filter(student_id__in=list(student_ids))

    consolidated: Dict[Tuple, str] = {}
    for student_id, day, status in rows.values_list("student_id", "date", "status"):
        key = (student_id, day)
        current = consolidated.get(key)
        if current is None or STATUS_PRECEDENCE.get(status, -1) > STATUS_PRECEDENCE.get(
            current, -1
        ):
            consolidated[key] = status
    return consolidated


def recompute_general_attendance(
    *,
    group: Group,
    academic_period: AcademicPeriod,
    student_ids: Optional[Sequence] = None,
) -> int:
    """
    Rebuild the group-level ``Attendance`` rows from the roll call.

    Returns the number of rows written or removed. Only rows with
    ``course_assignment`` null are touched, so per-subject records loaded by hand
    or via CSV stay untouched. Students without absences keep no row: the module
    tracks absences, not attendance days.
    """
    consolidated = consolidated_day_statuses(
        group_id=group.id,
        academic_period_id=academic_period.id,
        student_ids=student_ids,
    )

    counts: Dict[object, Dict[str, int]] = {}
    for (student_id, _day), status in consolidated.items():
        bucket = counts.setdefault(student_id, {"excused": 0, "unexcused": 0})
        if status == STATUS_EXCUSED:
            bucket["excused"] += 1
        elif status == STATUS_UNEXCUSED:
            bucket["unexcused"] += 1

    existing_general = Attendance.objects.filter(
        group=group, academic_period=academic_period, course_assignment=None
    )
    if student_ids is not None:
        existing_general = existing_general.filter(student_id__in=list(student_ids))

    target_ids: Set = set(counts) | set(existing_general.values_list("student_id", flat=True))
    if student_ids is not None:
        target_ids |= set(student_ids)

    synced = 0
    for student_id in target_ids:
        bucket = counts.get(student_id)
        if bucket is None or not (bucket["unexcused"] or bucket["excused"]):
            deleted, _ = Attendance.objects.filter(
                student_id=student_id,
                group=group,
                academic_period=academic_period,
                course_assignment=None,
            ).delete()
            synced += 1 if deleted else 0
            continue
        Attendance.objects.update_or_create(
            student_id=student_id,
            group=group,
            academic_period=academic_period,
            course_assignment=None,
            defaults={
                "unexcused_absences": bucket["unexcused"],
                "excused_absences": bucket["excused"],
            },
        )
        synced += 1
    return synced


def migrate_roll_call_to_group(
    *,
    student_id,
    source_group: Group,
    target_group: Group,
    target_assignment_by_subject: Dict,
    warnings: List[str],
) -> Tuple[int, int]:
    """
    Move a student's roll call to the group they were transferred to.

    General entries only change group. Subject entries follow the same subject
    matching used for grades: without an equivalent subject in the target group
    the entry is dropped, since keeping it would attribute the day to a course
    the student no longer takes. Group-level ``Attendance`` totals are rebuilt on
    both sides afterwards. Returns ``(migrated, dropped)``.
    """
    rows = list(
        DailyAttendance.objects.filter(
            student_id=student_id, group_id=source_group.id
        ).select_related("course_assignment__subject")
    )
    migrated = 0
    dropped = 0
    affected_period_ids: Set = set()
    warned_subjects: Set = set()

    for row in rows:
        affected_period_ids.add(row.academic_period_id)
        if row.course_assignment_id is None:
            row.group_id = target_group.id
            row.save(update_fields=["group_id", "updated_at"])
            migrated += 1
            continue

        subject = row.course_assignment.subject
        target_ca_id = target_assignment_by_subject.get(subject.id)
        if not target_ca_id:
            row.delete()
            dropped += 1
            if subject.name not in warned_subjects:
                warned_subjects.add(subject.name)
                warnings.append(
                    f"El llamado a lista de '{subject.name}' se eliminó: la asignatura "
                    "no existe en el grupo destino."
                )
            continue

        conflict = (
            DailyAttendance.objects.filter(
                student_id=student_id, date=row.date, course_assignment_id=target_ca_id
            )
            .exclude(pk=row.pk)
            .exists()
        )
        if conflict:
            row.delete()
            dropped += 1
            continue

        row.group_id = target_group.id
        row.course_assignment_id = target_ca_id
        row.save(update_fields=["group_id", "course_assignment_id", "updated_at"])
        migrated += 1

    for period in AcademicPeriod.objects.filter(pk__in=affected_period_ids):
        recompute_general_attendance(
            group=source_group, academic_period=period, student_ids=[student_id]
        )
        recompute_general_attendance(
            group=target_group, academic_period=period, student_ids=[student_id]
        )

    return migrated, dropped


def _validate_course_assignment(group: Group, course_assignment_id) -> CourseAssignment:
    course_assignment = (
        CourseAssignment.objects.filter(pk=course_assignment_id)
        .select_related("subject", "teacher")
        .first()
    )
    if not course_assignment:
        raise RollCallError(
            "assignment_not_found", "La asignación docente-curso no existe."
        )
    if course_assignment.group_id != group.id:
        raise RollCallError(
            "assignment_not_in_group",
            "La asignación docente-curso no pertenece al grupo seleccionado.",
        )
    return course_assignment


@transaction.atomic
def save_roll_call(
    *,
    group_id,
    day: date_type,
    entries: Sequence[dict],
    course_assignment_id=None,
    academic_period_id=None,
    recorded_by=None,
) -> RollCallSaveResult:
    """
    Persist a whole roll call in one shot and refresh the period totals.

    ``entries`` items carry ``student``, ``status`` and an optional ``notes``.
    Re-calling the same source (group + date + subject, or group + date for a
    general call) updates the previous entries instead of duplicating them.
    """
    group = (
        Group.objects.filter(pk=group_id)
        .select_related("academic_year", "campus", "grade_level")
        .first()
    )
    if not group:
        raise RollCallError("group_not_found", "El grupo no existe.")

    if not entries:
        raise RollCallError("empty_roll_call", "El llamado a lista no tiene estudiantes.")

    student_ids = [entry["student"] for entry in entries]
    if len(set(student_ids)) != len(student_ids):
        raise RollCallError(
            "duplicated_student", "Hay estudiantes repetidos en el llamado a lista."
        )

    if academic_period_id:
        academic_period = AcademicPeriod.objects.filter(
            pk=academic_period_id, academic_year_id=group.academic_year_id
        ).first()
        if not academic_period:
            raise RollCallError(
                "period_not_in_year",
                "El periodo no pertenece al año lectivo del grupo.",
            )
    else:
        academic_period = resolve_academic_period(group, day)
        if not academic_period:
            raise RollCallError(
                "period_not_found",
                "Ninguna fecha de periodo cubre el día seleccionado; "
                "indica el periodo o configura las fechas de los periodos.",
            )

    course_assignment = (
        _validate_course_assignment(group, course_assignment_id)
        if course_assignment_id
        else None
    )

    enrolled_ids = set(
        Enrollment.objects.filter(
            group_id=group.id,
            academic_year_id=group.academic_year_id,
            status="active",
            student_id__in=student_ids,
        ).values_list("student_id", flat=True)
    )
    missing = [str(sid) for sid in student_ids if sid not in enrolled_ids]
    if missing:
        raise RollCallError(
            "student_not_enrolled",
            "Hay estudiantes que no tienen matrícula activa en el grupo: "
            + ", ".join(missing),
        )

    created = 0
    updated = 0
    tally = {STATUS_PRESENT: 0, STATUS_EXCUSED: 0, STATUS_UNEXCUSED: 0}
    for entry in entries:
        status = entry["status"]
        tally[status] = tally.get(status, 0) + 1
        _, was_created = DailyAttendance.objects.update_or_create(
            student_id=entry["student"],
            date=day,
            course_assignment=course_assignment,
            defaults={
                "group": group,
                "academic_period": academic_period,
                "status": status,
                "notes": entry.get("notes") or "",
                "recorded_by": recorded_by,
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    synced = recompute_general_attendance(
        group=group,
        academic_period=academic_period,
        student_ids=student_ids,
    )

    return RollCallSaveResult(
        group=group,
        academic_period=academic_period,
        date=day,
        course_assignment=course_assignment,
        created=created,
        updated=updated,
        students_processed=len(entries),
        attendance_rows_synced=synced,
        present_count=tally[STATUS_PRESENT],
        excused_count=tally[STATUS_EXCUSED],
        unexcused_count=tally[STATUS_UNEXCUSED],
    )
