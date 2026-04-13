"""API ViewSets with OpenAPI documentation. All use IsAuthenticated; RBAC scope filtering can be applied per-view."""
from django.utils import timezone
from typing import List, Optional
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    OpenApiParameter,
    OpenApiResponse,
)
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .bulk_load import bulk_load_students
from .bulk_load_extended import (
    bulk_load_academic_areas,
    bulk_load_academic_indicators,
    bulk_load_academic_periods,
    bulk_load_attendance,
    bulk_load_course_assignments,
    bulk_load_disciplinary_reports,
    bulk_load_grade_directors,
    bulk_load_grades,
    bulk_load_grading_scales,
    bulk_load_parents,
    bulk_load_performance_summaries,
    bulk_load_student_guardians,
    bulk_load_subjects,
    bulk_load_teachers,
    bulk_load_teacher_users,
)
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
    UserProfile,
)
from .pagination import StandardLimitOffsetPagination
from .permissions import IsAdminUser
from .serializers import (
    BulkLoadFileSerializer,
    BulkLoadStudentsSerializer,
    AcademicAreaSerializer,
    AcademicIndicatorSerializer,
    AcademicIndicatorsReportSerializer,
    AcademicPeriodSerializer,
    AcademicYearSerializer,
    AttendanceSerializer,
    CampusSerializer,
    CourseAssignmentSerializer,
    DisciplinaryReportSerializer,
    EnrollmentSerializer,
    GradeDirectorSerializer,
    GradeSerializer,
    GradingScaleSerializer,
    GradeLevelSerializer,
    GroupSerializer,
    InstitutionSerializer,
    ParentSerializer,
    PerformanceSummarySerializer,
    SchoolRecordSerializer,
    AcademicIndicatorsReportSerializer as ReportSerializer,
    StudentGuardianSerializer,
    StudentSerializer,
    SubjectSerializer,
    TeacherSerializer,
    UserProfileSerializer,
)


def _bulk_csv_response(request, loader_fn):
    """Run a bulk CSV loader; multipart field ``file``."""
    serializer = BulkLoadFileSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    csv_file = serializer.validated_data["file"]
    if not csv_file.name.lower().endswith(".csv"):
        return Response(
            {"error": "File must be a CSV (.csv)"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        stats = loader_fn(csv_file)
        return Response(stats, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )


def bulk_csv_load_schema(*, summary: str, description: str, tags: list, request_serializer):
    """
    OpenAPI for POST ``bulk-load`` actions (multipart CSV).

    ``methods=['POST']`` is required so drf-spectacular registers the operation on custom actions.
    """
    return extend_schema(
        summary=summary,
        description=description,
        tags=tags,
        methods=["POST"],
        request={"multipart/form-data": request_serializer},
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                description="Loader statistics: created/updated counts, rows_processed, rows_skipped, errors[].",
            ),
            400: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                description='Validation failure or {"error": "..."}.',
            ),
        },
    )


def _openapi_limit_offset_parameters():
    """Query parameters for ``StandardLimitOffsetPagination`` (global list pagination)."""
    default_lim = StandardLimitOffsetPagination.default_limit
    max_lim = StandardLimitOffsetPagination.max_limit
    return [
        OpenApiParameter(
            name="limit",
            type=int,
            location=OpenApiParameter.QUERY,
            required=False,
            description=(
                "Maximum number of items in the `results` array for this page. "
                f"If omitted, defaults to {default_lim}. Cannot exceed {max_lim}."
            ),
        ),
        OpenApiParameter(
            name="offset",
            type=int,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Number of items to skip from the beginning of the filtered, ordered queryset.",
        ),
    ]


OPENAPI_LIST_PAGINATION_DESCRIPTION = (
    "Paginated list: response JSON has `count`, `next`, `previous`, and `results` "
    "(array of resources). Use `limit` and `offset` to page through `results`."
)


