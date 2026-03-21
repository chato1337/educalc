"""
RBAC permission classes.

Roles: ADMIN, COORDINATOR, TEACHER, PARENT
Scope: ADMIN (all), COORDINATOR (institution), TEACHER (assigned groups), PARENT (own children)
"""
from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Allow only users with ADMIN role."""

    message = "Admin role required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, "profile", None) and request.user.profile.role == "ADMIN"


class IsCoordinator(permissions.BasePermission):
    """Allow users with COORDINATOR or ADMIN role."""

    message = "Coordinator or Admin role required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, "profile", None)
        if not profile:
            return False
        return profile.role in ("ADMIN", "COORDINATOR")


class IsTeacher(permissions.BasePermission):
    """Allow users with TEACHER, COORDINATOR or ADMIN role."""

    message = "Teacher, Coordinator or Admin role required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, "profile", None)
        if not profile:
            return False
        return profile.role in ("ADMIN", "COORDINATOR", "TEACHER")


class IsParent(permissions.BasePermission):
    """Allow users with PARENT, or ADMIN role (for admin access to parent data)."""

    message = "Parent or Admin role required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, "profile", None)
        if not profile:
            return False
        return profile.role in ("ADMIN", "PARENT")


class IsAdminOrCoordinator(permissions.BasePermission):
    """Allow ADMIN or COORDINATOR. Alias for IsCoordinator."""

    def has_permission(self, request, view):
        return IsCoordinator().has_permission(request, view)


class RoleScopeMixin:
    """
    Mixin for ViewSets to filter queryset by user role scope.

    - ADMIN: no filter (all data)
    - COORDINATOR: filter by institution_id from profile
    - TEACHER: filter by course_assignments (override filter_queryset_for_teacher)
    - PARENT: filter by students via StudentGuardian (override filter_queryset_for_parent)

    Subclass and override filter_queryset_by_role() or the role-specific methods.
    """

    def filter_queryset_by_role(self, queryset, request):
        """Filter queryset based on user role. Override in subclasses for model-specific logic."""
        if not request.user or not request.user.is_authenticated:
            return queryset.none()
        profile = getattr(request.user, "profile", None)
        if not profile:
            return queryset.none()
        if profile.role == "ADMIN":
            return queryset
        if profile.role == "COORDINATOR" and profile.institution_id:
            return self._filter_by_institution(queryset, profile.institution_id)
        if profile.role == "TEACHER":
            return self.filter_queryset_for_teacher(queryset, request)
        if profile.role == "PARENT":
            return self.filter_queryset_for_parent(queryset, request)
        return queryset.none()

    def _filter_by_institution(self, queryset, institution_id):
        """Filter by institution. Override if model uses different FK name."""
        if hasattr(queryset.model, "institution_id"):
            return queryset.filter(institution_id=institution_id)
        return queryset

    def filter_queryset_for_teacher(self, queryset, request):
        """Override in ViewSets for teacher scope (e.g. filter by CourseAssignment)."""
        return queryset.none()

    def filter_queryset_for_parent(self, queryset, request):
        """Override in ViewSets for parent scope (e.g. filter by StudentGuardian)."""
        return queryset.none()
