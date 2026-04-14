"""
Core models for the eduCalc academic reporting system.

All models use UUID primary keys and standard timestamps.
Reference: docs/analisis-entidades-reporte-academico.md
"""
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model with UUID pk and created/updated timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Institution(TimeStampedModel):
    """Educational institution at corporate level."""

    name = models.CharField(max_length=255)
    legal_reference = models.CharField(max_length=255, blank=True)
    dane_code = models.CharField(max_length=20, unique=True)
    nit = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Institution"
        verbose_name_plural = "Institutions"

    def __str__(self):
        return self.name


class Campus(TimeStampedModel):
    """Campus or sede of an institution."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="campuses"
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Campus"
        verbose_name_plural = "Campuses"

    def __str__(self):
        return f"{self.name} ({self.institution.name})"


class AcademicYear(TimeStampedModel):
    """Academic/school year."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="academic_years"
    )
    year = models.PositiveIntegerField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-year"]
        verbose_name = "Academic Year"
        verbose_name_plural = "Academic Years"
        unique_together = [["institution", "year"]]

    def __str__(self):
        return f"{self.institution.name} - {self.year}"


class GradeLevel(TimeStampedModel):
    """Grade level (e.g. SEXTO, PRIMERO, SEGUNDO)."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="grade_levels"
    )
    name = models.CharField(max_length=100)
    level_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["level_order", "name"]
        verbose_name = "Grade Level"
        verbose_name_plural = "Grade Levels"
        unique_together = [["institution", "name"]]

    def __str__(self):
        return self.name


class AcademicArea(TimeStampedModel):
    """Broad category of knowledge (e.g. BIENESTAR Y CULTURA, PENSAMIENTO MATEMÁTICO)."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="academic_areas"
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Academic Area"
        verbose_name_plural = "Academic Areas"
        unique_together = [["institution", "name"]]

    def __str__(self):
        return self.name


