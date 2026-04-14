import { useQuery } from '@tanstack/react-query'

import { fetchReferenceListResults } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type {
  AcademicArea,
  AcademicIndicatorCatalog,
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

/** Plantillas de logros por área y grado (misma institución en ambos filtros). */
export function useAcademicIndicatorCatalogsQuery(
  institutionId: string | null | undefined,
  search?: string,
) {
  return useQuery({
    queryKey: queryKeys.academicIndicatorCatalogs({
      institution: institutionId ?? '',
      search: search ?? '',
    }),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (institutionId != null && institutionId !== '') {
        params.academic_area__institution = institutionId
        params.grade_level__institution = institutionId
      }
      if (search) params.search = search
      return fetchReferenceListResults<AcademicIndicatorCatalog>(
        '/api/academic-indicator-catalogs/',
        { params },
      )
    },
    enabled: institutionId != null && institutionId !== '',
  })
}
