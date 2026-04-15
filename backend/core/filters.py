import django_filters

from .models import CourseAssignment


class CourseAssignmentFilter(django_filters.FilterSet):
    """List filters for course assignments; ``*_in`` accept comma-separated UUIDs."""

    group__in = django_filters.BaseInFilter(field_name="group", lookup_expr="in")
    teacher__in = django_filters.BaseInFilter(field_name="teacher", lookup_expr="in")

    class Meta:
        model = CourseAssignment
        fields = [
            "subject",
            "subject__name",
            "teacher",
            "teacher__document_number",
            "teacher__in",
            "group",
            "group__name",
            "academic_year",
            "academic_year__year",
        ]
