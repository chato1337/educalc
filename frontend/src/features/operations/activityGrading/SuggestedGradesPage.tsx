import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import { Alert, Autocomplete, Box, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { queryKeys } from '@/api/queryKeys'
import { GradingSchemeBreakdownPanel } from '@/features/operations/GradingSchemeBreakdownPanel'
import type { GradingScheme } from '@/features/operations/gradingApi'
import { useUiStore } from '@/stores/uiStore'

export function SuggestedGradesPage() {
  const { t } = useTranslation()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [selectedScheme, setSelectedScheme] = useState<GradingScheme | null>(
    null,
  )

  const listQuery = useInfiniteList<GradingScheme>({
    queryKey: queryKeys.gradingSchemes({ is_active: 'true' }),
    url: '/api/grading-schemes/',
    params: { is_active: 'true' },
  })
  const schemes = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )

  return (
    <Box className="flex flex-col gap-4">
      <Typography variant="h6">{t('activityGrading.suggestedGradesTitle')}</Typography>

      {!selectedInstitutionId ? (
        <Alert severity="info">{t('gradingSchemes.selectInstitution')}</Alert>
      ) : null}

      <Autocomplete
        options={schemes}
        loading={listQuery.isLoading}
        getOptionKey={(s: GradingScheme) => s.id}
        getOptionLabel={(s: GradingScheme) =>
          `${s.course_assignment_subject_name} — ${s.course_assignment_group_name} · ${s.academic_period_name}`
        }
        value={selectedScheme}
        onChange={(_, v) => setSelectedScheme(v)}
        renderInput={(params: AutocompleteRenderInputParams) => (
          <TextField
            {...params}
            label={t('activityGrading.schemeFilter')}
            required
          />
        )}
      />

      {selectedScheme ? (
        <GradingSchemeBreakdownPanel scheme={selectedScheme} />
      ) : (
        <Alert severity="info">{t('activityGrading.selectSchemeHint')}</Alert>
      )}
    </Box>
  )
}
