import SearchIcon from '@mui/icons-material/Search'
import { Alert, Box, Button, Paper, TextField } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  flatInfinitePages,
  useInfiniteList,
} from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import { PageHeader } from '@/components/PageHeader'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { useUiStore } from '@/stores/uiStore'

import type { ResourceListConfig } from '@/features/admin/resourceConfig'

function pickColumns(rows: Record<string, unknown>[], max = 8): string[] {
  const seen = new Set<string>()
  for (const row of rows.slice(0, 50)) {
    for (const k of Object.keys(row)) {
      if (k === 'password') continue
      seen.add(k)
    }
  }
  return [...seen].slice(0, max)
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

type Props = { config: ResourceListConfig }

export function GenericListPage({ config }: Props) {
  const { t } = useTranslation()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (config.institutionParam && selectedInstitutionId) {
      p.institution = selectedInstitutionId
    }
    if (config.search && appliedSearch.trim()) {
      p.search = appliedSearch.trim()
    }
    return p
  }, [
    appliedSearch,
    config.institutionParam,
    config.search,
    selectedInstitutionId,
  ])

  const listEnabled = !config.institutionParam || !!selectedInstitutionId

  const listQuery = useInfiniteList<Record<string, unknown>>({
    queryKey: queryKeys.resourceList(config.path, params),
    url: config.apiPath,
    params,
    enabled: listEnabled,
  })
  const data = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const columnKeys = useMemo(
    () => (data?.length ? pickColumns(data) : []),
    [data],
  )

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const columnDefs = useMemo<GridColDef<Record<string, unknown>>[]>(
    () =>
      columnKeys.map((field) => ({
        field,
        headerName: field,
        flex: 1,
        minWidth: 120,
        sortable: false,
        valueGetter: (_v, row) => row[field],
        valueFormatter: (value: unknown) => formatCell(value),
      })),
    [columnKeys],
  )

  const gridRows = useMemo(
    () =>
      data.map((row, i) => ({
        ...row,
        __gridRowId: String(row.id ?? i),
      })),
    [data],
  )

  return (
    <Box className="flex flex-col gap-4 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
      <PageHeader title={config.title} />

      {config.institutionParam && !selectedInstitutionId ? (
        <Alert severity="info">
          {t('genericList.selectInstitution')}
        </Alert>
      ) : null}

      {config.search ? (
        <Paper className="p-3 flex flex-wrap gap-2 items-center">
          <TextField
            size="small"
            label={t('common.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(searchInput)
            }}
            slotProps={{ input: { 'aria-label': t('genericList.searchAria') } }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => setAppliedSearch(searchInput)}
          >
            {t('common.apply')}
          </Button>
        </Paper>
      ) : null}

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

      {listEnabled ? (
        <>
          <Paper sx={{ width: '100%', p: 0, overflow: 'hidden' }}>
            <DataGrid
              rows={gridRows}
              columns={columnDefs}
              getRowId={(row) => String(row.__gridRowId)}
              loading={isLoading}
              autoHeight
              hideFooter
              disableRowSelectionOnClick
              disableColumnMenu
              localeText={dataGridLocaleText}
              sx={dataGridDefaultSx}
            />
          </Paper>
          <InfiniteDataGridFooter
            show={data.length > 0 && !isLoading}
            isFetchingNextPage={listQuery.isFetchingNextPage}
            hasNextPage={listQuery.hasNextPage ?? false}
            onLoadMore={() => void listQuery.fetchNextPage()}
          />
        </>
      ) : null}
    </Box>
  )
}