def schema_viewset(
    tags: list,
    description: str = "",
    search_fields: Optional[List[str]] = None,
    filter_fields: Optional[List[str]] = None,
):
    """Decorator for ViewSet OpenAPI schema."""
    list_description = description
    list_parameters = list(_openapi_limit_offset_parameters())

    if search_fields:
        search_description = (
            "Text search available through query param `search`. "
            f"Supported fields: {', '.join(search_fields)}."
        )
        list_description = (
            f"{description} {search_description}".strip() if description else search_description
        )
        list_parameters.append(
            OpenApiParameter(
                name="search",
                type=str,
                location="query",
                required=False,
                description=f"Search text across: {', '.join(search_fields)}.",
            )
        )

    if filter_fields:
        filters_description = (
            "Available exact-match filters via query params: "
            f"{', '.join(filter_fields)}."
        )
        list_description = (
            f"{list_description} {filters_description}".strip()
            if list_description
            else filters_description
        )
        for field in filter_fields:
            list_parameters.append(
                OpenApiParameter(
                    name=field,
                    type=str,
                    location="query",
                    required=False,
                    description=f"Filter by exact value of `{field}`.",
                )
            )

    list_description = (
        f"{list_description} {OPENAPI_LIST_PAGINATION_DESCRIPTION}".strip()
        if list_description
        else OPENAPI_LIST_PAGINATION_DESCRIPTION
    )

    return extend_schema_view(
        list=extend_schema(
            summary=f"List {tags[0]}",
            tags=tags,
            description=list_description,
            parameters=list_parameters,
        ),
        retrieve=extend_schema(summary=f"Get {tags[0]}", tags=tags),
        create=extend_schema(summary=f"Create {tags[0]}", tags=tags),
        update=extend_schema(summary=f"Update {tags[0]}", tags=tags),
        partial_update=extend_schema(summary=f"Partial update {tags[0]}", tags=tags),
        destroy=extend_schema(summary=f"Delete {tags[0]}", tags=tags),
    )


@schema_viewset(
    ["Institutions"],
    "Educational institutions at corporate level",
    search_fields=["name", "dane_code", "nit"],
    filter_fields=["dane_code", "nit", "name"],
)
class InstitutionViewSet(viewsets.ModelViewSet):
    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["dane_code", "nit", "name"]


@schema_viewset(
    ["Campuses"],
    "Campus or sede of an institution",
    search_fields=["name", "code", "institution__name", "institution__dane_code"],
    filter_fields=["institution", "institution__dane_code", "name", "code"],
)
class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.select_related("institution").all()
    serializer_class = CampusSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution", "institution__dane_code", "name", "code"]
    search_fields = ["name", "code", "institution__name", "institution__dane_code"]


@schema_viewset(
    ["Academic Years"],
    "Academic/school year",
    search_fields=["=year", "institution__name"],
    filter_fields=["institution", "institution__dane_code", "year", "is_active"],
)
class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.select_related("institution").all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution", "institution__dane_code", "year", "is_active"]
    search_fields = ["=year", "institution__name"]


@schema_viewset(
    ["Grade Levels"],
    "Grade level (e.g. SEXTO, PRIMERO)",
    search_fields=["name"],
    filter_fields=["institution", "institution__dane_code", "name", "level_order"],
)
class GradeLevelViewSet(viewsets.ModelViewSet):
    queryset = GradeLevel.objects.select_related("institution").all()
    serializer_class = GradeLevelSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution", "institution__dane_code", "name", "level_order"]
    search_fields = ["name"]


