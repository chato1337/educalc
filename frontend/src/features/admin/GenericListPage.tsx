import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
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

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: queryKeys.resourceList(config.path, params),
    queryFn: async () => {
      const { data: rows } = await apiClient.get<Record<string, unknown>[]>(
        config.apiPath,
        { params },
      )
      return rows
    },
  })

  const columns = useMemo(
    () => (data?.length ? pickColumns(data) : []),
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

      {isLoading ? (
        <Box className="flex justify-center py-12">
          <CircularProgress />
        </Box>
      ) : null}

      {!isLoading && data && data.length === 0 ? (
        <Typography color="text.secondary">{t('common.none')}</Typography>
      ) : null}

      {!isLoading && data && data.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col}>{col}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={(row.id as string) ?? i}>
                  {columns.map((col) => (
                    <TableCell key={col}>{formatCell(row[col])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {isFetching && !isLoading ? (
        <Typography variant="caption" color="text.secondary">
          {t('genericList.updating')}
        </Typography>
      ) : null}
    </Box>
  )
}
