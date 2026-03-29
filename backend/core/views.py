"""API ViewSets with OpenAPI documentation. All use IsAuthenticated; RBAC scope filtering can be applied per-view."""
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .bulk_load import bulk_load_students
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
from .permissions import IsAdminUser
from .serializers import (
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


def schema_viewset(tags: list, description: str = ""):
    """Decorator for ViewSet OpenAPI schema."""
    return extend_schema_view(
        list=extend_schema(summary=f"List {tags[0]}", tags=tags, description=description),
        retrieve=extend_schema(summary=f"Get {tags[0]}", tags=tags),
        create=extend_schema(summary=f"Create {tags[0]}", tags=tags),
        update=extend_schema(summary=f"Update {tags[0]}", tags=tags),
        partial_update=extend_schema(summary=f"Partial update {tags[0]}", tags=tags),
        destroy=extend_schema(summary=f"Delete {tags[0]}", tags=tags),
    )


@schema_viewset(["Institutions"], "Educational institutions at corporate level")
class InstitutionViewSet(viewsets.ModelViewSet):
    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer
    permission_classes = [IsAuthenticated]


@schema_viewset(["Campuses"], "Campus or sede of an institution")
class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.select_related("institution").all()
    serializer_class = CampusSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution"]


@schema_viewset(["Academic Years"], "Academic/school year")
class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.select_related("institution").all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution", "is_active"]


@schema_viewset(["Grade Levels"], "Grade level (e.g. SEXTO, PRIMERO)")
class GradeLevelViewSet(viewsets.ModelViewSet):
    queryset = GradeLevel.objects.select_related("institution").all()
    serializer_class = GradeLevelSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution"]


@schema_viewset(["Academic Areas"], "Broad category of knowledge")
class AcademicAreaViewSet(viewsets.ModelViewSet):
    queryset = AcademicArea.objects.select_related("institution").all()
    serializer_class = AcademicAreaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution"]


@schema_viewset(["Grading Scales"], "Performance levels per Decreto 1290")
class GradingScaleViewSet(viewsets.ModelViewSet):
    queryset = GradingScale.objects.select_related("institution").all()
    serializer_class = GradingScaleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["institution"]


@schema_viewset(["Students"], "Student data")
class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["full_name", "first_name", "first_last_name", "document_number"]

    @extend_schema(
        summary="Bulk load students from CSV",
        description="Upload a CSV file to create/update students, enrollments, institutions, "
        "campuses, academic years, grade levels, and groups. CSV format: ANO, INSTITUCION, "
        "SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, "
        "APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO, BARRIO, EPS, "
        "TIPO DE SANGRE, DISCAPACIDAD, TELEFONO. Use multipart/form-data with field 'file'.",
        tags=["Students"],
        request={"multipart/form-data": BulkLoadStudentsSerializer},
        responses={200: {"description": "Bulk load statistics"}},
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


@schema_viewset(["Teachers"], "Teacher/faculty information")
class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["full_name", "email"]


@schema_viewset(["Parents"], "Parent or guardian of a student")
class ParentViewSet(viewsets.ModelViewSet):
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["full_name", "email"]


@schema_viewset(["Groups"], "Student group within a grade")
class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.select_related(
        "grade_level", "academic_year", "campus"
    ).all()
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["grade_level", "academic_year", "campus"]

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


@schema_viewset(["Subjects"], "Subject/course with optional emphasis")
class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.select_related("academic_area", "institution").all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["academic_area", "institution"]


@schema_viewset(["Academic Periods"], "Evaluation period (P1, P2, P3, P4)")
class AcademicPeriodViewSet(viewsets.ModelViewSet):
    queryset = AcademicPeriod.objects.select_related("academic_year").all()
    serializer_class = AcademicPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["academic_year"]


@schema_viewset(
    ["Course Assignments"],
    "Teacher assigned to a subject in a group for an academic year",
)
class CourseAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CourseAssignment.objects.select_related(
        "subject", "teacher", "group", "academic_year"
    ).all()
    serializer_class = CourseAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["subject", "teacher", "group", "academic_year"]


@schema_viewset(["Grade Directors"], "Homeroom teacher for a group")
class GradeDirectorViewSet(viewsets.ModelViewSet):
    queryset = GradeDirector.objects.select_related(
        "teacher", "group", "academic_year"
    ).all()
    serializer_class = GradeDirectorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["teacher", "group", "academic_year"]


@schema_viewset(["Enrollments"], "Student-group enrollment for an academic year")
class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related(
        "student", "group", "academic_year"
    ).all()
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "group", "academic_year", "status"]


@schema_viewset(["Student Guardians"], "Student-parent/guardian relationship")
class StudentGuardianViewSet(viewsets.ModelViewSet):
    queryset = StudentGuardian.objects.select_related("student", "parent").all()
    serializer_class = StudentGuardianSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "parent", "is_primary"]


@schema_viewset(["Grades"], "Student grade in a subject for a period")
class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.select_related(
        "student", "course_assignment", "academic_period", "performance_level"
    ).all()
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "course_assignment", "academic_period"]


@schema_viewset(["Attendance"], "Absences per subject and period")
class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related(
        "student", "course_assignment", "academic_period"
    ).all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "course_assignment", "academic_period"]


@schema_viewset(
    ["Academic Indicators"],
    "Qualitative achievement descriptor for a student",
)
class AcademicIndicatorViewSet(viewsets.ModelViewSet):
    queryset = AcademicIndicator.objects.select_related(
        "student", "course_assignment", "academic_period"
    ).all()
    serializer_class = AcademicIndicatorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "course_assignment", "academic_period"]


@schema_viewset(
    ["Performance Summaries"],
    "Student average and rank per period",
)
class PerformanceSummaryViewSet(viewsets.ModelViewSet):
    queryset = PerformanceSummary.objects.select_related(
        "student", "group", "academic_period"
    ).all()
    serializer_class = PerformanceSummarySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "group", "academic_period"]


@schema_viewset(
    ["Disciplinary Reports"],
    "Qualitative disciplinary/behavior report",
)
class DisciplinaryReportViewSet(viewsets.ModelViewSet):
    queryset = DisciplinaryReport.objects.select_related(
        "student", "academic_period", "created_by"
    ).all()
    serializer_class = DisciplinaryReportSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "academic_period"]


@extend_schema_view(
    list=extend_schema(summary="List School Records", tags=["School Records"]),
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
    filterset_fields = ["student", "academic_year", "institution"]
    http_method_names = ["get", "post"]

    def perform_create(self, serializer):
        serializer.save(generated_at=timezone.now())


@extend_schema_view(
    list=extend_schema(
        summary="List Academic Indicators Reports", tags=["Academic Indicators Reports"]
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
    filterset_fields = ["student", "academic_period"]
    http_method_names = ["get", "post"]

    def perform_create(self, serializer):
        serializer.save(generated_at=timezone.now())


@schema_viewset(["Users"], "User profile for RBAC (Admin only)")
class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related(
        "user", "teacher", "parent", "institution"
    ).all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["role", "institution"]
