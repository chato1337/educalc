"""ViewSet for the roll call (llamado a lista) module."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .daily_attendance_serializers import (
    DailyAttendanceSerializer,
    RollCallErrorSerializer,
    RollCallRosterQuerySerializer,
    RollCallRosterSerializer,
    RollCallSaveResponseSerializer,
    RollCallSaveSerializer,
)
from .daily_attendance_service import (
    RollCallError,
    consolidate_statuses,
    group_roster,
    resolve_academic_period,
    save_roll_call,
)
from .models import CourseAssignment, DailyAttendance, Group
from .permissions import IsTeacher
from .scope_mixins import DailyAttendanceRoleScopeMixin
from .scope_utils import get_user_profile, user_can_access_group
from .views import schema_viewset

ROLL_CALL_RULES = (
    "El llamado a lista es acumulable: la misma fecha puede llamarse varias veces, "
    "de forma general para el grupo (``course_assignment`` nulo) o por asignatura. "
    "Cada origen guarda su propia fila, pero la fecha solo cuenta una vez: el estado "
    "único del día se resuelve con la precedencia **falta con excusa > falta sin excusa "
    "> presente** y los días consolidados se acumulan en la fila ``Attendance`` de nivel "
    "grupo (``course_assignment`` nulo) del periodo."
)


def _error_response(exc: RollCallError):
    return Response(
        {"detail": exc.message, "code": exc.code},
        status=status.HTTP_400_BAD_REQUEST,
    )


@schema_viewset(
    ["Roll Call"],
    f"Llamado a lista diario. {ROLL_CALL_RULES}",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "group__name",
        "course_assignment__subject__name",
    ],
    filter_fields=[
        "student",
        "group",
        "academic_period",
        "date",
        "status",
        "course_assignment",
    ],
    readonly=True,
)
class DailyAttendanceViewSet(DailyAttendanceRoleScopeMixin, viewsets.ReadOnlyModelViewSet):
    """
    Historial de llamados a lista en solo lectura.

    La escritura pasa siempre por ``save-roll-call/`` para que el acumulado del
    periodo se recalcule en la misma transacción.
    """

    queryset = DailyAttendance.objects.select_related(
        "student",
        "group",
        "academic_period",
        "course_assignment",
        "course_assignment__subject",
        "recorded_by",
    ).all()
    serializer_class = DailyAttendanceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "group",
        "academic_period",
        "date",
        "status",
        "course_assignment",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "group__name",
        "course_assignment__subject__name",
    ]

    def _get_scoped_group(self, request, group_id):
        group = (
            Group.objects.filter(pk=group_id)
            .select_related("academic_year", "campus", "grade_level")
            .first()
        )
        if not group or not user_can_access_group(request, group.id):
            return None
        return group

    @extend_schema(
        summary="Listado de estudiantes para el llamado a lista",
        description=(
            "Estudiantes con matrícula activa en el grupo, junto con lo ya registrado "
            "para la fecha: ``status`` es lo guardado por este mismo origen y "
            "``consolidated_status`` es el estado único del día tras cruzar todos los "
            f"llamados. {ROLL_CALL_RULES}"
        ),
        tags=["Roll Call"],
        parameters=[
            OpenApiParameter(
                name="group",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=True,
                description="UUID del grupo al que se va a llamar a lista.",
            ),
            OpenApiParameter(
                name="date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description="Fecha del llamado (``YYYY-MM-DD``).",
            ),
            OpenApiParameter(
                name="course_assignment",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description=(
                    "Asignación docente-curso cuando el llamado es por asignatura. "
                    "Omitir para el llamado general del grupo."
                ),
            ),
        ],
        responses={
            200: RollCallRosterSerializer,
            400: RollCallErrorSerializer,
            404: OpenApiResponse(description="Grupo inexistente o fuera del alcance del rol."),
        },
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="roster",
        permission_classes=[IsAuthenticated, IsTeacher],
    )
    def roster(self, request):
        query = RollCallRosterQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        group_id = query.validated_data["group"]
        day = query.validated_data["date"]
        course_assignment_id = query.validated_data.get("course_assignment")

        group = self._get_scoped_group(request, group_id)
        if not group:
            return Response(status=status.HTTP_404_NOT_FOUND)

        course_assignment = None
        if course_assignment_id:
            course_assignment = CourseAssignment.objects.filter(
                pk=course_assignment_id, group_id=group.id
            ).first()
            if not course_assignment:
                return _error_response(
                    RollCallError(
                        "assignment_not_in_group",
                        "La asignación docente-curso no pertenece al grupo seleccionado.",
                    )
                )

        academic_period = resolve_academic_period(group, day)
        students = list(group_roster(group))

        own_rows = {
            row.student_id: row
            for row in DailyAttendance.objects.filter(
                group=group, date=day, course_assignment=course_assignment
            )
        }
        day_rows = DailyAttendance.objects.filter(group=group, date=day).values_list(
            "student_id", "status"
        )
        source_counts: dict = {}
        statuses_by_student: dict = {}
        for student_id, row_status in day_rows:
            source_counts[student_id] = source_counts.get(student_id, 0) + 1
            statuses_by_student.setdefault(student_id, []).append(row_status)

        payload = {
            "group": group.id,
            "group_name": group.name,
            "academic_year": group.academic_year_id,
            "date": day,
            "academic_period": academic_period.id if academic_period else None,
            "academic_period_name": academic_period.name if academic_period else None,
            "course_assignment": course_assignment.id if course_assignment else None,
            "students": [
                {
                    "student": student.id,
                    "full_name": student.full_name,
                    "document_number": student.document_number,
                    "status": own_rows[student.id].status if student.id in own_rows else None,
                    "notes": own_rows[student.id].notes if student.id in own_rows else "",
                    "consolidated_status": consolidate_statuses(
                        statuses_by_student.get(student.id, [])
                    ),
                    "other_sources": max(
                        source_counts.get(student.id, 0)
                        - (1 if student.id in own_rows else 0),
                        0,
                    ),
                }
                for student in students
            ],
        }
        return Response(RollCallRosterSerializer(payload).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Guardar el llamado a lista de un grupo",
        description=(
            "Guarda en una sola petición las marcas de todos los estudiantes del grupo "
            "para una fecha y recalcula el acumulado del periodo en la misma transacción.\n\n"
            f"{ROLL_CALL_RULES}\n\n"
            "**Reglas:** los estudiantes deben tener matrícula activa en el grupo; la "
            "asignatura debe pertenecer al grupo; volver a guardar el mismo origen "
            "sobrescribe las marcas anteriores en lugar de duplicarlas."
        ),
        tags=["Roll Call"],
        request=RollCallSaveSerializer,
        responses={
            200: RollCallSaveResponseSerializer,
            400: RollCallErrorSerializer,
            404: OpenApiResponse(description="Grupo inexistente o fuera del alcance del rol."),
        },
        examples=[
            OpenApiExample(
                "Llamado general del grupo",
                value={
                    "group": "00000000-0000-4000-8000-000000000010",
                    "date": "2026-07-29",
                    "entries": [
                        {"student": "00000000-0000-4000-8000-000000000001", "status": "PRESENT"},
                        {
                            "student": "00000000-0000-4000-8000-000000000002",
                            "status": "EXCUSED",
                            "notes": "Cita médica",
                        },
                        {"student": "00000000-0000-4000-8000-000000000003", "status": "UNEXCUSED"},
                    ],
                },
                request_only=True,
            ),
            OpenApiExample(
                "Llamado por asignatura",
                value={
                    "group": "00000000-0000-4000-8000-000000000010",
                    "date": "2026-07-29",
                    "course_assignment": "00000000-0000-4000-8000-000000000020",
                    "entries": [
                        {"student": "00000000-0000-4000-8000-000000000001", "status": "UNEXCUSED"}
                    ],
                },
                request_only=True,
            ),
        ],
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="save-roll-call",
        permission_classes=[IsAuthenticated, IsTeacher],
    )
    def save_roll_call_action(self, request):
        serializer = RollCallSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        group = self._get_scoped_group(request, data["group"])
        if not group:
            return Response(status=status.HTTP_404_NOT_FOUND)

        profile = get_user_profile(request.user)
        recorded_by = getattr(profile, "teacher", None) if profile else None

        try:
            result = save_roll_call(
                group_id=group.id,
                day=data["date"],
                entries=data["entries"],
                course_assignment_id=data.get("course_assignment"),
                academic_period_id=data.get("academic_period"),
                recorded_by=recorded_by,
            )
        except RollCallError as exc:
            return _error_response(exc)

        payload = {
            "group": result.group.id,
            "group_name": result.group.name,
            "date": result.date,
            "academic_period": result.academic_period.id,
            "academic_period_name": result.academic_period.name,
            "course_assignment": (
                result.course_assignment.id if result.course_assignment else None
            ),
            "created": result.created,
            "updated": result.updated,
            "students_processed": result.students_processed,
            "present_count": result.present_count,
            "excused_count": result.excused_count,
            "unexcused_count": result.unexcused_count,
            "attendance_rows_synced": result.attendance_rows_synced,
            "warnings": result.warnings,
        }
        return Response(
            RollCallSaveResponseSerializer(payload).data, status=status.HTTP_200_OK
        )
