import type { Course } from '@/data'
import type { CourseAssignment, GradeDirector } from '@/types/schemas'

export function directorGroupIds(directors: GradeDirector[]): Set<string> {
  return new Set(directors.map((d) => d.group))
}

export function assignmentToCourse(
  assignment: CourseAssignment,
  directorGroups: Set<string>,
): Course {
  return {
    id: assignment.id,
    subject_name: assignment.subject_name,
    emphasis: null,
    group_name: assignment.group_name,
    group_grade_level_name: assignment.group_grade_level_name,
    campus_name: assignment.campus_name,
    academic_year_year: assignment.academic_year_year,
    isDirectorGroup: directorGroups.has(assignment.group),
    groupId: assignment.group,
    subjectId: assignment.subject,
    subjectAcademicAreaId: assignment.subject_academic_area,
    groupGradeLevelId: assignment.group_grade_level,
  }
}

export function assignmentsToCourses(
  assignments: CourseAssignment[],
  directors: GradeDirector[],
): Course[] {
  const groups = directorGroupIds(directors)
  return assignments.map((a) => assignmentToCourse(a, groups))
}
