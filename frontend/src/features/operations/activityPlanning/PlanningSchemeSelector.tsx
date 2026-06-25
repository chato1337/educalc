import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import { Alert, Autocomplete, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  type GradingScheme,
  formatGradingSchemeOptionLabel,
} from '@/features/operations/gradingApi'

export type PlanningSchemeSelectorProps = {
  schemes: GradingScheme[]
  loading?: boolean
  value: GradingScheme | null
  onChange: (scheme: GradingScheme | null) => void
  institutionSelected: boolean
}

export function PlanningSchemeSelector({
  schemes,
  loading,
  value,
  onChange,
  institutionSelected,
}: PlanningSchemeSelectorProps) {
  const { t } = useTranslation()

  return (
    <>
      {!institutionSelected ? (
        <Alert severity="info">{t('gradingSchemes.selectInstitution')}</Alert>
      ) : null}

      <Autocomplete
        options={schemes}
        loading={loading}
        getOptionKey={(s: GradingScheme) => s.id}
        getOptionLabel={formatGradingSchemeOptionLabel}
        value={value}
        onChange={(_, next) => onChange(next)}
        renderInput={(params: AutocompleteRenderInputParams) => (
          <TextField
            {...params}
            label={t('activityPlanning.schemeFilter')}
            required
          />
        )}
      />
    </>
  )
}
