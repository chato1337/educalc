"""ViewSet mixins for core API RBAC scope filtering."""
from django.db.models import Q

from .models import (
    AcademicIndicatorCatalog,
    AcademicPeriod,
    AcademicYear,
    Campus,
    CourseAssignment,
    Enrollment,
    GradeDirector,
    Group,
    Parent,
    Student,
    StudentGuardian,
    Teacher,
)
from .permissions import RoleScopeMixin
from .scope_utils import (
    parent_institution_ids,
    parent_student_ids_qs,
    teacher_assignments_qs,
    teacher_campus_ids,
    teacher_enrollment_scope_filter,
    teacher_group_ids,
    teacher_institution_ids,
    teacher_student_ids,
    teacher_subject_ids,
    teacher_year_ids,
)


class ScopedQuerysetMixin:
    """Apply role-based queryset filtering on every list/retrieve/update/delete."""

    def get_queryset(self):
        return self.filter_queryset_by_role(super().get_queryset(), self.request)


class InstitutionRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(pk=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(pk__in=teacher_institution_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(pk__in=parent_institution_ids(parent_id))


class InstitutionFkRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    """Models with direct ``institution_id`` FK."""

    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(institution_id__in=teacher_institution_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(institution_id__in=parent_institution_ids(parent_id))


class CampusRoleScopeMixin(InstitutionFkRoleScopeMixin):
    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(pk__in=teacher_campus_ids(teacher))


class AcademicYearRoleScopeMixin(InstitutionFkRoleScopeMixin):
    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(pk__in=teacher_year_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(
            enrollments__student_id__in=parent_student_ids_qs(parent_id)
        ).distinct()


class AcademicPeriodRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(academic_year__institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(academic_year_id__in=teacher_year_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(
            academic_year__enrollments__student_id__in=parent_student_ids_qs(parent_id)
        ).distinct()


class GroupRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(academic_year__institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(pk__in=teacher_group_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(
            enrollments__student_id__in=parent_student_ids_qs(parent_id)
        ).distinct()


class SubjectRoleScopeMixin(InstitutionFkRoleScopeMixin):
    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(pk__in=teacher_subject_ids(teacher))


class StudentRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            enrollments__academic_year__institution_id=institution_id
        ).distinct()

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(pk__in=teacher_student_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(pk__in=parent_student_ids_qs(parent_id))


class TeacherRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            Q(course_assignments__subject__institution_id=institution_id)
            | Q(grade_director_assignments__academic_year__institution_id=institution_id)
            | Q(profile__institution_id=institution_id)
        ).distinct()

    def filter_queryset_for_teacher(self, queryset, request):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.teacher_id:
            return queryset.none()
        return queryset.filter(pk=profile.teacher_id)

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(
            students__student_id__in=parent_student_ids_qs(parent_id)
        ).distinct()


class ParentRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            students__student__enrollments__academic_year__institution_id=institution_id
        ).distinct()

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(
            students__student_id__in=teacher_student_ids(teacher)
        ).distinct()

    def filter_queryset_for_parent(self, queryset, request):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.parent_id:
            return queryset.none()
        return queryset.filter(pk=profile.parent_id)


class CourseAssignmentRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(subject__institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(teacher=teacher)

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(
            group__enrollments__student_id__in=parent_student_ids_qs(parent_id)
        ).distinct()


class EnrollmentRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(academic_year__institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(teacher_enrollment_scope_filter(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(student_id__in=parent_student_ids_qs(parent_id))


class GradeDirectorRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(academic_year__institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(
            Q(teacher=teacher)
            | Q(group_id__in=teacher_group_ids(teacher), academic_year_id__in=teacher_year_ids(teacher))
        ).distinct()

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(
            group__enrollments__student_id__in=parent_student_ids_qs(parent_id)
        ).distinct()


class CourseAssignmentFkRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    """Grade, Attendance, AcademicIndicator — scoped via course_assignment.teacher."""

    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            course_assignment__subject__institution_id=institution_id
        )

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(course_assignment__teacher=teacher)

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(student_id__in=parent_student_ids_qs(parent_id))


class StudentFkRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    """PerformanceSummary, DisciplinaryReport, SchoolRecord, etc."""

    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            student__enrollments__academic_year__institution_id=institution_id
        ).distinct()

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(student_id__in=teacher_student_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        return queryset.filter(student_id__in=parent_student_ids_qs(parent_id))


class PerformanceSummaryRoleScopeMixin(StudentFkRoleScopeMixin):
    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(
            student_id__in=teacher_student_ids(teacher),
            group_id__in=teacher_group_ids(teacher),
        )


class StudentGuardianRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            student__enrollments__academic_year__institution_id=institution_id
        ).distinct()

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        return queryset.filter(student_id__in=teacher_student_ids(teacher))

    def filter_queryset_for_parent(self, queryset, request):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.parent_id:
            return queryset.none()
        return queryset.filter(parent_id=profile.parent_id)


class AcademicIndicatorCatalogRoleScopeMixin(RoleScopeMixin, ScopedQuerysetMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(academic_area__institution_id=institution_id)

    def filter_queryset_for_teacher(self, queryset, request):
        teacher = getattr(getattr(request.user, "profile", None), "teacher", None)
        if not teacher:
            return queryset.none()
        group_ids = teacher_group_ids(teacher)
        grade_level_ids = Group.objects.filter(id__in=group_ids).values_list(
            "grade_level_id", flat=True
        ).distinct()
        area_ids = teacher_assignments_qs(teacher).values_list(
            "subject__academic_area_id", flat=True
        ).distinct()
        return queryset.filter(
            academic_area_id__in=area_ids,
            grade_level_id__in=grade_level_ids,
        )

    def filter_queryset_for_parent(self, queryset, request):
        parent_id = getattr(getattr(request.user, "profile", None), "parent_id", None)
        if not parent_id:
            return queryset.none()
        grade_level_ids = Enrollment.objects.filter(
            student_id__in=parent_student_ids_qs(parent_id)
        ).values_list("group__grade_level_id", flat=True).distinct()
        return queryset.filter(grade_level_id__in=grade_level_ids).distinct()


class SchoolRecordRoleScopeMixin(StudentFkRoleScopeMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(institution_id=institution_id)


class AcademicIndicatorsReportRoleScopeMixin(StudentFkRoleScopeMixin):
    def _filter_by_institution(self, queryset, institution_id):
        return queryset.filter(
            group__academic_year__institution_id=institution_id
        ).distinct()
