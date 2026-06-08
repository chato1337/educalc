"""
Orchestrate student transfer within the same academic year.

Withdraws the active enrollment, creates one in the target group, migrates evaluation
data (grades, attendance, academic indicators) by matching subject, recalculates
performance summaries, and regenerates school / indicators report snapshots.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional, Set, Tuple

from django.db import transaction
from django.utils import timezone

from .models import (
    AcademicIndicator,
    AcademicIndicatorsReport,
    AcademicPeriod,
    Attendance,
    CourseAssignment,
    Enrollment,
    Grade,
    GradeDirector,
    Group,
    PerformanceSummary,
    SchoolRecord,
    Student,
)
from .performance_summary_service import (
    suppress_performance_summary_sync,
    sync_many_group_periods,
)


class StudentTransferError(Exception):
    """Validation or business-rule failure during transfer."""

    def __init__(self, message: str, code: str = "invalid_transfer"):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class StudentTransferResult:
    old_enrollment: Enrollment
    new_enrollment: Enrollment
    source_group: Group
    target_group: Group
    grades_migrated: int = 0
    grades_skipped: int = 0
    attendances_migrated: int = 0
    attendances_skipped: int = 0
    academic_indicators_migrated: int = 0
    academic_indicators_skipped: int = 0
    performance_pairs_synced: int = 0
    school_record_regenerated: bool = False
    academic_indicators_reports_regenerated: int = 0
    warnings: List[str] = field(default_factory=list)


def _build_target_assignment_map(target_group_id) -> Dict:
    return {
        row["subject_id"]: row["id"]
        for row in CourseAssignment.objects.filter(group_id=target_group_id).values(
            "id", "subject_id"
        )
    }


def _migrate_course_assignment_rows(
    *,
    model,
    student_id,
    source_group_id,
    target_assignment_by_subject: Dict,
    warnings: List[str],
) -> Tuple[int, int, Set]:
    """
    Re-point rows tied to source group course assignments to the target group equivalents.
    Returns (migrated_count, skipped_count, affected_period_ids).
    """
    rows = list(
        model.objects.filter(
            student_id=student_id,
            course_assignment__group_id=source_group_id,
        ).select_related("course_assignment__subject", "academic_period")
    )
    migrated = 0
    skipped = 0
    affected_period_ids: Set = set()
    warned_subjects: Set = set()

    for row in rows:
        subject_id = row.course_assignment.subject_id
        subject_name = row.course_assignment.subject.name
        target_ca_id = target_assignment_by_subject.get(subject_id)
        if not target_ca_id:
            skipped += 1
            if subject_name not in warned_subjects:
                warned_subjects.add(subject_name)
                warnings.append(
                    f"La asignatura '{subject_name}' no existe en el grupo destino; "
                    "sus registros fueron omitidos."
                )
            continue

        if row.course_assignment_id == target_ca_id:
            affected_period_ids.add(row.academic_period_id)
            continue

        conflict = model.objects.filter(
            student_id=student_id,
            course_assignment_id=target_ca_id,
            academic_period_id=row.academic_period_id,
        ).exclude(pk=row.pk).exists()
        if conflict:
            skipped += 1
            warnings.append(
                f"Conflicto al migrar '{subject_name}' en {row.academic_period.name}: "
                "ya existe un registro en el grupo destino."
            )
            continue

        row.course_assignment_id = target_ca_id
        row.save(update_fields=["course_assignment_id", "updated_at"])
        migrated += 1
        affected_period_ids.add(row.academic_period_id)

    return migrated, skipped, affected_period_ids


def _regenerate_school_record(
    *,
    student: Student,
    academic_year_id,
    group: Group,
) -> bool:
    institution = group.campus.institution
    record, _created = SchoolRecord.objects.update_or_create(
        student=student,
        academic_year_id=academic_year_id,
        defaults={
            "group": group,
            "institution": institution,
            "campus": group.campus,
            "generated_at": timezone.now(),
        },
    )
    if not _created:
        record.group = group
        record.institution = institution
        record.campus = group.campus
        record.generated_at = timezone.now()
        record.save(
            update_fields=[
                "group",
                "institution",
                "campus",
                "generated_at",
                "updated_at",
            ]
        )
    return True


def _regenerate_academic_indicators_reports(
    *,
    student: Student,
    academic_year_id,
    group: Group,
    period_ids: Set,
    warnings: List[str],
) -> int:
    grade_director = (
        GradeDirector.objects.filter(group=group, academic_year_id=academic_year_id)
        .select_related("teacher")
        .first()
    )
    if not grade_director:
        warnings.append(
            "No hay director de grupo en el destino; no se regeneraron informes de indicadores."
        )
        return 0

    periods_qs = AcademicPeriod.objects.filter(academic_year_id=academic_year_id)
    if period_ids:
        periods_qs = periods_qs.filter(id__in=period_ids)

    regenerated = 0
    now = timezone.now()
    for period in periods_qs:
        record, _created = AcademicIndicatorsReport.objects.update_or_create(
            student=student,
            academic_period=period,
            defaults={
                "group": group,
                "grade_director": grade_director.teacher,
                "generated_at": now,
            },
        )
        if not _created:
            record.group = group
            record.grade_director = grade_director.teacher
            record.generated_at = now
            record.save(
                update_fields=[
                    "group",
                    "grade_director",
                    "generated_at",
                    "updated_at",
                ]
            )
        regenerated += 1
    return regenerated


@transaction.atomic
def transfer_student(
    *,
    student_id,
    target_group_id,
    transfer_date: Optional[date] = None,
) -> StudentTransferResult:
    """
    Transfer ``student_id`` to ``target_group_id`` within the same academic year.

    Raises ``StudentTransferError`` when validation fails.
    """
    warnings: List[str] = []

    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist as exc:
        raise StudentTransferError("Estudiante no encontrado.", code="student_not_found") from exc

    try:
        target_group = Group.objects.select_related(
            "campus__institution", "grade_level", "academic_year"
        ).get(pk=target_group_id)
    except Group.DoesNotExist as exc:
        raise StudentTransferError("Grupo destino no encontrado.", code="group_not_found") from exc

    source_enrollment = (
        Enrollment.objects.filter(
            student=student,
            academic_year_id=target_group.academic_year_id,
            status="active",
        )
        .select_related("group__campus__institution", "group__grade_level")
        .first()
    )
    if not source_enrollment:
        raise StudentTransferError(
            "No hay matrícula activa para el estudiante en el año lectivo del grupo destino.",
            code="no_active_enrollment",
        )

    source_group = source_enrollment.group
    if source_group.id == target_group.id:
        raise StudentTransferError(
            "El grupo destino debe ser diferente al grupo actual.",
            code="same_group",
        )

    if source_group.campus.institution_id != target_group.campus.institution_id:
        raise StudentTransferError(
            "El grupo destino debe pertenecer a la misma institución.",
            code="institution_mismatch",
        )

    source_enrollment.status = "withdrawn"
    source_enrollment.save(update_fields=["status", "updated_at"])

    new_enrollment, created = Enrollment.objects.get_or_create(
        student=student,
        group=target_group,
        academic_year_id=target_group.academic_year_id,
        defaults={
            "enrollment_date": transfer_date,
            "status": "active",
        },
    )
    if not created:
        new_enrollment.status = "active"
        if transfer_date:
            new_enrollment.enrollment_date = transfer_date
        new_enrollment.save(
            update_fields=["status", "enrollment_date", "updated_at"]
        )

    target_assignment_by_subject = _build_target_assignment_map(target_group.id)
    affected_period_ids: Set = set()

    with suppress_performance_summary_sync():
        grades_migrated, grades_skipped, grade_periods = _migrate_course_assignment_rows(
            model=Grade,
            student_id=student.id,
            source_group_id=source_group.id,
            target_assignment_by_subject=target_assignment_by_subject,
            warnings=warnings,
        )
        attendances_migrated, attendances_skipped, att_periods = (
            _migrate_course_assignment_rows(
                model=Attendance,
                student_id=student.id,
                source_group_id=source_group.id,
                target_assignment_by_subject=target_assignment_by_subject,
                warnings=warnings,
            )
        )
        indicators_migrated, indicators_skipped, ind_periods = (
            _migrate_course_assignment_rows(
                model=AcademicIndicator,
                student_id=student.id,
                source_group_id=source_group.id,
                target_assignment_by_subject=target_assignment_by_subject,
                warnings=warnings,
            )
        )
        affected_period_ids.update(grade_periods)
        affected_period_ids.update(att_periods)
        affected_period_ids.update(ind_periods)

        PerformanceSummary.objects.filter(
            student_id=student.id,
            group_id=source_group.id,
        ).delete()

    sync_pairs = set()
    for period_id in affected_period_ids:
        sync_pairs.add((source_group.id, period_id))
        sync_pairs.add((target_group.id, period_id))
    if sync_pairs:
        sync_many_group_periods(sync_pairs)

    school_record_regenerated = _regenerate_school_record(
        student=student,
        academic_year_id=target_group.academic_year_id,
        group=target_group,
    )
    reports_regenerated = _regenerate_academic_indicators_reports(
        student=student,
        academic_year_id=target_group.academic_year_id,
        group=target_group,
        period_ids=affected_period_ids,
        warnings=warnings,
    )

    return StudentTransferResult(
        old_enrollment=source_enrollment,
        new_enrollment=new_enrollment,
        source_group=source_group,
        target_group=target_group,
        grades_migrated=grades_migrated,
        grades_skipped=grades_skipped,
        attendances_migrated=attendances_migrated,
        attendances_skipped=attendances_skipped,
        academic_indicators_migrated=indicators_migrated,
        academic_indicators_skipped=indicators_skipped,
        performance_pairs_synced=len(sync_pairs),
        school_record_regenerated=school_record_regenerated,
        academic_indicators_reports_regenerated=reports_regenerated,
        warnings=warnings,
    )