@schema_viewset(
    ["Academic Areas"],
    "Broad category of knowledge",
    search_fields=["name", "code", "description"],
    filter_fields=["institution", "institution__dane_code", "name", "code"],
)
class AcademicAreaViewSet(viewsets.ModelViewSet):
    queryset = AcademicArea.objects.select_related("institution").all()
    serializer_class = AcademicAreaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution", "institution__dane_code", "name", "code"]
    search_fields = ["name", "code", "description"]

    @bulk_csv_load_schema(
        summary="Bulk load academic areas from CSV",
        description="Columns: DANE_COD, AREA_NOMBRE, AREA_COD, DESCRIPCION. "
        "See docs/plan-implementacion-carga-masiva-csv.md",
        tags=["Academic Areas"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_academic_areas)


@schema_viewset(
    ["Grading Scales"],
    "Performance levels per Decreto 1290",
    search_fields=["code", "name", "description"],
    filter_fields=["institution", "institution__dane_code", "code", "name"],
)
class GradingScaleViewSet(viewsets.ModelViewSet):
    queryset = GradingScale.objects.select_related("institution").all()
    serializer_class = GradingScaleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution", "institution__dane_code", "code", "name"]
    search_fields = ["code", "name", "description"]

    @bulk_csv_load_schema(
        summary="Bulk load grading scales from CSV",
        description="Columns: DANE_COD, COD_NIVEL, NOMBRE_NIVEL, NOTA_MIN, NOTA_MAX, DESCRIPCION.",
        tags=["Grading Scales"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_grading_scales)


@schema_viewset(
    ["Students"],
    "Student data",
    search_fields=[
        "document_number",
        "full_name",
        "first_name",
        "second_name",
        "first_last_name",
        "second_last_name",
    ],
    filter_fields=["document_type", "document_number", "gender", "sisben", "stratum"],
)
class StudentViewSet(viewsets.ModelViewSet):
    filterset_fields = ["document_type", "document_number", "gender", "sisben", "stratum"]
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = [
        "document_number",
        "full_name",
        "first_name",
        "second_name",
        "first_last_name",
        "second_last_name",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load students from CSV",
        description="Upload a CSV file to create/update students, enrollments, institutions, "
        "campuses, academic years, grade levels, and groups. CSV format: ANO, INSTITUCION, "
        "SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, "
        "APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO, BARRIO, EPS, "
        "TIPO DE SANGRE, DISCAPACIDAD, TELEFONO. Use multipart/form-data with field 'file'.",
        tags=["Students"],
        request_serializer=BulkLoadStudentsSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        serializer = BulkLoadStudentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        csv_file = serializer.validated_data["file"]
        if not csv_file.name.lower().endswith(".csv"):
            return Response(
                {"error": "File must be a CSV (.csv)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            stats = bulk_load_students(csv_file)
            return Response(stats, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @extend_schema(
        summary="Grades summary",
        description="Summary of grades for this student: grades by period, course, and averages.",
        tags=["Students"],
    )
    @action(detail=True, methods=["get"], url_path="grades-summary")
    def grades_summary(self, request, pk=None):
        student = self.get_object()
        grades = (
            Grade.objects.filter(student=student)
            .select_related("course_assignment__subject", "academic_period", "performance_level")
            .order_by("academic_period__number", "course_assignment__subject__name")
        )
        by_period = {}
        for g in grades:
            period_key = str(g.academic_period_id)
            if period_key not in by_period:
                by_period[period_key] = {
                    "period": {
                        "id": str(g.academic_period.id),
                        "name": g.academic_period.name,
                        "year": g.academic_period.academic_year.year,
                    },
                    "grades": [],
                    "average": None,
                }
            by_period[period_key]["grades"].append(
                {
                    "subject": g.course_assignment.subject.name,
                    "numerical_grade": float(g.numerical_grade),
                    "performance_level": g.performance_level.name if g.performance_level else None,
                }
            )
        for period_key, data in by_period.items():
            vals = [x["numerical_grade"] for x in data["grades"]]
            data["average"] = round(sum(vals) / len(vals), 2) if vals else None
        return Response(
            {
                "student": StudentSerializer(student).data,
                "grades_by_period": list(by_period.values()),
            }
        )


@schema_viewset(
    ["Teachers"],
    "Teacher/faculty information",
    search_fields=[
        "document_number",
        "full_name",
        "first_name",
        "second_name",
        "first_last_name",
        "second_last_name",
        "email",
    ],
    filter_fields=["document_type", "document_number", "email", "specialty"],
)
class TeacherViewSet(viewsets.ModelViewSet):
    filterset_fields = ["document_type", "document_number", "email", "specialty"]
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    search_fields = [
        "document_number",
        "full_name",
        "first_name",
        "second_name",
        "first_last_name",
        "second_last_name",
        "email",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load teachers from CSV",
        description="Columns: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, ESPECIALIDAD.",
        tags=["Teachers"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_teachers)

    @bulk_csv_load_schema(
        summary="Bulk create users for teachers from CSV",
        description="Uses the same teachers CSV columns (DOC, NOMBRE1, APELLIDO1, EMAIL). "
        "Creates or updates login users for existing teachers. Username format: nombre.apellido "
        "(normalized to lowercase ASCII). Password format: document number (DOC).",
        tags=["Teachers"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-load-users",
        parser_classes=[MultiPartParser],
    )
    def bulk_load_users(self, request):
        return _bulk_csv_response(request, bulk_load_teacher_users)


@schema_viewset(
    ["Parents"],
    "Parent or guardian of a student",
    search_fields=[
        "document_number",
        "full_name",
        "first_name",
        "second_name",
        "first_last_name",
        "second_last_name",
        "email",
    ],
    filter_fields=["document_type", "document_number", "email", "kinship"],
)
class ParentViewSet(viewsets.ModelViewSet):
    filterset_fields = ["document_type", "document_number", "email", "kinship"]
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = [
        "document_number",
        "full_name",
        "first_name",
        "second_name",
        "first_last_name",
        "second_last_name",
        "email",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load parents/guardians from CSV",
        description="Columns: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, PARENTESCO. "
        "Empty EMAIL uses a synthetic address.",
        tags=["Parents"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_parents)


@schema_viewset(
    ["Groups"],
    "Student group within a grade",
    search_fields=["name", "grade_level__name", "campus__name", "=academic_year__year"],
    filter_fields=[
        "grade_level",
        "grade_level__name",
        "academic_year",
        "academic_year__year",
        "academic_year__institution",
        "campus",
        "campus__name",
        "name",
    ],
)
class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.select_related(
        "grade_level", "academic_year", "campus"
    ).all()
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]
    # Default ordering for list + stable pagination; OrderingFilter replaces this when ?ordering= is valid.
    ordering = [
        "academic_year__year",
        "campus_id",
        "grade_level__level_order",
        "name",
        "pk",
    ]
    ordering_fields = [
        "name",
        "pk",
        "grade_level",
        "grade_level__name",
        "academic_year",
        "academic_year__year",
        "campus",
        "campus__name",
    ]
    filterset_fields = [
        "grade_level",
        "grade_level__name",
        "academic_year",
        "academic_year__year",
        "academic_year__institution",
        "campus",
        "campus__name",
        "name",
    ]
    search_fields = ["name", "grade_level__name", "campus__name", "=academic_year__year"]

    @extend_schema(
        summary="Students rankings by period",
        description="Rankings of students in this group by academic period. "
        "Uses PerformanceSummary when available. Optional: filter by period_id.",
        tags=["Groups"],
        parameters=[
            OpenApiParameter(name="period_id", type=str, location="query", required=False),
        ],
    )
    @action(detail=True, methods=["get"], url_path="students-rankings")
    def students_rankings(self, request, pk=None):
        group = self.get_object()
        period_id = request.query_params.get("period_id")
        summaries = PerformanceSummary.objects.filter(group=group).select_related(
            "student", "academic_period"
        ).order_by("academic_period__number")
        if period_id:
            summaries = summaries.filter(academic_period_id=period_id)
        by_period = {}
        for s in summaries:
            period_key = str(s.academic_period_id)
            if period_key not in by_period:
                by_period[period_key] = {
                    "period": {
                        "id": str(s.academic_period.id),
                        "name": s.academic_period.name,
                        "year": s.academic_period.academic_year.year,
                    },
                    "rankings": [],
                }
            by_period[period_key]["rankings"].append(
                {
                    "student_id": str(s.student_id),
                    "student_name": s.student.full_name,
                    "rank": s.rank,
                    "period_average": float(s.period_average),
                }
            )
        for data in by_period.values():
            data["rankings"].sort(key=lambda x: (x["rank"] or 999, -x["period_average"]))
        return Response(
            {
                "group": GroupSerializer(group).data,
                "rankings_by_period": list(by_period.values()),
            }
        )


@schema_viewset(
    ["Subjects"],
    "Subject/course with optional emphasis",
    search_fields=["name", "emphasis", "academic_area__name", "institution__name"],
    filter_fields=[
        "academic_area",
        "academic_area__name",
        "institution",
        "institution__dane_code",
        "name",
        "emphasis",
    ],
)
class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.select_related("academic_area", "institution").all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "academic_area",
        "academic_area__name",
        "institution",
        "institution__dane_code",
        "name",
        "emphasis",
    ]
    search_fields = ["name", "emphasis", "academic_area__name", "institution__name"]

    @bulk_csv_load_schema(
        summary="Bulk load subjects from CSV",
        description="Columns: DANE_COD, AREA_NOMBRE, ASIGNATURA_NOMBRE, ENFASIS, HORAS.",
        tags=["Subjects"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_subjects)


@schema_viewset(
    ["Academic Periods"],
    "Evaluation period (P1, P2, P3, P4)",
    search_fields=["name", "=number", "=academic_year__year"],
    filter_fields=["academic_year", "academic_year__year", "number", "name"],
)
class AcademicPeriodViewSet(viewsets.ModelViewSet):
    queryset = AcademicPeriod.objects.select_related("academic_year").all()
    serializer_class = AcademicPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["academic_year", "academic_year__year", "number", "name"]
    search_fields = ["name", "=number", "=academic_year__year"]

    @bulk_csv_load_schema(
        summary="Bulk load academic periods from CSV",
        description="Columns: DANE_COD, ANO, PERIODO_NUM, PERIODO_NOMBRE, FECHA_INI, FECHA_FIN.",
        tags=["Academic Periods"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_academic_periods)


@schema_viewset(
    ["Course Assignments"],
    "Teacher assigned to a subject in a group for an academic year",
    search_fields=[
        "subject__name",
        "subject__emphasis",
        "teacher__full_name",
        "teacher__document_number",
        "group__name",
        "group__grade_level__name",
        "=academic_year__year",
    ],
    filter_fields=[
        "subject",
        "subject__name",
        "teacher",
        "teacher__document_number",
        "group",
        "group__name",
        "academic_year",
        "academic_year__year",
    ],
)
class CourseAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CourseAssignment.objects.select_related(
        "subject",
        "subject__academic_area",
        "teacher",
        "group",
        "group__campus",
        "academic_year",
    ).all()
    serializer_class = CourseAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "subject",
        "subject__name",
        "teacher",
        "teacher__document_number",
        "group",
        "group__name",
        "academic_year",
        "academic_year__year",
    ]
    search_fields = [
        "subject__name",
        "subject__emphasis",
        "teacher__full_name",
        "teacher__document_number",
        "group__name",
        "group__grade_level__name",
        "=academic_year__year",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load course assignments from CSV",
        description="Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (optional), DOC_DOCENTE.",
        tags=["Course Assignments"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_course_assignments)


@schema_viewset(
    ["Grade Directors"],
    "Homeroom teacher for a group",
    search_fields=[
        "teacher__full_name",
        "teacher__document_number",
        "group__name",
        "group__grade_level__name",
        "=academic_year__year",
    ],
    filter_fields=[
        "teacher",
        "teacher__document_number",
        "group",
        "group__name",
        "academic_year",
        "academic_year__year",
    ],
)
class GradeDirectorViewSet(viewsets.ModelViewSet):
    queryset = GradeDirector.objects.select_related(
        "teacher", "group", "academic_year"
    ).all()
    serializer_class = GradeDirectorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "teacher",
        "teacher__document_number",
        "group",
        "group__name",
        "academic_year",
        "academic_year__year",
    ]
    search_fields = [
        "teacher__full_name",
        "teacher__document_number",
        "group__name",
        "group__grade_level__name",
        "=academic_year__year",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load grade directors from CSV",
        description="Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, DOC_DOCENTE.",
        tags=["Grade Directors"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_grade_directors)


@schema_viewset(
    ["Enrollments"],
    "Student-group enrollment for an academic year",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "group__name",
        "group__grade_level__name",
        "=academic_year__year",
        "status",
    ],
    filter_fields=[
        "student",
        "student__document_number",
        "group",
        "group__name",
        "academic_year",
        "academic_year__year",
        "status",
    ],
)
class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related(
        "student", "group", "academic_year"
    ).all()
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "group",
        "group__name",
        "academic_year",
        "academic_year__year",
        "status",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "group__name",
        "group__grade_level__name",
        "=academic_year__year",
        "status",
    ]


@schema_viewset(
    ["Student Guardians"],
    "Student-parent/guardian relationship",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "parent__document_number",
        "parent__full_name",
        "parent__email",
    ],
    filter_fields=[
        "student",
        "student__document_number",
        "parent",
        "parent__document_number",
        "is_primary",
    ],
)
class StudentGuardianViewSet(viewsets.ModelViewSet):
    queryset = StudentGuardian.objects.select_related("student", "parent").all()
    serializer_class = StudentGuardianSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "parent",
        "parent__document_number",
        "is_primary",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "parent__document_number",
        "parent__full_name",
        "parent__email",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load student–guardian links from CSV",
        description="Columns: DOC_ESTUDIANTE, DOC_ACUDIENTE, ES_PRIMARIO.",
        tags=["Student Guardians"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_student_guardians)


@extend_schema_view(
    list=extend_schema(
        summary="List Grades",
        tags=["Grades"],
        description="Student grades with enriched context: student identity, course assignment (subject, teacher, group, academic year), and academic period. "
        "Text search available through query param `search`. Supported fields: student__document_number, student__full_name, "
        "course_assignment__subject__name, course_assignment__teacher__full_name, course_assignment__teacher__document_number, "
        "course_assignment__group__name, academic_period__name. "
        "Available exact-match filters via query params: student, student__document_number, course_assignment, "
        "course_assignment__group, course_assignment__group__name, course_assignment__subject__academic_area, "
        "course_assignment__teacher__document_number, academic_period, academic_period__number. "
        + OPENAPI_LIST_PAGINATION_DESCRIPTION,
        parameters=[
            *_openapi_limit_offset_parameters(),
            OpenApiParameter(
                name="search",
                type=str,
                location="query",
                required=False,
                description="Search text across: student__document_number, student__full_name, course_assignment__subject__name, course_assignment__teacher__full_name, course_assignment__teacher__document_number, course_assignment__group__name, academic_period__name.",
            ),
            OpenApiParameter(name="student", type=str, location="query", required=False, description="Filter by exact value of `student`."),
            OpenApiParameter(name="student__document_number", type=str, location="query", required=False, description="Filter by exact value of `student__document_number`."),
            OpenApiParameter(name="course_assignment", type=str, location="query", required=False, description="Filter by exact value of `course_assignment`."),
            OpenApiParameter(name="course_assignment__group", type=str, location="query", required=False, description="Filter by exact value of `course_assignment__group` (group id)."),
            OpenApiParameter(name="course_assignment__group__name", type=str, location="query", required=False, description="Filter by exact value of `course_assignment__group__name`."),
            OpenApiParameter(name="course_assignment__teacher__document_number", type=str, location="query", required=False, description="Filter by exact value of `course_assignment__teacher__document_number`."),
            OpenApiParameter(
                name="course_assignment__subject__academic_area",
                type=str,
                location="query",
                required=False,
                description="Filter by exact value of `course_assignment__subject__academic_area` (academic area id).",
            ),
            OpenApiParameter(name="academic_period", type=str, location="query", required=False, description="Filter by exact value of `academic_period`."),
            OpenApiParameter(name="academic_period__number", type=str, location="query", required=False, description="Filter by exact value of `academic_period__number`."),
        ],
    ),
    retrieve=extend_schema(
        summary="Get Grade",
        tags=["Grades"],
        description="Single grade with enriched context: student identity, course assignment (subject, teacher, group, academic year), and academic period.",
    ),
    create=extend_schema(summary="Create Grades", tags=["Grades"]),
    update=extend_schema(summary="Update Grades", tags=["Grades"]),
    partial_update=extend_schema(summary="Partial update Grades", tags=["Grades"]),
    destroy=extend_schema(summary="Delete Grades", tags=["Grades"]),
)
class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.select_related(
        "student",
        "course_assignment",
        "course_assignment__subject",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher",
        "course_assignment__group",
        "course_assignment__academic_year",
        "academic_period",
        "performance_level",
    ).all()
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "course_assignment",
        "course_assignment__group",
        "course_assignment__group__name",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher__document_number",
        "academic_period",
        "academic_period__number",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "course_assignment__subject__name",
        "course_assignment__teacher__full_name",
        "course_assignment__teacher__document_number",
        "course_assignment__group__name",
        "academic_period__name",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load grades from CSV",
        description="Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (optional), "
        "PERIODO_NUM, NOTA, COD_NIVEL (optional), NOTA_DEFINITIVA (optional). Requires existing CourseAssignment.",
        tags=["Grades"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_grades)


@schema_viewset(
    ["Attendance"],
    "Absences per subject and period",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "course_assignment__subject__name",
        "course_assignment__teacher__full_name",
        "academic_period__name",
    ],
    filter_fields=[
        "student",
        "student__document_number",
        "course_assignment",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher__document_number",
        "academic_period",
        "academic_period__number",
    ],
)
class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related(
        "student",
        "course_assignment",
        "course_assignment__subject",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher",
        "academic_period",
    ).all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "course_assignment",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher__document_number",
        "academic_period",
        "academic_period__number",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "course_assignment__subject__name",
        "course_assignment__teacher__full_name",
        "academic_period__name",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load attendance from CSV",
        description="Same context columns as grades plus INASISTENCIAS_SIN_JUSTIFICAR, INASISTENCIAS_JUSTIFICADAS.",
        tags=["Attendance"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_attendance)


@schema_viewset(
    ["Academic Indicators"],
    "Qualitative achievement descriptor for a student",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "course_assignment__subject__name",
        "course_assignment__teacher__full_name",
        "description",
        "performance_level",
    ],
    filter_fields=[
        "student",
        "student__document_number",
        "course_assignment",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher__document_number",
        "academic_period",
        "academic_period__number",
        "performance_level",
    ],
)
class AcademicIndicatorViewSet(viewsets.ModelViewSet):
    queryset = AcademicIndicator.objects.select_related(
        "student",
        "course_assignment",
        "course_assignment__subject",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher",
        "academic_period",
    ).all()
    serializer_class = AcademicIndicatorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "course_assignment",
        "course_assignment__subject__academic_area",
        "course_assignment__teacher__document_number",
        "academic_period",
        "academic_period__number",
        "performance_level",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "course_assignment__subject__name",
        "course_assignment__teacher__full_name",
        "description",
        "performance_level",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load academic indicators from CSV",
        description="Context columns as grades; DESCRIPCION, NOTA (optional), NIVEL_DESEMPENO_TEXTO (optional). Appends rows.",
        tags=["Academic Indicators"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_academic_indicators)


@schema_viewset(
    ["Performance Summaries"],
    "Student average and rank per period",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "group__name",
        "group__grade_level__name",
        "academic_period__name",
    ],
    filter_fields=[
        "student",
        "student__document_number",
        "group",
        "group__name",
        "academic_period",
        "academic_period__number",
    ],
)
class PerformanceSummaryViewSet(viewsets.ModelViewSet):
    queryset = PerformanceSummary.objects.select_related(
        "student", "group", "academic_period"
    ).all()
    serializer_class = PerformanceSummarySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "group",
        "group__name",
        "academic_period",
        "academic_period__number",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "group__name",
        "group__grade_level__name",
        "academic_period__name",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load performance summaries from CSV",
        description="Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, PERIODO_NUM, PROMEDIO_PERIODO, PUESTO, PROMEDIO_DEFINITIVO.",
        tags=["Performance Summaries"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_performance_summaries)


@schema_viewset(
    ["Disciplinary Reports"],
    "Qualitative disciplinary/behavior report",
    search_fields=[
        "student__document_number",
        "student__full_name",
        "report_text",
        "created_by__full_name",
        "created_by__document_number",
    ],
    filter_fields=[
        "student",
        "student__document_number",
        "academic_period",
        "academic_period__number",
        "created_by",
        "created_by__document_number",
    ],
)
class DisciplinaryReportViewSet(viewsets.ModelViewSet):
    queryset = DisciplinaryReport.objects.select_related(
        "student", "academic_period", "created_by"
    ).all()
    serializer_class = DisciplinaryReportSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "academic_period",
        "academic_period__number",
        "created_by",
        "created_by__document_number",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "report_text",
        "created_by__full_name",
        "created_by__document_number",
    ]

    @bulk_csv_load_schema(
        summary="Bulk load disciplinary reports from CSV",
        description="Columns: DOC_ESTUDIANTE, DANE_COD, ANO, PERIODO_NUM, TEXTO, DOC_DOCENTE_CREADOR (optional).",
        tags=["Disciplinary Reports"],
        request_serializer=BulkLoadFileSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-load", parser_classes=[MultiPartParser])
    def bulk_load(self, request):
        return _bulk_csv_response(request, bulk_load_disciplinary_reports)


@extend_schema_view(
    list=extend_schema(
        summary="List School Records",
        tags=["School Records"],
        description="Text search available through query param `search`. Supported fields: student__document_number, "
        "student__full_name, group__name, group__grade_level__name, institution__name, institution__dane_code, campus__name. "
        "Available exact-match filters via query params: student, student__document_number, academic_year, academic_year__year, institution, institution__dane_code. "
        + OPENAPI_LIST_PAGINATION_DESCRIPTION,
        parameters=[
            *_openapi_limit_offset_parameters(),
            OpenApiParameter(
                name="search",
                type=str,
                location="query",
                required=False,
                description="Search text across: student__document_number, student__full_name, group__name, group__grade_level__name, institution__name, institution__dane_code, campus__name.",
            ),
            OpenApiParameter(name="student", type=str, location="query", required=False, description="Filter by exact value of `student`."),
            OpenApiParameter(name="student__document_number", type=str, location="query", required=False, description="Filter by exact value of `student__document_number`."),
            OpenApiParameter(name="academic_year", type=str, location="query", required=False, description="Filter by exact value of `academic_year`."),
            OpenApiParameter(name="academic_year__year", type=str, location="query", required=False, description="Filter by exact value of `academic_year__year`."),
            OpenApiParameter(name="institution", type=str, location="query", required=False, description="Filter by exact value of `institution`."),
            OpenApiParameter(name="institution__dane_code", type=str, location="query", required=False, description="Filter by exact value of `institution__dane_code`."),
        ],
    ),
    retrieve=extend_schema(summary="Get School Record", tags=["School Records"]),
    create=extend_schema(summary="Create/Generate School Record", tags=["School Records"]),
)
class SchoolRecordViewSet(viewsets.ModelViewSet):
    """School Assessment Record document. GET list/detail, POST to generate."""

    queryset = SchoolRecord.objects.select_related(
        "student", "group", "academic_year", "institution", "campus"
    ).all()
    serializer_class = SchoolRecordSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "academic_year",
        "academic_year__year",
        "institution",
        "institution__dane_code",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "group__name",
        "group__grade_level__name",
        "institution__name",
        "institution__dane_code",
        "campus__name",
    ]
    http_method_names = ["get", "post"]

    def perform_create(self, serializer):
        serializer.save(generated_at=timezone.now())


@extend_schema_view(
    list=extend_schema(
        summary="List Academic Indicators Reports",
        tags=["Academic Indicators Reports"],
        description="Text search available through query param `search`. Supported fields: student__document_number, "
        "student__full_name, group__name, academic_period__name, grade_director__full_name, grade_director__document_number. "
        "Available exact-match filters via query params: student, student__document_number, academic_period, academic_period__number, grade_director, grade_director__document_number. "
        + OPENAPI_LIST_PAGINATION_DESCRIPTION,
        parameters=[
            *_openapi_limit_offset_parameters(),
            OpenApiParameter(
                name="search",
                type=str,
                location="query",
                required=False,
                description="Search text across: student__document_number, student__full_name, group__name, academic_period__name, grade_director__full_name, grade_director__document_number.",
            ),
            OpenApiParameter(name="student", type=str, location="query", required=False, description="Filter by exact value of `student`."),
            OpenApiParameter(name="student__document_number", type=str, location="query", required=False, description="Filter by exact value of `student__document_number`."),
            OpenApiParameter(name="academic_period", type=str, location="query", required=False, description="Filter by exact value of `academic_period`."),
            OpenApiParameter(name="academic_period__number", type=str, location="query", required=False, description="Filter by exact value of `academic_period__number`."),
            OpenApiParameter(name="grade_director", type=str, location="query", required=False, description="Filter by exact value of `grade_director`."),
            OpenApiParameter(name="grade_director__document_number", type=str, location="query", required=False, description="Filter by exact value of `grade_director__document_number`."),
        ],
    ),
    retrieve=extend_schema(
        summary="Get Academic Indicators Report", tags=["Academic Indicators Reports"]
    ),
    create=extend_schema(
        summary="Create/Generate Academic Indicators Report",
        tags=["Academic Indicators Reports"],
    ),
)
class AcademicIndicatorsReportViewSet(viewsets.ModelViewSet):
    """Academic Indicators document. GET list/detail, POST to generate."""

    queryset = AcademicIndicatorsReport.objects.select_related(
        "student", "group", "academic_period", "grade_director"
    ).all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "student",
        "student__document_number",
        "academic_period",
        "academic_period__number",
        "grade_director",
        "grade_director__document_number",
    ]
    search_fields = [
        "student__document_number",
        "student__full_name",
        "group__name",
        "academic_period__name",
        "grade_director__full_name",
        "grade_director__document_number",
    ]
    http_method_names = ["get", "post"]

    def perform_create(self, serializer):
        serializer.save(generated_at=timezone.now())


@schema_viewset(
    ["Users"],
    "User profile for RBAC (Admin only)",
    search_fields=[
        "user__username",
        "user__email",
        "teacher__document_number",
        "teacher__full_name",
        "parent__document_number",
        "parent__full_name",
        "institution__name",
    ],
    filter_fields=["role", "institution", "institution__dane_code", "user__username", "user__email"],
)
class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related(
        "user", "teacher", "parent", "institution"
    ).all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = [
        "role",
        "institution",
        "institution__dane_code",
        "user__username",
        "user__email",
    ]
    search_fields = [
        "user__username",
        "user__email",
        "teacher__document_number",
        "teacher__full_name",
        "parent__document_number",
        "parent__full_name",
        "institution__name",
    ]
