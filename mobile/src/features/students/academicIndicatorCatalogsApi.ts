import { useQuery } from '@tanstack/react-query'

import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type { AcademicIndicatorCatalog } from '@/types/schemas'

export type { AcademicIndicatorCatalog }

export type CatalogListParams = {
  academic_area?: string
  grade_level?: string
  period_number?: string
  academic_area__institution?: string
}

export async function fetchAcademicIndicatorCatalogs(
  params: CatalogListParams = {},
): Promise<AcademicIndicatorCatalog[]> {
  return fetchAllPages<AcademicIndicatorCatalog>(
    '/api/academic-indicator-catalogs/',
    {
      academic_area: params.academic_area,
      grade_level: params.grade_level,
      period_number: params.period_number,
      academic_area__institution: params.academic_area__institution,
    },
  )
}

export function useAcademicIndicatorCatalogsQuery(params: CatalogListParams | null) {
  return useQuery({
    queryKey: queryKeys.academicIndicatorCatalogs({
      academic_area: params?.academic_area,
      grade_level: params?.grade_level,
      period_number: params?.period_number,
      academic_area__institution: params?.academic_area__institution,
    }),
    queryFn: () => fetchAcademicIndicatorCatalogs(params ?? {}),
    enabled: Boolean(
      params &&
        (params.academic_area ||
          params.grade_level ||
          params.academic_area__institution),
    ),
  })
}
