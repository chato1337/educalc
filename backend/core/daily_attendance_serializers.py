"""Serializers for the roll call (llamado a lista) API."""
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from .models import DailyAttendance

STATUS_HELP = (
    "``PRESENT`` asistió, ``EXCUSED`` falta con excusa (CE), "
    "``UNEXCUSED`` falta sin excusa (SE)."
)


class DailyAttendanceSerializer(serializers.ModelSerializer):
    """Historial: una fila por estudiante, fecha y origen del llamado."""

    student_name = serializers.CharField(source="student.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    academic_period_name = serializers.CharField(
        source="academic_period.name", read_only=True
    )
    subject_name = serializers.CharField(
        source="course_assignment.subject.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    recorded_by_name = serializers.CharField(
        source="recorded_by.full_name", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = DailyAttendance
        fields = [
            "id",
            "student",
            "student_name",
            "group",
            "group_name",
            "academic_period",
            "academic_period_name",
            "date",
            "status",
            "course_assignment",
            "subject_name",
            "recorded_by",
            "recorded_by_name",
            "notes",
            "created_at",
            "updated_at",
        ]


class RollCallRosterQuerySerializer(serializers.Serializer):
    """Query params de ``GET /api/daily-attendances/roster/``."""

    group = serializers.UUIDField()
    date = serializers.DateField()
    course_assignment = serializers.UUIDField(required=False, allow_null=True)


@extend_schema_serializer(component_name="RollCallRosterStudent")
class RollCallRosterStudentSerializer(serializers.Serializer):
    """Estudiante matriculado con lo ya registrado para la fecha."""

    student = serializers.UUIDField(help_text="UUID del estudiante.")
    full_name = serializers.CharField()
    document_number = serializers.CharField(allow_blank=True)
    status = serializers.ChoiceField(
        choices=DailyAttendance.STATUS_CHOICES,
        allow_null=True,
        help_text=(
            "Estado ya guardado por este mismo origen (grupo+fecha+asignatura). "
            "``null`` si aún no se ha llamado a lista desde este origen. " + STATUS_HELP
        ),
    )
    notes = serializers.CharField(allow_blank=True)
    consolidated_status = serializers.ChoiceField(
        choices=DailyAttendance.STATUS_CHOICES,
        allow_null=True,
        help_text=(
            "Estado único del día tras consolidar todos los llamados "
            "(falta con excusa > falta sin excusa > presente)."
        ),
    )
    other_sources = serializers.IntegerField(
        help_text="Cantidad de llamados de otros orígenes que ya registraron ese día.",
    )


@extend_schema_serializer(component_name="RollCallRoster")
class RollCallRosterSerializer(serializers.Serializer):
    """Listado de estudiantes para abrir el modal de llamado a lista."""

    group = serializers.UUIDField()
    group_name = serializers.CharField()
    academic_year = serializers.UUIDField()
    date = serializers.DateField()
    academic_period = serializers.UUIDField(
        allow_null=True,
        help_text=(
            "Periodo resuelto por fecha. ``null`` cuando ningún periodo del año "
            "cubre el día; en ese caso hay que enviar ``academic_period`` al guardar."
        ),
    )
    academic_period_name = serializers.CharField(allow_null=True)
    course_assignment = serializers.UUIDField(
        allow_null=True,
        help_text="Origen del llamado: ``null`` es el llamado general del grupo.",
    )
    students = RollCallRosterStudentSerializer(many=True)


@extend_schema_serializer(component_name="RollCallEntry")
class RollCallEntrySerializer(serializers.Serializer):
    """Marca de un estudiante dentro del llamado a lista."""

    student = serializers.UUIDField(help_text="UUID del estudiante.")
    status = serializers.ChoiceField(
        choices=DailyAttendance.STATUS_CHOICES, help_text=STATUS_HELP
    )
    notes = serializers.CharField(
        required=False, allow_blank=True, help_text="Observación o motivo de la excusa."
    )


@extend_schema_serializer(component_name="RollCallSave")
class RollCallSaveSerializer(serializers.Serializer):
    """Cuerpo para ``POST /api/daily-attendances/save-roll-call/``."""

    group = serializers.UUIDField(help_text="UUID del grupo al que se llama a lista.")
    date = serializers.DateField(help_text="Fecha del llamado (``YYYY-MM-DD``).")
    course_assignment = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text=(
            "Asignación docente-curso cuando el llamado es por asignatura. "
            "Omitir para el llamado general del grupo."
        ),
    )
    academic_period = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text=(
            "Solo necesario cuando la fecha no cae dentro de ningún periodo "
            "con fechas configuradas."
        ),
    )
    entries = RollCallEntrySerializer(
        many=True,
        allow_empty=False,
        help_text="Marcas de todos los estudiantes; se guardan en una sola petición.",
    )


@extend_schema_serializer(component_name="RollCallSaveResponse")
class RollCallSaveResponseSerializer(serializers.Serializer):
    """Resultado del guardado y del recálculo de acumulados."""

    group = serializers.UUIDField()
    group_name = serializers.CharField()
    date = serializers.DateField()
    academic_period = serializers.UUIDField()
    academic_period_name = serializers.CharField()
    course_assignment = serializers.UUIDField(allow_null=True)
    created = serializers.IntegerField(help_text="Marcas nuevas de este origen.")
    updated = serializers.IntegerField(help_text="Marcas de este origen que se sobrescribieron.")
    students_processed = serializers.IntegerField()
    present_count = serializers.IntegerField()
    excused_count = serializers.IntegerField()
    unexcused_count = serializers.IntegerField()
    attendance_rows_synced = serializers.IntegerField(
        help_text=(
            "Filas ``Attendance`` de nivel grupo (``course_assignment`` nulo) "
            "reescritas con el acumulado consolidado del periodo."
        ),
    )
    warnings = serializers.ListField(child=serializers.CharField())


@extend_schema_serializer(component_name="RollCallError")
class RollCallErrorSerializer(serializers.Serializer):
    """Respuesta de error de regla de negocio del llamado a lista."""

    detail = serializers.CharField(help_text="Mensaje legible del error.")
    code = serializers.ChoiceField(
        choices=[
            "group_not_found",
            "empty_roll_call",
            "duplicated_student",
            "period_not_found",
            "period_not_in_year",
            "assignment_not_found",
            "assignment_not_in_group",
            "student_not_enrolled",
        ],
        help_text=(
            "``period_not_found`` (la fecha no cae en ningún periodo con fechas "
            "configuradas), ``assignment_not_in_group`` (la asignatura no es del grupo), "
            "``student_not_enrolled`` (sin matrícula activa en el grupo)."
        ),
    )
