import HowToRegIcon from '@mui/icons-material/HowToReg'
import SearchIcon from '@mui/icons-material/Search'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Paper,
  TextField,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import { PageHeader } from '@/components/PageHeader'
import {
  useAcademicYearsQuery,
  useCampusesForInstitution,
  useGradeLevelsQuery,
} from '@/features/academic-structure/academicQueries'
import { RollCallDialog } from '@/features/operations/rollCall/RollCallDialog'
import type { RollCallSaveResponse } from '@/features/operations/rollCall/rollCallApi'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicYear, Campus, GradeLevel, Group } from '@/types/schemas'

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function RollCallPage() {
  const { t } = useTranslation()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [date, setDate] = useState(today)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterCampusId, setFilterCampusId] = useState<string | null>(null)
  const [filterGradeLevelId, setFilterGradeLevelId] = useState<string | null>(
    null,
  )
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [lastResult, setLastResult] = useState<RollCallSaveResponse | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: campuses = [] } = useCampusesForInstitution(
    selectedInstitutionId,
  )
  const { data: gradeLevels = [] } = useGradeLevelsQuery(selectedInstitutionId)

  /** Falls back to the active year until the user picks one explicitly. */
  const effectiveYearId =
    filterYearId ??
    (academicYears.find((y) => y.is_active) ?? academicYears[0])?.id ??
    null

  const listParams = {
    academic_year: effectiveYearId ?? undefined,
    campus: filterCampusId ?? undefined,
    grade_level: filterGradeLevelId ?? undefined,
    search: appliedSearch || undefined,
  }

  const listQuery = useInfiniteList<Group>({
    queryKey: [
      'groups',
      'list',
      { institution: selectedInstitutionId, ...listParams },
    ],
    url: '/api/groups/',
    params: listParams,
    enabled: Boolean(selectedInstitutionId),
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const dataGridLocaleText = useMuiDataGridLocaleText()

  const columns = useMemo<GridColDef<Group>[]>(
    () => [
      {
        field: 'name',
        headerName: t('rollCall.group'),
        flex: 0.5,
        minWidth: 90,
        sortable: false,
      },
      {
        field: 'grade_level_name',
        headerName: t('rollCall.level'),
        flex: 0.6,
        minWidth: 110,
        sortable: false,
      },
      {
        field: 'campus_name',
        headerName: t('rollCall.campus'),
        flex: 1.5,
        minWidth: 200,
        sortable: false,
      },
      {
        field: 'academic_year_year',
        headerName: t('rollCall.year'),
        width: 100,
        sortable: false,
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 180,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<Group>) => [
          <Button
            key="call"
            size="small"
            variant="outlined"
            startIcon={<HowToRegIcon fontSize="small" />}
            onClick={() => setActiveGroup(params.row)}
            disabled={!date}
          >
            {t('rollCall.callAction')}
          </Button>,
        ],
      },
    ],
    [date, t],
  )

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('rollCall.title')}
        subtitle={t('rollCall.subtitle')}
      />

      {!selectedInstitutionId ? (
        <Alert severity="info">{t('rollCall.selectInstitution')}</Alert>
      ) : null}

      {lastResult ? (
        <Alert severity="success" onClose={() => setLastResult(null)}>
          {t('rollCall.saved', {
            group: lastResult.group_name,
            period: lastResult.academic_period_name,
            students: lastResult.students_processed,
            excused: lastResult.excused_count,
            unexcused: lastResult.unexcused_count,
          })}
        </Alert>
      ) : null}

      <Paper className="p-3 flex flex-col gap-3">
        <Box className="flex flex-wrap gap-2 items-end">
          <TextField
            size="small"
            type="date"
            label={t('rollCall.date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />
          <Autocomplete
            className="min-w-[180px] flex-1"
            size="small"
            options={academicYears}
            getOptionLabel={(y: AcademicYear) => String(y.year)}
            value={academicYears.find((y) => y.id === effectiveYearId) ?? null}
            onChange={(_, v) => setFilterYearId(v?.id ?? null)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('rollCall.year')} />
            )}
          />
          <Autocomplete
            className="min-w-[180px] flex-1"
            size="small"
            options={campuses}
            getOptionLabel={(c: Campus) => c.name}
            value={campuses.find((c) => c.id === filterCampusId) ?? null}
            onChange={(_, v) => setFilterCampusId(v?.id ?? null)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('rollCall.campus')} />
            )}
          />
          <Autocomplete
            className="min-w-[180px] flex-1"
            size="small"
            options={gradeLevels}
            getOptionLabel={(g: GradeLevel) => g.name}
            value={
              gradeLevels.find((g) => g.id === filterGradeLevelId) ?? null
            }
            onChange={(_, v) => setFilterGradeLevelId(v?.id ?? null)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('rollCall.level')} />
            )}
          />
        </Box>
        <Box className="flex flex-wrap gap-2 items-center">
          <TextField
            size="small"
            label={t('common.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(searchInput)
            }}
          />
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => setAppliedSearch(searchInput)}
          >
            {t('common.apply')}
          </Button>
        </Box>
      </Paper>

      {listQuery.error ? (
        <Alert severity="error">{getErrorMessage(listQuery.error)}</Alert>
      ) : null}

      <Paper sx={{ width: '100%', p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={listQuery.isLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !listQuery.isLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />

      {activeGroup ? (
        <RollCallDialog
          key={`${activeGroup.id}:${date}`}
          group={activeGroup}
          date={date}
          onClose={() => setActiveGroup(null)}
          onSaved={setLastResult}
        />
      ) : null}
    </Box>
  )
}
