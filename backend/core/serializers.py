"""Serializers for core API. All entities use snake_case fields per plan conventions."""
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from .indicator_utils import resolve_indicator_outcome
from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicIndicatorCatalog,
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


class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = [
            "id",
            "name",
            "legal_reference",
            "dane_code",
            "nit",
            "created_at",
            "updated_at",
        ]


class CampusSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True)

    class Meta:
        model = Campus
        fields = [
            "id",
            "institution",
            "institution_name",
            "name",
            "code",
            "created_at",
            "updated_at",
        ]


class AcademicYearSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True)

    class Meta:
        model = AcademicYear
        fields = [
            "id",
            "institution",
            "institution_name",
            "year",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
            "updated_at",
        ]


class GradeLevelSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True)

    class Meta:
        model = GradeLevel
        fields = [
            "id",
            "institution",
            "institution_name",
            "name",
            "level_order",
            "created_at",
            "updated_at",
        ]


class AcademicAreaSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True)

    class Meta:
        model = AcademicArea
        fields = [
            "id",
            "institution",
            "institution_name",
            "name",
            "code",
            "description",
            "created_at",
            "updated_at",
        ]


class GradingScaleSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True)

    class Meta:
        model = GradingScale
        fields = [
            "id",
            "institution",
            "institution_name",
            "code",
            "name",
            "min_score",
            "max_score",
            "description",
            "created_at",
            "updated_at",
        ]


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            "id",
            "document_type",
            "document_number",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "full_name",
            "date_of_birth",
            "gender",
            "enrollment_date",
            "stratum",
            "sisben",
            "neighborhood",
            "health_insurer",
            "blood_type",
            "disability",
            "phone",
            "created_at",
            "updated_at",
        ]


@extend_schema_serializer(component_name="BulkLoadCsvUpload")
class BulkLoadFileSerializer(serializers.Serializer):
    """Multipart CSV upload for bulk loaders (OpenAPI: multipart field ``file``)."""

    file = serializers.FileField(help_text="UTF-8 CSV file (.csv)")


@extend_schema_serializer(component_name="BulkLoadStudentsCsv")
class BulkLoadStudentsSerializer(serializers.Serializer):
    """Request serializer for student bulk load (OpenAPI: multipart field ``file``)."""

    file = serializers.FileField(
        help_text="CSV file with columns: ANO, INSTITUCION, SEDE, GRADO_COD, GRADO, GRUPO, "
        "FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, "
        "GENERO, FECHA_NACIMIENTO, BARRIO, EPS, TIPO DE SANGRE, DISCAPACIDAD, TELEFONO"
    )


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = [
            "id",
            "document_type",
            "document_number",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "full_name",
            "email",
            "phone",
            "specialty",
            "created_at",
            "updated_at",
        ]


class ParentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parent
        fields = [
            "id",
            "document_type",
            "document_number",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "full_name",
            "email",
            "phone",
            "kinship",
            "created_at",
            "updated_at",
        ]


class GroupSerializer(serializers.ModelSerializer):
    grade_level_name = serializers.CharField(source="grade_level.name", read_only=True)
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)
    campus_name = serializers.CharField(source="campus.name", read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "grade_level",
            "grade_level_name",
            "academic_year",
            "academic_year_year",
            "campus",
            "campus_name",
            "name",
            "created_at",
            "updated_at",
        ]


class SubjectSerializer(serializers.ModelSerializer):
    academic_area_name = serializers.CharField(source="academic_area.name", read_only=True)
    institution_name = serializers.CharField(source="institution.name", read_only=True)

    class Meta:
        model = Subject
        fields = [
            "id",
            "academic_area",
            "academic_area_name",
            "institution",
            "institution_name",
            "name",
            "emphasis",
            "hours",
            "created_at",
            "updated_at",
        ]


class AcademicPeriodSerializer(serializers.ModelSerializer):
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)

    class Meta:
        model = AcademicPeriod
        fields = [
            "id",
            "academic_year",
            "academic_year_year",
            "number",
            "name",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
        ]


class CourseAssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_academic_area = serializers.UUIDField(
        source="subject.academic_area_id", read_only=True
    )
    subject_academic_area_name = serializers.CharField(
        source="subject.academic_area.name", read_only=True
    )
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    teacher_document_number = serializers.CharField(
        source="teacher.document_number", read_only=True
    )
    group_name = serializers.CharField(source="group.name", read_only=True)
    group_grade_level = serializers.UUIDField(
        source="group.grade_level_id", read_only=True
    )
    group_grade_level_name = serializers.CharField(
        source="group.grade_level.name", read_only=True
    )
    campus = serializers.UUIDField(source="group.campus_id", read_only=True)
    campus_name = serializers.CharField(source="group.campus.name", read_only=True)
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)

    class Meta:
        model = CourseAssignment
        fields = [
            "id",
            "subject",
            "subject_name",
            "subject_academic_area",
            "subject_academic_area_name",
            "teacher",
            "teacher_name",
            "teacher_document_number",
            "group",
            "group_name",
            "group_grade_level",
            "group_grade_level_name",
            "campus",
            "campus_name",
            "academic_year",
            "academic_year_year",
            "created_at",
            "updated_at",
        ]


class GradeDirectorSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)

    class Meta:
        model = GradeDirector
        fields = [
            "id",
            "teacher",
            "teacher_name",
            "group",
            "group_name",
            "academic_year",
            "academic_year_year",
            "created_at",
            "updated_at",
        ]


class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_document_number = serializers.CharField(
        source="student.document_number", read_only=True
    )
    group_name = serializers.CharField(source="group.name", read_only=True)
    campus_name = serializers.CharField(source="group.campus.name", read_only=True)
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "student",
            "student_name",
            "student_document_number",
            "group",
            "group_name",
            "campus_name",
            "academic_year",
            "academic_year_year",
            "enrollment_date",
            "status",
            "created_at",
            "updated_at",
        ]


class StudentGuardianSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    parent_name = serializers.CharField(source="parent.full_name", read_only=True)

    class Meta:
        model = StudentGuardian
        fields = [
            "id",
            "student",
            "student_name",
            "parent",
            "parent_name",
            "is_primary",
            "created_at",
            "updated_at",
        ]


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_document_number = serializers.CharField(
        source="student.document_number", read_only=True
    )
    student_document_type = serializers.CharField(
        source="student.document_type", read_only=True
    )
    course_assignment_subject_name = serializers.CharField(
        source="course_assignment.subject.name", read_only=True
    )
    course_assignment_subject_emphasis = serializers.CharField(
        source="course_assignment.subject.emphasis", read_only=True
    )
    course_assignment_teacher_name = serializers.CharField(
        source="course_assignment.teacher.full_name", read_only=True
    )
    course_assignment_group_name = serializers.CharField(
        source="course_assignment.group.name", read_only=True
    )
    course_assignment_academic_year_year = serializers.IntegerField(
        source="course_assignment.academic_year.year", read_only=True
    )
    academic_period_name = serializers.CharField(
        source="academic_period.name", read_only=True
    )
    academic_period_number = serializers.IntegerField(
        source="academic_period.number", read_only=True
    )
    performance_level_name = serializers.CharField(
        source="performance_level.name", read_only=True
    )

    class Meta:
        model = Grade
        fields = [
            "id",
            "student",
            "student_name",
            "student_document_number",
            "student_document_type",
            "course_assignment",
            "course_assignment_subject_name",
            "course_assignment_subject_emphasis",
            "course_assignment_teacher_name",
            "course_assignment_group_name",
            "course_assignment_academic_year_year",
            "academic_period",
            "academic_period_name",
            "academic_period_number",
            "numerical_grade",
            "performance_level",
            "performance_level_name",
            "definitive_grade",
            "created_at",
            "updated_at",
        ]


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "student",
            "student_name",
            "course_assignment",
            "academic_period",
            "unexcused_absences",
            "excused_absences",
            "created_at",
            "updated_at",
        ]


