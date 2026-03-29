import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
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
    queryFn: async () => {
      const { data } = await apiClient.get<Institution[]>('/api/institutions/')
      return data
    },
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
      const { data } = await apiClient.get<AcademicYear[]>(
        '/api/academic-years/',
        { params },
      )
      return data
    },
  })
}

export function useCampusesForInstitution(institutionId: string | null) {
  return useQuery({
    queryKey: queryKeys.campuses(institutionId, undefined),
    queryFn: async () => {
      const params =
        institutionId != null ? { institution: institutionId } : undefined
      const { data } = await apiClient.get<Campus[]>('/api/campuses/', {
        params,
      })
      return data
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
      const { data } = await apiClient.get<GradeLevel[]>(
        '/api/grade-levels/',
        { params },
      )
      return data
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
      const { data } = await apiClient.get<AcademicArea[]>(
        '/api/academic-areas/',
        { params },
      )
      return data
    },
  })
}
