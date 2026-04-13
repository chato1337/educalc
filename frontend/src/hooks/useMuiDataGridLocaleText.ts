import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { esES } from '@mui/x-data-grid/locales'

/** Textos del DataGrid en español (MUI) con vacío alineado a la app. */
export function useMuiDataGridLocaleText() {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      ...esES.components.MuiDataGrid.defaultProps.localeText,
      noRowsLabel: t('common.none'),
    }),
    [t],
  )
}

export const dataGridDefaultSx = {
  border: 'none',
  '& .MuiDataGrid-columnHeaders': {
    bgcolor: 'action.hover',
  },
} as const