class GradingScale(TimeStampedModel):
    """Performance levels per Decreto 1290 (Superior, Alto, Básico, Bajo)."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="grading_scales"
    )
    code = models.CharField(max_length=10)  # SP, AL, BS, BJ
    name = models.CharField(max_length=50)  # Superior, Alto, Básico, Bajo
    min_score = models.DecimalField(max_digits=4, decimal_places=2)
    max_score = models.DecimalField(max_digits=4, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-min_score"]
        verbose_name = "Grading Scale"
        verbose_name_plural = "Grading Scales"
        unique_together = [["institution", "code"]]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.min_score}-{self.max_score})"


# --- Phase 2: Person models ---


class Student(TimeStampedModel):
    """Student data."""

    document_type = models.CharField(max_length=80, blank=True, default="")  # CC, TI, RC, RC:REGISTRO CIVIL...
    document_number = models.CharField(max_length=20, blank=True, default="")
    first_name = models.CharField(max_length=100)
    second_name = models.CharField(max_length=100, blank=True, default="")
    first_last_name = models.CharField(max_length=100)
    second_last_name = models.CharField(max_length=100, blank=True, default="")
    full_name = models.CharField(max_length=400)  # Computed or stored
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=30, blank=True, default="")
    enrollment_date = models.DateField(null=True, blank=True)
    # Additional fields from bulk load (Colombian context)
    stratum = models.CharField(max_length=50, blank=True, default="")  # ESTRATO
    sisben = models.CharField(max_length=20, blank=True, default="")  # SISBEN IV level
    neighborhood = models.CharField(max_length=150, blank=True, default="")  # BARRIO
    health_insurer = models.CharField(max_length=150, blank=True, default="")  # EPS
    blood_type = models.CharField(max_length=10, blank=True, default="")  # TIPO DE SANGRE
    disability = models.CharField(max_length=100, blank=True, default="")  # DISCAPACIDAD
    phone = models.CharField(max_length=30, blank=True, default="")

    class Meta:
        ordering = ["full_name"]
        verbose_name = "Student"
        verbose_name_plural = "Students"

    def __str__(self):
        return self.full_name

    def save(self, *args, **kwargs):
        if not self.full_name:
            parts = [
                self.first_last_name,
                self.second_last_name,
                self.first_name,
                self.second_name,
            ]
            self.full_name = " ".join(p for p in parts if p).strip()
        super().save(*args, **kwargs)


class Teacher(TimeStampedModel):
    """Teacher/faculty information."""

    document_type = models.CharField(max_length=80, blank=True, default="")
    document_number = models.CharField(max_length=20, blank=True)
    first_name = models.CharField(max_length=100)
    second_name = models.CharField(max_length=100, blank=True)
    first_last_name = models.CharField(max_length=100)
    second_last_name = models.CharField(max_length=100, blank=True)
    full_name = models.CharField(max_length=400)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    specialty = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["full_name"]
        verbose_name = "Teacher"
        verbose_name_plural = "Teachers"

    def __str__(self):
        return self.full_name

    def save(self, *args, **kwargs):
        if not self.full_name:
            parts = [
                self.first_last_name,
                self.second_last_name,
                self.first_name,
                self.second_name,
            ]
            self.full_name = " ".join(p for p in parts if p).strip()
        super().save(*args, **kwargs)


class Parent(TimeStampedModel):
    """Parent or guardian of a student."""

    document_type = models.CharField(max_length=80, blank=True, default="")
    document_number = models.CharField(max_length=20, blank=True)
    first_name = models.CharField(max_length=100)
    second_name = models.CharField(max_length=100, blank=True)
    first_last_name = models.CharField(max_length=100)
    second_last_name = models.CharField(max_length=100, blank=True)
    full_name = models.CharField(max_length=400)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    kinship = models.CharField(max_length=50, blank=True)  # padre, madre, acudiente

    class Meta:
        ordering = ["full_name"]
        verbose_name = "Parent"
        verbose_name_plural = "Parents"

    def __str__(self):
        return self.full_name


# --- Phase 3: Relational academic models ---


class Group(TimeStampedModel):
    """Student group within a grade (e.g. 601, 602)."""

    grade_level = models.ForeignKey(
        GradeLevel, on_delete=models.CASCADE, related_name="groups"
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="groups"
    )
    campus = models.ForeignKey(
        Campus, on_delete=models.CASCADE, related_name="groups"
    )
    name = models.CharField(max_length=50)

    class Meta:
        # Tie-break on pk so limit/offset pagination is stable when many groups share `name`.
        ordering = ["academic_year__year", "campus_id", "grade_level__level_order", "name", "pk"]
        verbose_name = "Group"
        verbose_name_plural = "Groups"
        unique_together = [["grade_level", "academic_year", "campus", "name"]]

    def __str__(self):
        return f"{self.name} ({self.academic_year.year})"


class Subject(TimeStampedModel):
    """Subject/course with optional emphasis within an area."""

    academic_area = models.ForeignKey(
        AcademicArea, on_delete=models.CASCADE, related_name="subjects"
    )
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="subjects"
    )
    name = models.CharField(max_length=255)
    emphasis = models.CharField(max_length=255, blank=True)
    hours = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Subject"
        verbose_name_plural = "Subjects"

    def __str__(self):
        if self.emphasis:
            return f"{self.name}: {self.emphasis}"
        return self.name


class AcademicPeriod(TimeStampedModel):
    """Evaluation period (P1, P2, P3, P4)."""

    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="periods"
    )
    number = models.PositiveIntegerField()  # 1, 2, 3, 4
    name = models.CharField(max_length=20)  # P1, P2, P3, P4
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["number"]
        verbose_name = "Academic Period"
        verbose_name_plural = "Academic Periods"
        unique_together = [["academic_year", "number"]]

    def __str__(self):
        return f"{self.name} ({self.academic_year.year})"


class CourseAssignment(TimeStampedModel):
    """Teacher assigned to a subject in a group for an academic year."""

    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="course_assignments"
    )
    teacher = models.ForeignKey(
        Teacher, on_delete=models.CASCADE, related_name="course_assignments"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="course_assignments"
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="course_assignments"
    )

    class Meta:
        verbose_name = "Course Assignment"
        verbose_name_plural = "Course Assignments"
        unique_together = [["subject", "group", "academic_year"]]

    def __str__(self):
        return f"{self.subject.name} - {self.group.name} ({self.academic_year.year})"


class GradeDirector(TimeStampedModel):
    """Teacher responsible for a specific group (homeroom teacher)."""

    teacher = models.ForeignKey(
        Teacher, on_delete=models.CASCADE, related_name="grade_director_assignments"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="grade_directors"
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="grade_directors"
    )

    class Meta:
        verbose_name = "Grade Director"
        verbose_name_plural = "Grade Directors"
        unique_together = [["group", "academic_year"]]

    def __str__(self):
        return f"{self.teacher.full_name} - {self.group.name} ({self.academic_year.year})"


class Enrollment(TimeStampedModel):
    """Student-group enrollment for an academic year."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="enrollments"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="enrollments"
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="enrollments"
    )
    enrollment_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("withdrawn", "Withdrawn"),
            ("graduated", "Graduated"),
        ],
    )

    class Meta:
        verbose_name = "Enrollment"
        verbose_name_plural = "Enrollments"
        unique_together = [["student", "group", "academic_year"]]

    def __str__(self):
        return f"{self.student.full_name} - {self.group.name} ({self.academic_year.year})"


