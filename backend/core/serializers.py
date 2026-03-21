"""Serializers for core API. All entities use snake_case fields per plan conventions."""
from rest_framework import serializers

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
            "created_at",
            "updated_at",
        ]


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
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)

    class Meta:
        model = CourseAssignment
        fields = [
            "id",
            "subject",
            "subject_name",
            "teacher",
            "teacher_name",
            "group",
            "group_name",
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
    group_name = serializers.CharField(source="group.name", read_only=True)
    academic_year_year = serializers.IntegerField(source="academic_year.year", read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "student",
            "student_name",
            "group",
            "group_name",
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
    performance_level_name = serializers.CharField(
        source="performance_level.name", read_only=True
    )

    class Meta:
        model = Grade
        fields = [
            "id",
            "student",
            "student_name",
            "course_assignment",
            "academic_period",
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


class AcademicIndicatorSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = AcademicIndicator
        fields = [
            "id",
            "student",
            "student_name",
            "course_assignment",
            "academic_period",
            "description",
            "numerical_grade",
            "performance_level",
            "created_at",
            "updated_at",
        ]


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
