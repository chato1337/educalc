import { fetchReferenceListResults } from '@/api/list'
import type {
  AcademicPeriod,
  AcademicYear,
  GradeDirector,
  GradingScale,
} from '@/types/schemas'

export async function fetchAcademicYears(
  institutionId?: string | null,
): Promise<AcademicYear[]> {
  return fetchReferenceListResults<AcademicYear>('/api/academic-years/', {
    params: institutionId ? { institution: institutionId } : undefined,
  })
}

export async function fetchAcademicPeriods(
  academicYearId: string,
): Promise<AcademicPeriod[]> {
  return fetchReferenceListResults<AcademicPeriod>('/api/academic-periods/', {
    params: { academic_year: academicYearId, ordering: 'number' },
  })
}

export async function fetchGradingScales(
  institutionId?: string | null,
): Promise<GradingScale[]> {
  return fetchReferenceListResults<GradingScale>('/api/grading-scales/', {
    params: institutionId ? { institution: institutionId } : undefined,
  })
}

export async function fetchGradeDirectorsForTeacher(
  teacherId: string,
): Promise<GradeDirector[]> {
  return fetchReferenceListResults<GradeDirector>('/api/grade-directors/', {
    params: { teacher: teacherId },
  })
}