class StudentGuardian(TimeStampedModel):
    """Student-parent/guardian relationship."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="guardians"
    )
    parent = models.ForeignKey(
        Parent, on_delete=models.CASCADE, related_name="students"
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Student Guardian"
        verbose_name_plural = "Student Guardians"
        unique_together = [["student", "parent"]]

    def __str__(self):
        return f"{self.parent.full_name} - {self.student.full_name}"


# --- Phase 4: Evaluation models ---


class AcademicIndicatorCatalog(TimeStampedModel):
    """
    Catálogo de logros cualitativos por área académica y grado.

    ``achievement_below_basic`` aplica cuando el desempeño es Bajo (por debajo
    del umbral de Básico). ``achievement_basic_or_above`` cuando el desempeño
    es Básico, Alto o Superior, según las escalas de valoración de la institución.
    """

    academic_area = models.ForeignKey(
        AcademicArea,
        on_delete=models.CASCADE,
        related_name="indicator_catalogs",
    )
    grade_level = models.ForeignKey(
        GradeLevel,
        on_delete=models.CASCADE,
        related_name="indicator_catalogs",
    )
    achievement_below_basic = models.TextField()
    achievement_basic_or_above = models.TextField()

    class Meta:
        ordering = [
            "academic_area__name",
            "grade_level__level_order",
            "grade_level__name",
        ]
        verbose_name = "Academic Indicator Catalog"
        verbose_name_plural = "Academic Indicator Catalogs"
        unique_together = [["academic_area", "grade_level"]]

    def clean(self):
        super().clean()
        if (
            self.academic_area_id
            and self.grade_level_id
            and self.academic_area.institution_id != self.grade_level.institution_id
        ):
            raise ValidationError(
                "El área académica y el grado deben pertenecer a la misma institución."
            )

    def __str__(self):
        return f"{self.academic_area.name} / {self.grade_level.name}"


class Grade(TimeStampedModel):
    """Student grade in a subject for a period."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="grades"
    )
    course_assignment = models.ForeignKey(
        CourseAssignment, on_delete=models.CASCADE, related_name="grades"
    )
    academic_period = models.ForeignKey(
        AcademicPeriod, on_delete=models.CASCADE, related_name="grades"
    )
    numerical_grade = models.DecimalField(max_digits=4, decimal_places=2)
    performance_level = models.ForeignKey(
        GradingScale,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="grades",
    )
    definitive_grade = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "Grade"
        verbose_name_plural = "Grades"
        unique_together = [["student", "course_assignment", "academic_period"]]

    def __str__(self):
        return f"{self.student.full_name} - {self.numerical_grade}"


