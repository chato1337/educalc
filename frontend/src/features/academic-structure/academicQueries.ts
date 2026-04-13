import { useQuery } from '@tanstack/react-query'

import { fetchReferenceListResults } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type {
  AcademicArea,
  AcademicYear,
  Campus,
  GradeLevel,
  Institution,
} from '@/types/schemas'

export function useInstitutionsReference() {
  return useQuery({
    queryKey: queryKeys.institutions(),
    queryFn: async () => fetchReferenceListResults<Institution>('/api/institutions/'),
  })
}

export function useAcademicYearsQuery(institutionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.academicYears(institutionId ?? null),
    queryFn: async () => {
      const params =
        institutionId != null && institutionId !== ''
          ? { institution: institutionId }
          : undefined
      return fetchReferenceListResults<AcademicYear>('/api/academic-years/', {
        params,
      })
    },
  })
}

export function useCampusesForInstitution(institutionId: string | null) {
  return useQuery({
    queryKey: queryKeys.campuses(institutionId, undefined),
    queryFn: async () => {
      const params =
        institutionId != null ? { institution: institutionId } : undefined
      return fetchReferenceListResults<Campus>('/api/campuses/', { params })
    },
    enabled: institutionId != null && institutionId !== '',
  })
}

export function useGradeLevelsQuery(institutionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.gradeLevels(institutionId ?? null),
    queryFn: async () => {
      const params =
        institutionId != null && institutionId !== ''
          ? { institution: institutionId }
          : undefined
      return fetchReferenceListResults<GradeLevel>('/api/grade-levels/', {
        params,
      })
    },
  })
}

export function useAcademicAreasQuery(institutionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.academicAreas(institutionId ?? null),
    queryFn: async () => {
      const params =
        institutionId != null && institutionId !== ''
          ? { institution: institutionId }
          : undefined
      return fetchReferenceListResults<AcademicArea>('/api/academic-areas/', {
        params,
      })
    },
  })
}
