import django_filters

from .models import CourseAssignment


class CourseAssignmentFilter(django_filters.FilterSet):
    """List filters for course assignments; ``group__in`` accepts comma-separated UUIDs."""

    group__in = django_filters.BaseInFilter(field_name="group", lookup_expr="in")

    class Meta:
        model = CourseAssignment
        fields = [
            "subject",
            "subject__name",
            "teacher",
            "teacher__document_number",
            "group",
            "group__name",
            "academic_year",
            "academic_year__year",
        ]