class Attendance(TimeStampedModel):
    """Absences per subject and period."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="attendances"
    )
    course_assignment = models.ForeignKey(
        CourseAssignment, on_delete=models.CASCADE, related_name="attendances"
    )
    academic_period = models.ForeignKey(
        AcademicPeriod, on_delete=models.CASCADE, related_name="attendances"
    )
    unexcused_absences = models.PositiveIntegerField(default=0)
    excused_absences = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Attendance"
        verbose_name_plural = "Attendances"
        unique_together = [["student", "course_assignment", "academic_period"]]

    def __str__(self):
        return f"{self.student.full_name} - SE:{self.unexcused_absences} CE:{self.excused_absences}"


class AcademicIndicator(TimeStampedModel):
    """Qualitative achievement for a student in a subject/period, optionally from catalog."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="academic_indicators"
    )
    course_assignment = models.ForeignKey(
        CourseAssignment, on_delete=models.CASCADE, related_name="academic_indicators"
    )
    academic_period = models.ForeignKey(
        AcademicPeriod, on_delete=models.CASCADE, related_name="academic_indicators"
    )
    catalog = models.ForeignKey(
        AcademicIndicatorCatalog,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="student_indicators",
    )
    outcome = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ("below_basic", "Bajo (por debajo del umbral de Básico)"),
            ("basic_or_above", "Básico o superior"),
        ],
    )
    description = models.TextField()
    numerical_grade = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True
    )
    performance_level = models.CharField(max_length=50, blank=True)

    class Meta:
        verbose_name = "Academic Indicator"
        verbose_name_plural = "Academic Indicators"

    def __str__(self):
        return f"{self.student.full_name} - {self.description[:50]}..."


class PerformanceSummary(TimeStampedModel):
    """Student average and rank per period."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="performance_summaries"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="performance_summaries"
    )
    academic_period = models.ForeignKey(
        AcademicPeriod, on_delete=models.CASCADE, related_name="performance_summaries"
    )
    period_average = models.DecimalField(max_digits=4, decimal_places=2)
    rank = models.PositiveIntegerField(null=True, blank=True)
    definitive_average = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "Performance Summary"
        verbose_name_plural = "Performance Summaries"
        unique_together = [["student", "group", "academic_period"]]

    def __str__(self):
        return f"{self.student.full_name} - Avg: {self.period_average}"


class DisciplinaryReport(TimeStampedModel):
    """Qualitative disciplinary/behavior report."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="disciplinary_reports"
    )
    academic_period = models.ForeignKey(
        AcademicPeriod, on_delete=models.CASCADE, related_name="disciplinary_reports"
    )
    report_text = models.TextField(blank=True)
    created_by = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disciplinary_reports",
    )

    class Meta:
        verbose_name = "Disciplinary Report"
        verbose_name_plural = "Disciplinary Reports"
        unique_together = [["student", "academic_period"]]

    def __str__(self):
        return f"{self.student.full_name} - Period {self.academic_period.name}"


# --- Phase 5: Report models and RBAC ---


class SchoolRecord(TimeStampedModel):
    """Main School Assessment Record document."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="school_records"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="school_records"
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="school_records"
    )
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="school_records"
    )
    campus = models.ForeignKey(
        Campus, on_delete=models.CASCADE, related_name="school_records"
    )
    generated_at = models.DateTimeField()

    class Meta:
        verbose_name = "School Record"
        verbose_name_plural = "School Records"
        unique_together = [["student", "academic_year"]]

    def __str__(self):
        return f"{self.student.full_name} - {self.academic_year.year}"


class AcademicIndicatorsReport(TimeStampedModel):
    """Academic Indicators document with observations and signature."""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="academic_indicators_reports"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="academic_indicators_reports"
    )
    academic_period = models.ForeignKey(
        AcademicPeriod,
        on_delete=models.CASCADE,
        related_name="academic_indicators_reports",
    )
    grade_director = models.ForeignKey(
        Teacher, on_delete=models.CASCADE, related_name="academic_indicators_reports"
    )
    general_observations = models.TextField(blank=True)
    generated_at = models.DateTimeField()

    class Meta:
        verbose_name = "Academic Indicators Report"
        verbose_name_plural = "Academic Indicators Reports"
        unique_together = [["student", "academic_period"]]

    def __str__(self):
        return f"{self.student.full_name} - {self.academic_period.name}"


class UserProfile(TimeStampedModel):
    """Extended user profile for RBAC. Links User to role, teacher, parent, institution."""

    ROLE_CHOICES = [
        ("ADMIN", "Administrator"),
        ("COORDINATOR", "Coordinator"),
        ("TEACHER", "Teacher"),
        ("PARENT", "Parent"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="TEACHER")
    teacher = models.OneToOneField(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profile",
    )
    parent = models.OneToOneField(
        Parent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profile",
    )
    institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profiles",
    )

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"{self.user.username} ({self.role})"
