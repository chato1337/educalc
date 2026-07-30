"""Tests for the roll call (llamado a lista): consolidation, accumulation and scope."""
from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from .daily_attendance_service import consolidate_statuses
from .models import (
    AcademicArea,
    AcademicPeriod,
    AcademicYear,
    Attendance,
    Campus,
    CourseAssignment,
    DailyAttendance,
    Enrollment,
    GradeLevel,
    Group,
    Institution,
    Student,
    Subject,
    Teacher,
    UserProfile,
)

ROSTER_URL = "dailyattendance-roster"
SAVE_URL = "dailyattendance-save-roll-call-action"


class RollCallApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.teacher_user = User.objects.create_user(username="rc_teacher", password="x")
        self.other_teacher_user = User.objects.create_user(username="rc_other", password="x")

        self.inst = Institution.objects.create(name="IE Roll Call", dane_code="DANE995001")
        self.campus = Campus.objects.create(institution=self.inst, name="Sede RC")
        self.ay = AcademicYear.objects.create(institution=self.inst, year=2026)
        self.period = AcademicPeriod.objects.create(
            academic_year=self.ay,
            number=1,
            name="P1",
            start_date=date(2026, 1, 15),
            end_date=date(2026, 3, 31),
        )
        self.period_2 = AcademicPeriod.objects.create(
            academic_year=self.ay,
            number=2,
            name="P2",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 6, 30),
        )
        self.gl = GradeLevel.objects.create(institution=self.inst, name="SEXTO", level_order=6)
        self.group_a = Group.objects.create(
            grade_level=self.gl, academic_year=self.ay, campus=self.campus, name="601"
        )
        self.group_b = Group.objects.create(
            grade_level=self.gl, academic_year=self.ay, campus=self.campus, name="602"
        )
        self.area = AcademicArea.objects.create(institution=self.inst, name="Matemáticas")
        self.teacher = Teacher.objects.create(
            document_number="RCT1", first_name="Ana", first_last_name="RC", full_name="Ana RC"
        )
        self.other_teacher = Teacher.objects.create(
            document_number="RCT2",
            first_name="Otro",
            first_last_name="Doc",
            full_name="Otro Doc",
        )
        self.math = Subject.objects.create(
            academic_area=self.area, institution=self.inst, name="Matemáticas"
        )
        self.language = Subject.objects.create(
            academic_area=self.area, institution=self.inst, name="Lengua"
        )
        self.ca_math = CourseAssignment.objects.create(
            subject=self.math, teacher=self.teacher, group=self.group_a, academic_year=self.ay
        )
        self.ca_language = CourseAssignment.objects.create(
            subject=self.language,
            teacher=self.other_teacher,
            group=self.group_a,
            academic_year=self.ay,
        )
        self.ca_other_group = CourseAssignment.objects.create(
            subject=self.math,
            teacher=self.other_teacher,
            group=self.group_b,
            academic_year=self.ay,
        )
        self.student_a = Student.objects.create(
            document_number="RCS1",
            first_name="Ana",
            first_last_name="Uno",
            full_name="Ana Uno",
        )
        self.student_b = Student.objects.create(
            document_number="RCS2",
            first_name="Beto",
            first_last_name="Dos",
            full_name="Beto Dos",
        )
        self.student_outside = Student.objects.create(
            document_number="RCS3",
            first_name="Caro",
            first_last_name="Tres",
            full_name="Caro Tres",
        )
        for student in (self.student_a, self.student_b):
            Enrollment.objects.create(
                student=student, group=self.group_a, academic_year=self.ay, status="active"
            )
        Enrollment.objects.create(
            student=self.student_outside,
            group=self.group_b,
            academic_year=self.ay,
            status="active",
        )

        UserProfile.objects.filter(user=self.teacher_user).update(
            role="TEACHER", teacher_id=self.teacher.id, institution_id=self.inst.id
        )
        UserProfile.objects.filter(user=self.other_teacher_user).update(
            role="TEACHER", teacher_id=self.other_teacher.id, institution_id=self.inst.id
        )
        self.teacher_user = User.objects.select_related("profile").get(pk=self.teacher_user.pk)
        self.other_teacher_user = User.objects.select_related("profile").get(
            pk=self.other_teacher_user.pk
        )
        self.day = date(2026, 2, 10)
        self.client.force_authenticate(user=self.teacher_user)

    def _save(self, payload, user=None):
        if user is not None:
            self.client.force_authenticate(user=user)
        return self.client.post(reverse(SAVE_URL), payload, format="json")

    def _general_row(self, student, period=None):
        return Attendance.objects.filter(
            student=student,
            group=self.group_a,
            academic_period=period or self.period,
            course_assignment__isnull=True,
        ).first()

    # --- consolidation rule ------------------------------------------------

    def test_consolidation_precedence(self):
        self.assertEqual(consolidate_statuses(["PRESENT", "UNEXCUSED"]), "UNEXCUSED")
        self.assertEqual(consolidate_statuses(["UNEXCUSED", "EXCUSED"]), "EXCUSED")
        self.assertEqual(consolidate_statuses(["PRESENT", "EXCUSED", "UNEXCUSED"]), "EXCUSED")
        self.assertEqual(consolidate_statuses(["PRESENT"]), "PRESENT")
        self.assertIsNone(consolidate_statuses([]))

    # --- roster ------------------------------------------------------------

    def test_roster_lists_only_actively_enrolled_students(self):
        r = self.client.get(
            reverse(ROSTER_URL), {"group": str(self.group_a.id), "date": "2026-02-10"}
        )
        self.assertEqual(r.status_code, 200)
        names = [row["full_name"] for row in r.data["students"]]
        self.assertEqual(names, ["Ana Uno", "Beto Dos"])
        self.assertEqual(r.data["academic_period_name"], "P1")
        self.assertTrue(all(row["status"] is None for row in r.data["students"]))

    def test_roster_shows_own_marks_and_other_sources(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [
                    {"student": str(self.student_a.id), "status": "UNEXCUSED"},
                    {"student": str(self.student_b.id), "status": "PRESENT"},
                ],
            }
        )
        r = self.client.get(
            reverse(ROSTER_URL),
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "course_assignment": str(self.ca_math.id),
            },
        )
        self.assertEqual(r.status_code, 200)
        row = next(
            x for x in r.data["students"] if str(x["student"]) == str(self.student_a.id)
        )
        self.assertIsNone(row["status"])
        self.assertEqual(row["consolidated_status"], "UNEXCUSED")
        self.assertEqual(row["other_sources"], 1)

    # --- happy path + projection onto Attendance ---------------------------

    def test_general_roll_call_creates_rows_and_period_totals(self):
        r = self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [
                    {"student": str(self.student_a.id), "status": "UNEXCUSED"},
                    {
                        "student": str(self.student_b.id),
                        "status": "EXCUSED",
                        "notes": "Cita médica",
                    },
                ],
            }
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["created"], 2)
        self.assertEqual(r.data["updated"], 0)
        self.assertEqual(r.data["academic_period_name"], "P1")
        self.assertEqual(DailyAttendance.objects.count(), 2)

        self.assertEqual(self._general_row(self.student_a).unexcused_absences, 1)
        self.assertEqual(self._general_row(self.student_a).excused_absences, 0)
        self.assertEqual(self._general_row(self.student_b).excused_absences, 1)

    def test_present_students_do_not_get_absence_rows(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [
                    {"student": str(self.student_a.id), "status": "PRESENT"},
                    {"student": str(self.student_b.id), "status": "PRESENT"},
                ],
            }
        )
        self.assertIsNone(self._general_row(self.student_a))
        self.assertIsNone(self._general_row(self.student_b))

    def test_several_teachers_same_day_count_once(self):
        """General call plus two subject calls on the same date is still one absence."""
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "course_assignment": str(self.ca_math.id),
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "course_assignment": str(self.ca_language.id),
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            },
            user=self.other_teacher_user,
        )
        self.assertEqual(
            DailyAttendance.objects.filter(student=self.student_a, date=self.day).count(), 3
        )
        self.assertEqual(self._general_row(self.student_a).unexcused_absences, 1)

    def test_excuse_from_any_source_wins_over_unexcused(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "course_assignment": str(self.ca_math.id),
                "entries": [{"student": str(self.student_a.id), "status": "EXCUSED"}],
            }
        )
        row = self._general_row(self.student_a)
        self.assertEqual(row.unexcused_absences, 0)
        self.assertEqual(row.excused_absences, 1)

    def test_absence_wins_over_present_from_another_source(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "PRESENT"}],
            }
        )
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "course_assignment": str(self.ca_math.id),
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self.assertEqual(self._general_row(self.student_a).unexcused_absences, 1)

    def test_days_accumulate_within_the_period(self):
        for day in ("2026-02-10", "2026-02-11", "2026-02-12"):
            self._save(
                {
                    "group": str(self.group_a.id),
                    "date": day,
                    "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
                }
            )
        self.assertEqual(self._general_row(self.student_a).unexcused_absences, 3)

    def test_each_period_keeps_its_own_row(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-04-15",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self.assertEqual(self._general_row(self.student_a).unexcused_absences, 1)
        self.assertEqual(
            self._general_row(self.student_a, self.period_2).unexcused_absences, 1
        )

    def test_resaving_same_source_updates_and_recomputes(self):
        payload = {
            "group": str(self.group_a.id),
            "date": "2026-02-10",
            "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
        }
        self._save(payload)
        payload["entries"][0]["status"] = "PRESENT"
        r = self._save(payload)
        self.assertEqual(r.data["created"], 0)
        self.assertEqual(r.data["updated"], 1)
        self.assertEqual(
            DailyAttendance.objects.filter(student=self.student_a, date=self.day).count(), 1
        )
        self.assertIsNone(self._general_row(self.student_a))

    def test_subject_rows_are_not_touched_by_the_roll_call(self):
        manual = Attendance.objects.create(
            student=self.student_a,
            course_assignment=self.ca_math,
            academic_period=self.period,
            unexcused_absences=4,
            excused_absences=1,
        )
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        manual.refresh_from_db()
        self.assertEqual(manual.unexcused_absences, 4)
        self.assertEqual(manual.excused_absences, 1)
        self.assertEqual(manual.group_id, self.group_a.id)
        self.assertEqual(self._general_row(self.student_a).unexcused_absences, 1)

    # --- business rules ----------------------------------------------------

    def test_date_outside_every_period_is_rejected(self):
        r = self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-12-24",
                "entries": [{"student": str(self.student_a.id), "status": "PRESENT"}],
            }
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "period_not_found")

    def test_explicit_period_allows_dates_without_period_range(self):
        r = self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-12-24",
                "academic_period": str(self.period_2.id),
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            self._general_row(self.student_a, self.period_2).unexcused_absences, 1
        )

    def test_student_without_active_enrollment_is_rejected(self):
        r = self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_outside.id), "status": "PRESENT"}],
            }
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "student_not_enrolled")
        self.assertEqual(DailyAttendance.objects.count(), 0)

    def test_course_assignment_from_another_group_is_rejected(self):
        r = self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "course_assignment": str(self.ca_other_group.id),
                "entries": [{"student": str(self.student_a.id), "status": "PRESENT"}],
            }
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "assignment_not_in_group")

    def test_duplicated_student_in_payload_is_rejected(self):
        r = self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [
                    {"student": str(self.student_a.id), "status": "PRESENT"},
                    {"student": str(self.student_a.id), "status": "UNEXCUSED"},
                ],
            }
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "duplicated_student")

    # --- scope -------------------------------------------------------------

    def test_teacher_cannot_roll_call_a_group_they_do_not_teach(self):
        r = self._save(
            {
                "group": str(self.group_b.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_outside.id), "status": "PRESENT"}],
            }
        )
        self.assertEqual(r.status_code, 404)
        self.assertEqual(DailyAttendance.objects.count(), 0)

    def test_teacher_cannot_read_roster_of_a_group_they_do_not_teach(self):
        r = self.client.get(
            reverse(ROSTER_URL), {"group": str(self.group_b.id), "date": "2026-02-10"}
        )
        self.assertEqual(r.status_code, 404)

    def test_list_is_scoped_to_the_teacher_groups(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        DailyAttendance.objects.create(
            student=self.student_outside,
            group=self.group_b,
            academic_period=self.period,
            date=self.day,
            status="UNEXCUSED",
        )
        r = self.client.get(reverse("dailyattendance-list"))
        self.assertEqual(r.status_code, 200)
        students = {str(row["student"]) for row in r.data["results"]}
        self.assertEqual(students, {str(self.student_a.id)})

    def test_attendance_list_shows_general_rows_to_the_group_teacher(self):
        self._save(
            {
                "group": str(self.group_a.id),
                "date": "2026-02-10",
                "entries": [{"student": str(self.student_a.id), "status": "UNEXCUSED"}],
            }
        )
        r = self.client.get(reverse("attendance-list"))
        self.assertEqual(r.status_code, 200)
        general = [row for row in r.data["results"] if row["is_general"]]
        self.assertEqual(len(general), 1)
        self.assertEqual(general[0]["group_name"], "601")

        self.client.force_authenticate(user=self.other_teacher_user)
        r = self.client.get(reverse("attendance-list"))
        self.assertEqual(
            [row for row in r.data["results"] if row["is_general"]][0]["group_name"], "601"
        )
