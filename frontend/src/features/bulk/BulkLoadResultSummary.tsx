import { Paper, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { BulkLoadRowError, BulkLoadStats } from '@/api/bulkLoad'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'

function formatStatKey(key: string): string {
  return key.replace(/_/g, ' ')
}

function isRowError(x: unknown): x is BulkLoadRowError {
  return (
    typeof x === 'object' &&
    x !== null &&
    'row' in x &&
    'error' in x &&
    typeof (x as BulkLoadRowError).row === 'number' &&
    typeof (x as BulkLoadRowError).error === 'string'
  )
}

type ErrorRow = BulkLoadRowError & { id: string }

export function BulkLoadResultSummary({ data }: { data: BulkLoadStats }) {
  const { t } = useTranslation()
  const dataGridLocaleText = useMuiDataGridLocaleText()
  const rawErrors = data.errors
  const errors: BulkLoadRowError[] = Array.isArray(rawErrors)
    ? rawErrors.filter(isRowError)
    : []

  const errorRows = useMemo<ErrorRow[]>(
    () =>
      errors.slice(0, 100).map((e, i) => ({
        ...e,
        id: `${e.row}-${i}`,
      })),
    [errors],
  )

  const errorColumns = useMemo<GridColDef<ErrorRow>[]>(
    () => [
      {
        field: 'row',
        headerName: t('bulkLoadResultSummary.row'),
        width: 72,
        sortable: false,
      },
      {
        field: 'error',
        headerName: t('bulkLoadResultSummary.message'),
        flex: 1,
        minWidth: 200,
        sortable: false,
      },
    ],
    [t],
  )

  const statEntries = Object.entries(data).filter(([key, value]) => {
    if (key === 'errors') return false
    if (typeof value === 'number' && Number.isFinite(value)) return true
    if (typeof value === 'boolean') return true
    return false
  })

  return (
    <div className="flex flex-col gap-3">
      {statEntries.length > 0 ? (
        <Paper variant="outlined" className="p-3">
          <Typography variant="subtitle2" className="mb-2">
            {t('bulkLoadResultSummary.apiSummary')}
          </Typography>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 m-0 text-sm">
            {statEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt
                  className="capitalize"
                  style={{ color: 'var(--mui-palette-text-secondary)' }}
                >
                  {formatStatKey(key)}
                </dt>
                <dd className="m-0 font-medium tabular-nums">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Paper>
      ) : null}

      {errors.length > 0 ? (
        <Paper variant="outlined" className="p-0 overflow-hidden">
          <Typography variant="subtitle2" className="px-3 pt-3 pb-1">
            {t('bulkLoadResultSummary.rowErrors', { count: errors.length })}
          </Typography>
          <DataGrid
            rows={errorRows}
            columns={errorColumns}
            getRowId={(row) => row.id}
            autoHeight
            hideFooter
            disableRowSelectionOnClick
            disableColumnMenu
            localeText={dataGridLocaleText}
            sx={{
              ...dataGridDefaultSx,
              maxHeight: 280,
            }}
          />
          {errors.length > 100 ? (
            <Typography variant="caption" color="text.secondary" className="px-3 pb-2 block">
              {t('bulkLoadResultSummary.showingLimitedErrors', {
                count: errors.length,
              })}
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      <Paper variant="outlined" className="p-4 overflow-auto">
        <Typography variant="caption" color="text.secondary" className="block mb-2">
          {t('bulkLoadResultSummary.fullJson')}
        </Typography>
        <pre className="text-sm whitespace-pre-wrap break-words m-0">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Paper>
    </div>
  )
}
