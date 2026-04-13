"""Aggregated counts for the admin dashboard (KPIs per domain model)."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional
from uuid import UUID

from django.db.models import Exists, OuterRef

from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicIndicatorsReport,
    AcademicPeriod,
    AcademicYear,
    Attendance,
    Campus,
    CourseAssignment,
    DisciplinaryReport,
    Enrollment,
    Grade,
    GradeDirector,
    GradingScale,
    GradeLevel,
    Group,
    Institution,
    Parent,
    PerformanceSummary,
    SchoolRecord,
    Student,
    StudentGuardian,
    Subject,
    Teacher,
)


def empty_dashboard_kpis() -> dict[str, int]:
    """All-zero KPI row (no DB reads)."""
    return {
        "institutions": 0,
        "campuses": 0,
        "academic_years": 0,
        "academic_years_active": 0,
        "grade_levels": 0,
        "academic_areas": 0,
        "subjects": 0,
        "grading_scales": 0,
        "groups": 0,
        "academic_periods": 0,
        "students": 0,
        "teachers": 0,
        "parents": 0,
        "enrollments": 0,
        "enrollments_active": 0,
        "course_assignments": 0,
        "grade_directors": 0,
        "grades": 0,
        "attendances": 0,
        "academic_indicators": 0,
        "performance_summaries": 0,
        "disciplinary_reports": 0,
        "school_records": 0,
        "academic_indicators_reports": 0,
        "student_guardians": 0,
    }


def compute_kpis_global() -> dict[str, Any]:
    row = empty_dashboard_kpis()
    row["institutions"] = Institution.objects.count()
    row["campuses"] = Campus.objects.count()
    row["academic_years"] = AcademicYear.objects.count()
    row["academic_years_active"] = AcademicYear.objects.filter(is_active=True).count()
    row["grade_levels"] = GradeLevel.objects.count()
    row["academic_areas"] = AcademicArea.objects.count()
    row["subjects"] = Subject.objects.count()
    row["grading_scales"] = GradingScale.objects.count()
    row["groups"] = Group.objects.count()
    row["academic_periods"] = AcademicPeriod.objects.count()
    row["students"] = Student.objects.count()
    row["teachers"] = Teacher.objects.count()
    row["parents"] = Parent.objects.count()
    row["enrollments"] = Enrollment.objects.count()
    row["enrollments_active"] = Enrollment.objects.filter(status="active").count()
    row["course_assignments"] = CourseAssignment.objects.count()
    row["grade_directors"] = GradeDirector.objects.count()
    row["grades"] = Grade.objects.count()
    row["attendances"] = Attendance.objects.count()
    row["academic_indicators"] = AcademicIndicator.objects.count()
    row["performance_summaries"] = PerformanceSummary.objects.count()
    row["disciplinary_reports"] = DisciplinaryReport.objects.count()
    row["school_records"] = SchoolRecord.objects.count()
    row["academic_indicators_reports"] = AcademicIndicatorsReport.objects.count()
    row["student_guardians"] = StudentGuardian.objects.count()
    return row


def compute_kpis_institution(institution_id: UUID) -> dict[str, Any]:
    row = empty_dashboard_kpis()
    inst = Institution.objects.filter(pk=institution_id).first()
    if not inst:
        return row

    row["institutions"] = 1
    row["campuses"] = Campus.objects.filter(institution_id=institution_id).count()
    row["academic_years"] = AcademicYear.objects.filter(institution_id=institution_id).count()
    row["academic_years_active"] = AcademicYear.objects.filter(
        institution_id=institution_id, is_active=True
    ).count()
    row["grade_levels"] = GradeLevel.objects.filter(institution_id=institution_id).count()
    row["academic_areas"] = AcademicArea.objects.filter(institution_id=institution_id).count()
    row["subjects"] = Subject.objects.filter(institution_id=institution_id).count()
    row["grading_scales"] = GradingScale.objects.filter(institution_id=institution_id).count()
    row["groups"] = Group.objects.filter(academic_year__institution_id=institution_id).count()
    row["academic_periods"] = AcademicPeriod.objects.filter(
        academic_year__institution_id=institution_id
    ).count()
    row["students"] = (
        Student.objects.filter(enrollments__academic_year__institution_id=institution_id)
        .distinct()
        .count()
    )
    row["teachers"] = (
        Teacher.objects.filter(course_assignments__academic_year__institution_id=institution_id)
        .distinct()
        .count()
    )
    row["parents"] = (
        Parent.objects.filter(
            students__student__enrollments__academic_year__institution_id=institution_id
        )
        .distinct()
        .count()
    )
    row["enrollments"] = Enrollment.objects.filter(
        academic_year__institution_id=institution_id
    ).count()
    row["enrollments_active"] = Enrollment.objects.filter(
        academic_year__institution_id=institution_id, status="active"
    ).count()
    row["course_assignments"] = CourseAssignment.objects.filter(
        academic_year__institution_id=institution_id
    ).count()
    row["grade_directors"] = GradeDirector.objects.filter(
        academic_year__institution_id=institution_id
    ).count()
    row["grades"] = Grade.objects.filter(
        course_assignment__academic_year__institution_id=institution_id
    ).count()
    row["attendances"] = Attendance.objects.filter(
        course_assignment__academic_year__institution_id=institution_id
    ).count()
    row["academic_indicators"] = AcademicIndicator.objects.filter(
        course_assignment__academic_year__institution_id=institution_id
    ).count()
    row["performance_summaries"] = PerformanceSummary.objects.filter(
        group__academic_year__institution_id=institution_id
    ).count()
    row["disciplinary_reports"] = DisciplinaryReport.objects.filter(
        academic_period__academic_year__institution_id=institution_id
    ).count()
    row["school_records"] = SchoolRecord.objects.filter(institution_id=institution_id).count()
    row["academic_indicators_reports"] = AcademicIndicatorsReport.objects.filter(
        group__academic_year__institution_id=institution_id
    ).count()
    row["student_guardians"] = (
        StudentGuardian.objects.filter(
            student__enrollments__academic_year__institution_id=institution_id
        )
        .distinct()
        .count()
    )
    return row


def compute_kpis_teacher(teacher_id: UUID) -> dict[str, Any]:
    row = empty_dashboard_kpis()
    ca = CourseAssignment.objects.filter(teacher_id=teacher_id)
    if not ca.exists():
        return row

    year_ids = list(ca.values_list("academic_year_id", flat=True).distinct())
    inst_ids = list(
        AcademicYear.objects.filter(id__in=year_ids).values_list("institution_id", flat=True).distinct()
    )
    row["institutions"] = len(inst_ids)
    group_ids = list(ca.values_list("group_id", flat=True).distinct())
    row["groups"] = len(group_ids)
    row["campuses"] = Group.objects.filter(id__in=group_ids).values("campus_id").distinct().count()
    row["academic_years"] = len(year_ids)
    row["academic_years_active"] = AcademicYear.objects.filter(
        id__in=year_ids, is_active=True
    ).count()
    row["academic_periods"] = AcademicPeriod.objects.filter(academic_year_id__in=year_ids).count()
    row["subjects"] = ca.values("subject_id").distinct().count()
    row["course_assignments"] = ca.count()

    enrollment_qs = Enrollment.objects.filter(
        Exists(
            CourseAssignment.objects.filter(
                teacher_id=teacher_id,
                group_id=OuterRef("group_id"),
                academic_year_id=OuterRef("academic_year_id"),
            )
        )
    )
    row["enrollments"] = enrollment_qs.count()
    row["enrollments_active"] = enrollment_qs.filter(status="active").count()
    row["students"] = enrollment_qs.values("student_id").distinct().count()

    row["grades"] = Grade.objects.filter(course_assignment__teacher_id=teacher_id).count()
    row["attendances"] = Attendance.objects.filter(
        course_assignment__teacher_id=teacher_id
    ).count()
    row["academic_indicators"] = AcademicIndicator.objects.filter(
        course_assignment__teacher_id=teacher_id
    ).count()
    student_sub = enrollment_qs.values("student_id")
    row["performance_summaries"] = PerformanceSummary.objects.filter(
        student_id__in=student_sub,
        group_id__in=group_ids,
    ).count()
    row["disciplinary_reports"] = DisciplinaryReport.objects.filter(
        student_id__in=student_sub
    ).count()
    row["school_records"] = SchoolRecord.objects.filter(student_id__in=student_sub).count()
    row["academic_indicators_reports"] = AcademicIndicatorsReport.objects.filter(
        student_id__in=student_sub
    ).count()
    row["student_guardians"] = StudentGuardian.objects.filter(
        student_id__in=student_sub
    ).count()
    row["parents"] = Parent.objects.filter(
        students__student_id__in=enrollment_qs.values("student_id")
    ).distinct().count()
    row["teachers"] = 1
    if inst_ids:
        row["grade_levels"] = GradeLevel.objects.filter(institution_id__in=inst_ids).count()
        row["academic_areas"] = AcademicArea.objects.filter(institution_id__in=inst_ids).count()
        row["grading_scales"] = GradingScale.objects.filter(institution_id__in=inst_ids).count()
        row["grade_directors"] = GradeDirector.objects.filter(
            academic_year_id__in=year_ids, group_id__in=group_ids
        ).count()
    return row


def compute_kpis_parent(parent_id: UUID) -> dict[str, Any]:
    row = empty_dashboard_kpis()
    student_ids = list(
        StudentGuardian.objects.filter(parent_id=parent_id).values_list(
            "student_id", flat=True
        ).distinct()
    )
    if not student_ids:
        return row

    row["students"] = len(student_ids)
    row["parents"] = 1
    enroll_qs = Enrollment.objects.filter(student_id__in=student_ids)
    row["enrollments"] = enroll_qs.count()
    row["enrollments_active"] = enroll_qs.filter(status="active").count()
    year_ids = list(enroll_qs.values_list("academic_year_id", flat=True).distinct())
    inst_ids = list(
        AcademicYear.objects.filter(id__in=year_ids).values_list("institution_id", flat=True).distinct()
    )
    row["institutions"] = len(inst_ids)
    row["academic_years"] = len(year_ids)
    row["academic_years_active"] = AcademicYear.objects.filter(
        id__in=year_ids, is_active=True
    ).count()
    row["groups"] = enroll_qs.values("group_id").distinct().count()
    row["campuses"] = (
        Group.objects.filter(id__in=enroll_qs.values_list("group_id", flat=True))
        .values("campus_id")
        .distinct()
        .count()
    )
    row["academic_periods"] = AcademicPeriod.objects.filter(academic_year_id__in=year_ids).count()
    row["grades"] = Grade.objects.filter(student_id__in=student_ids).count()
    row["attendances"] = Attendance.objects.filter(student_id__in=student_ids).count()
    row["academic_indicators"] = AcademicIndicator.objects.filter(
        student_id__in=student_ids
    ).count()
    row["performance_summaries"] = PerformanceSummary.objects.filter(
        student_id__in=student_ids
    ).count()
    row["disciplinary_reports"] = DisciplinaryReport.objects.filter(
        student_id__in=student_ids
    ).count()
    row["school_records"] = SchoolRecord.objects.filter(student_id__in=student_ids).count()
    row["academic_indicators_reports"] = AcademicIndicatorsReport.objects.filter(
        student_id__in=student_ids
    ).count()
    row["student_guardians"] = StudentGuardian.objects.filter(
        student_id__in=student_ids
    ).count()
    if inst_ids:
        row["grade_levels"] = GradeLevel.objects.filter(institution_id__in=inst_ids).count()
        row["academic_areas"] = AcademicArea.objects.filter(institution_id__in=inst_ids).count()
        row["subjects"] = Subject.objects.filter(institution_id__in=inst_ids).count()
        row["grading_scales"] = GradingScale.objects.filter(institution_id__in=inst_ids).count()
        row["course_assignments"] = CourseAssignment.objects.filter(
            academic_year_id__in=year_ids,
            group_id__in=enroll_qs.values("group_id"),
        ).count()
        row["grade_directors"] = GradeDirector.objects.filter(
            academic_year_id__in=year_ids,
            group_id__in=enroll_qs.values("group_id"),
        ).count()
    return row


def compute_grades_pending_for_period(
    period_id: UUID,
    *,
    institution_scope_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    parent_id: Optional[UUID] = None,
) -> Optional[dict[str, Any]]:
    """
    For an academic period, count expected grade slots (active enrollments × course
    assignments in the same group/year), how many are filled, and how many distinct
    students still miss at least one grade in that period.
    """
    try:
        period = AcademicPeriod.objects.select_related("academic_year").get(pk=period_id)
    except AcademicPeriod.DoesNotExist:
        return None

    year_id = period.academic_year_id

    enroll_qs = Enrollment.objects.filter(academic_year_id=year_id, status="active")
    if institution_scope_id:
        enroll_qs = enroll_qs.filter(academic_year__institution_id=institution_scope_id)

    if parent_id:
        child_ids = StudentGuardian.objects.filter(parent_id=parent_id).values_list(
            "student_id", flat=True
        )
        enroll_qs = enroll_qs.filter(student_id__in=child_ids)

    if teacher_id:
        group_ids = (
            CourseAssignment.objects.filter(teacher_id=teacher_id, academic_year_id=year_id)
            .values_list("group_id", flat=True)
            .distinct()
        )
        enroll_qs = enroll_qs.filter(group_id__in=group_ids)

    enrollments = list(enroll_qs.values_list("student_id", "group_id"))

    ca_qs = CourseAssignment.objects.filter(academic_year_id=year_id)
    if teacher_id:
        ca_qs = ca_qs.filter(teacher_id=teacher_id)
    ca_by_group: dict[UUID, list[UUID]] = defaultdict(list)
    for ca_id, gid in ca_qs.values_list("id", "group_id"):
        ca_by_group[gid].append(ca_id)

    graded_pairs = set(
        Grade.objects.filter(academic_period_id=period_id).values_list(
            "student_id", "course_assignment_id"
        )
    )

    pending_students: set[UUID] = set()
    expected = 0
    pending_slots = 0
    for student_id, group_id in enrollments:
        for ca_id in ca_by_group.get(group_id, []):
            expected += 1
            if (student_id, ca_id) not in graded_pairs:
                pending_slots += 1
                pending_students.add(student_id)

    filled_slots = expected - pending_slots
    return {
        "academic_period_id": str(period_id),
        "academic_period_name": period.name,
        "academic_year_id": str(year_id),
        "expected_slots": expected,
        "filled_slots": filled_slots,
        "pending_slots": pending_slots,
        "pending_students": len(pending_students),
    }