class AcademicIndicatorCatalogSerializer(serializers.ModelSerializer):
    academic_area_name = serializers.CharField(
        source="academic_area.name", read_only=True
    )
    grade_level_name = serializers.CharField(source="grade_level.name", read_only=True)

    class Meta:
        model = AcademicIndicatorCatalog
        fields = [
            "id",
            "academic_area",
            "academic_area_name",
            "grade_level",
            "grade_level_name",
            "achievement_below_basic",
            "achievement_basic_or_above",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        instance = self.instance
        area = attrs.get("academic_area") or (
            instance.academic_area if instance else None
        )
        gl = attrs.get("grade_level") or (instance.grade_level if instance else None)
        if (
            area
            and gl
            and area.institution_id != gl.institution_id
        ):
            raise serializers.ValidationError(
                "El área académica y el grado deben pertenecer a la misma institución."
            )
        return attrs


class AcademicIndicatorSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    catalog_label = serializers.SerializerMethodField()

    def get_catalog_label(self, obj):
        c = obj.catalog
        if not c:
            return ""
        return f"{c.academic_area.name} / {c.grade_level.name}"

    class Meta:
        model = AcademicIndicator
        fields = [
            "id",
            "student",
            "student_name",
            "course_assignment",
            "academic_period",
            "catalog",
            "catalog_label",
            "outcome",
            "description",
            "numerical_grade",
            "performance_level",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        instance = self.instance
        ca = attrs.get("course_assignment") or (
            instance.course_assignment if instance else None
        )
        if "catalog" in attrs:
            catalog = attrs["catalog"]
        else:
            catalog = instance.catalog if instance else None

        if "numerical_grade" in attrs:
            num_grade = attrs["numerical_grade"]
        else:
            num_grade = instance.numerical_grade if instance else None

        if "performance_level" in attrs:
            perf = attrs["performance_level"]
        else:
            perf = instance.performance_level if instance else ""
        perf = perf or ""

        if "outcome" in attrs:
            outcome = (attrs.get("outcome") or "").strip()
        else:
            outcome = (instance.outcome or "").strip() if instance else ""

        if "description" in attrs:
            desc_in = attrs["description"]
        else:
            desc_in = instance.description if instance else ""

        if ca and catalog:
            if catalog.academic_area_id != ca.subject.academic_area_id:
                raise serializers.ValidationError(
                    {
                        "catalog": (
                            "El catálogo debe corresponder al área académica de la "
                            "asignatura del curso."
                        )
                    }
                )
            if catalog.grade_level_id != ca.group.grade_level_id:
                raise serializers.ValidationError(
                    {
                        "catalog": (
                            "El catálogo debe corresponder al grado del grupo de la "
                            "asignación."
                        )
                    }
                )
            scales = list(
                GradingScale.objects.filter(
                    institution_id=ca.subject.institution_id
                ).order_by("-min_score")
            )
            inferred = resolve_indicator_outcome(num_grade, perf, scales)
            if inferred:
                attrs["outcome"] = inferred
                outcome = inferred

        if catalog and (outcome or "").strip() in (
            "below_basic",
            "basic_or_above",
        ):
            attrs["description"] = (
                catalog.achievement_below_basic
                if outcome == "below_basic"
                else catalog.achievement_basic_or_above
            )
        elif not (desc_in or "").strip():
            raise serializers.ValidationError(
                {
                    "description": (
                        "Indique el texto del logro o bien un catálogo con nota o "
                        "nivel de desempeño para determinar Bajo vs Básico o superior."
                    )
                }
            )

        return attrs


class PerformanceSummarySerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = PerformanceSummary
        fields = [
            "id",
            "student",
            "student_name",
            "group",
            "group_name",
            "academic_period",
            "period_average",
            "rank",
            "definitive_average",
            "created_at",
            "updated_at",
        ]


class DisciplinaryReportSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    class Meta:
        model = DisciplinaryReport
        fields = [
            "id",
            "student",
            "student_name",
            "academic_period",
            "report_text",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]


class SchoolRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    institution_name = serializers.CharField(source="institution.name", read_only=True)
    campus_name = serializers.CharField(source="campus.name", read_only=True)

    class Meta:
        model = SchoolRecord
        fields = [
            "id",
            "student",
            "student_name",
            "group",
            "group_name",
            "academic_year",
            "institution",
            "institution_name",
            "campus",
            "campus_name",
            "generated_at",
            "created_at",
            "updated_at",
        ]


class AcademicIndicatorsReportSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    grade_director_name = serializers.CharField(
        source="grade_director.full_name", read_only=True
    )

    class Meta:
        model = AcademicIndicatorsReport
        fields = [
            "id",
            "student",
            "student_name",
            "group",
            "group_name",
            "academic_period",
            "grade_director",
            "grade_director_name",
            "general_observations",
            "generated_at",
            "created_at",
            "updated_at",
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "user",
            "username",
            "email",
            "role",
            "teacher",
            "parent",
            "institution",
            "created_at",
            "updated_at",
        ]
