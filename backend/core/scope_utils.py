"""Shared RBAC scope helpers for queryset filtering and access checks."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet

from .models import (
    AcademicYear,
    CourseAssignment,
    Enrollment,
    Group,
    StudentGuardian,
)


def get_user_profile(user):
    if not user or not user.is_authenticated:
        return None
    return getattr(user, "profile", None)


def teacher_assignments_qs(teacher) -> QuerySet:
    return CourseAssignment.objects.filter(teacher=teacher)


def teacher_group_ids(teacher):
    return teacher_assignments_qs(teacher).values_list("group_id", flat=True).distinct()


def teacher_year_ids(teacher):
    return teacher_assignments_qs(teacher).values_list("academic_year_id", flat=True).distinct()


def teacher_subject_ids(teacher):
    return teacher_assignments_qs(teacher).values_list("subject_id", flat=True).distinct()


def teacher_campus_ids(teacher):
    return (
        Group.objects.filter(id__in=teacher_group_ids(teacher))
        .values_list("campus_id", flat=True)
        .distinct()
    )


def teacher_institution_ids(teacher):
    return (
        AcademicYear.objects.filter(id__in=teacher_year_ids(teacher))
        .values_list("institution_id", flat=True)
        .distinct()
    )


def teacher_enrollment_scope_filter(teacher):
    return Exists(
        CourseAssignment.objects.filter(
            teacher=teacher,
            group_id=OuterRef("group_id"),
            academic_year_id=OuterRef("academic_year_id"),
        )
    )


def teacher_student_ids(teacher):
    """Students with an active enrollment in a group this teacher teaches."""
    return (
        Enrollment.objects.filter(
            teacher_enrollment_scope_filter(teacher),
            status="active",
        )
        .values_list("student_id", flat=True)
        .distinct()
    )


def exclude_withdrawn_only_students(queryset: QuerySet) -> QuerySet:
    """Omit students whose enrollments are all withdrawn.

    A student with no enrollment stays visible (not enrolled yet). A student
    with an active or graduated enrollment stays visible even if another
    enrollment was withdrawn, for example after a transfer.
    """
    non_withdrawn = Enrollment.objects.filter(student_id=OuterRef("pk")).exclude(
        status="withdrawn"
    )
    any_enrollment = Enrollment.objects.filter(student_id=OuterRef("pk"))
    return queryset.alias(
        has_enrollment=Exists(any_enrollment),
        has_non_withdrawn_enrollment=Exists(non_withdrawn),
    ).exclude(has_enrollment=True, has_non_withdrawn_enrollment=False)


def parent_student_ids_qs(parent_id):
    return StudentGuardian.objects.filter(parent_id=parent_id).values_list(
        "student_id", flat=True
    )


def parent_student_ids(parent_id):
    return list(parent_student_ids_qs(parent_id).distinct())


def parent_institution_ids(parent_id):
    return (
        AcademicYear.objects.filter(
            enrollments__student_id__in=parent_student_ids_qs(parent_id)
        )
        .values_list("institution_id", flat=True)
        .distinct()
    )


def teacher_can_access_student(teacher, student_id) -> bool:
    return Enrollment.objects.filter(
        student_id=student_id,
    ).filter(teacher_enrollment_scope_filter(teacher)).exists()


def teacher_can_access_group(teacher, group_id) -> bool:
    return teacher_assignments_qs(teacher).filter(group_id=group_id).exists()


def teacher_can_access_course_assignment(teacher, course_assignment_id) -> bool:
    return teacher_assignments_qs(teacher).filter(pk=course_assignment_id).exists()


def parent_can_access_student(parent_id, student_id) -> bool:
    return StudentGuardian.objects.filter(
        parent_id=parent_id, student_id=student_id
    ).exists()


def user_can_access_student(request, student_id) -> bool:
    profile = get_user_profile(request.user)
    if not profile:
        return False
    if profile.role == "ADMIN":
        return True
    if profile.role == "COORDINATOR":
        if not profile.institution_id:
            return False
        return Enrollment.objects.filter(
            student_id=student_id,
            academic_year__institution_id=profile.institution_id,
        ).exists()
    if profile.role == "TEACHER" and profile.teacher_id:
        return teacher_can_access_student(profile.teacher, student_id)
    if profile.role == "PARENT" and profile.parent_id:
        return parent_can_access_student(profile.parent_id, student_id)
    return False


def user_can_access_group(request, group_id) -> bool:
    profile = get_user_profile(request.user)
    if not profile:
        return False
    if profile.role == "ADMIN":
        return True
    try:
        group = Group.objects.select_related("academic_year").get(pk=group_id)
    except Group.DoesNotExist:
        return False
    if profile.role == "COORDINATOR":
        return (
            profile.institution_id is not None
            and group.academic_year.institution_id == profile.institution_id
        )
    if profile.role == "TEACHER" and profile.teacher_id:
        return teacher_can_access_group(profile.teacher, group_id)
    if profile.role == "PARENT" and profile.parent_id:
        return Enrollment.objects.filter(
            group_id=group_id,
            student_id__in=parent_student_ids_qs(profile.parent_id),
        ).exists()
    return False


def user_can_access_academic_year(request, academic_year_id) -> bool:
    profile = get_user_profile(request.user)
    if not profile:
        return False
    if profile.role == "ADMIN":
        return True
    try:
        year = AcademicYear.objects.get(pk=academic_year_id)
    except AcademicYear.DoesNotExist:
        return False
    if profile.role == "COORDINATOR":
        return profile.institution_id == year.institution_id
    if profile.role == "TEACHER" and profile.teacher_id:
        return teacher_assignments_qs(profile.teacher).filter(
            academic_year_id=academic_year_id
        ).exists()
    if profile.role == "PARENT" and profile.parent_id:
        return Enrollment.objects.filter(
            academic_year_id=academic_year_id,
            student_id__in=parent_student_ids_qs(profile.parent_id),
        ).exists()
    return False


def institution_scope_for_recalc(request, institution_id: UUID) -> bool:
    profile = get_user_profile(request.user)
    if not profile:
        return False
    if profile.role == "ADMIN":
        return True
    if profile.role == "COORDINATOR":
        return profile.institution_id == institution_id
    return False
