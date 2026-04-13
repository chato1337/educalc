"""Dashboard aggregate endpoints."""
from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AcademicPeriod
from .dashboard_kpis import (
    compute_grades_pending_for_period,
    compute_kpis_global,
    compute_kpis_institution,
    compute_kpis_parent,
    compute_kpis_teacher,
    empty_dashboard_kpis,
)

_GRADES_PERIOD_INVALID = object()


def _parse_uuid_param(raw: str | None, *, name: str) -> UUID | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return UUID(str(raw).strip())
    except (ValueError, TypeError, AttributeError):
        raise serializers.ValidationError({name: ["Must be a valid UUID."]})


DashboardKpisResponseSerializer = inline_serializer(
    name="DashboardKpisResponse",
    fields={
        "scope": serializers.ChoiceField(
            choices=["global", "institution", "teacher", "parent", "none"],
            help_text="How counts were scoped for the current user.",
        ),
        "institution_id": serializers.CharField(
            allow_null=True,
            required=False,
            help_text="Institution UUID when scope is institution; null otherwise.",
        ),
        "counts": inline_serializer(
            name="DashboardKpisCounts",
            fields={
                "institutions": serializers.IntegerField(),
                "campuses": serializers.IntegerField(),
                "academic_years": serializers.IntegerField(),
                "academic_years_active": serializers.IntegerField(),
                "grade_levels": serializers.IntegerField(),
                "academic_areas": serializers.IntegerField(),
                "subjects": serializers.IntegerField(),
                "grading_scales": serializers.IntegerField(),
                "groups": serializers.IntegerField(),
                "academic_periods": serializers.IntegerField(),
                "students": serializers.IntegerField(),
                "teachers": serializers.IntegerField(),
                "parents": serializers.IntegerField(),
                "enrollments": serializers.IntegerField(),
                "enrollments_active": serializers.IntegerField(),
                "course_assignments": serializers.IntegerField(),
                "grade_directors": serializers.IntegerField(),
                "grades": serializers.IntegerField(),
                "attendances": serializers.IntegerField(),
                "academic_indicators": serializers.IntegerField(),
                "performance_summaries": serializers.IntegerField(),
                "disciplinary_reports": serializers.IntegerField(),
                "school_records": serializers.IntegerField(),
                "academic_indicators_reports": serializers.IntegerField(),
                "student_guardians": serializers.IntegerField(),
            },
        ),
        "grades_period": serializers.JSONField(
            allow_null=True,
            required=False,
            help_text=(
                "When ``academic_period`` query is set: object with expected_slots, "
                "filled_slots, pending_slots, pending_students (distinct), period ids/names; "
                "otherwise null."
            ),
        ),
    },
)


class DashboardKPIsView(APIView):
    """
    Return dashboard KPI counts.

    - ADMIN without ``institution``: global totals.
    - ADMIN with ``institution``: totals for that institution.
    - COORDINATOR: always scoped to ``UserProfile.institution``.
    - TEACHER: scoped to assigned courses/groups.
    - PARENT: scoped to linked students.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Dashboard KPIs",
        description=(
            "Aggregated record counts aligned with core models. "
            "Optional query ``institution`` (UUID) filters for ADMIN only; "
            "COORDINATOR scope is always the user's institution."
        ),
        tags=["Dashboard"],
        parameters=[
            OpenApiParameter(
                name="institution",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Institution UUID (ADMIN only). Omit for global totals.",
            ),
            OpenApiParameter(
                name="academic_period",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description=(
                    "Academic period UUID. When set, ``grades_period`` includes pending grade "
                    "slots/students for active enrollments in that year (scoped by role)."
                ),
            ),
        ],
        responses={200: DashboardKpisResponseSerializer},
    )
    def get(self, request):
        try:
            inst_param = _parse_uuid_param(
                request.query_params.get("institution"), name="institution"
            )
            period_param = _parse_uuid_param(
                request.query_params.get("academic_period"), name="academic_period"
            )
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        profile = getattr(request.user, "profile", None)
        if not profile:
            return Response(
                {
                    "scope": "none",
                    "institution_id": None,
                    "counts": empty_dashboard_kpis(),
                    "grades_period": None,
                },
                status=status.HTTP_200_OK,
            )

        role = profile.role
        institution_id_out = None

        if role == "ADMIN":
            if inst_param:
                counts = compute_kpis_institution(inst_param)
                scope = "institution"
                institution_id_out = str(inst_param)
            else:
                counts = compute_kpis_global()
                scope = "global"
        elif role == "COORDINATOR":
            if not profile.institution_id:
                counts = empty_dashboard_kpis()
                scope = "none"
            else:
                iid = profile.institution_id
                counts = compute_kpis_institution(iid)
                scope = "institution"
                institution_id_out = str(iid)
        elif role == "TEACHER":
            if not profile.teacher_id:
                counts = empty_dashboard_kpis()
                scope = "none"
            else:
                counts = compute_kpis_teacher(profile.teacher_id)
                scope = "teacher"
        elif role == "PARENT":
            if not profile.parent_id:
                counts = empty_dashboard_kpis()
                scope = "none"
            else:
                counts = compute_kpis_parent(profile.parent_id)
                scope = "parent"
        else:
            counts = empty_dashboard_kpis()
            scope = "none"

        grades_period = _resolve_grades_period_kpi(
            period_param, role=role, profile=profile, inst_param=inst_param
        )
        if grades_period is _GRADES_PERIOD_INVALID:
            return Response(
                {
                    "detail": "Invalid or inaccessible academic_period for your role or institution filter."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "scope": scope,
                "institution_id": institution_id_out,
                "counts": counts,
                "grades_period": grades_period,
            },
            status=status.HTTP_200_OK,
        )


def _resolve_grades_period_kpi(period_param, *, role, profile, inst_param):
    """Return a dict, None (omit metric), or _GRADES_PERIOD_INVALID."""
    if not period_param:
        return None
    if role == "TEACHER" and not profile.teacher_id:
        return None
    if role == "PARENT" and not profile.parent_id:
        return None
    if role == "COORDINATOR" and not profile.institution_id:
        return None

    try:
        period = AcademicPeriod.objects.select_related("academic_year").get(pk=period_param)
    except AcademicPeriod.DoesNotExist:
        return _GRADES_PERIOD_INVALID

    year_inst = period.academic_year.institution_id
    if role == "COORDINATOR" and profile.institution_id != year_inst:
        return _GRADES_PERIOD_INVALID
    if role == "ADMIN" and inst_param and inst_param != year_inst:
        return _GRADES_PERIOD_INVALID

    inst_scope = None
    if role == "ADMIN" and inst_param:
        inst_scope = inst_param
    elif role == "COORDINATOR":
        inst_scope = profile.institution_id

    return compute_grades_pending_for_period(
        period_param,
        institution_scope_id=inst_scope,
        teacher_id=profile.teacher_id if role == "TEACHER" else None,
        parent_id=profile.parent_id if role == "PARENT" else None,
    )
