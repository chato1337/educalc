import AddIcon from '@mui/icons-material/Add'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridSortModel,
} from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { getErrorMessage } from '@/api/errors'
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
import { createServerSortHandlers } from '@/lib/dataGridServerSort'
import type { Student } from '@/types/schemas'

const studentSortHandlers = createServerSortHandlers({
  full_name: 'full_name',
  document_number: 'document_number',
})

export function StudentsPage() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('')
  const [documentNumberFilter, setDocumentNumberFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [sisbenFilter, setSisbenFilter] = useState('')
  const [stratumFilter, setStratumFilter] = useState('')
  const [ordering, setOrdering] = useState('')

  const params = {
    search: appliedSearch.trim() || undefined,
    document_type: documentTypeFilter.trim() || undefined,
    document_number: documentNumberFilter.trim() || undefined,
    gender: genderFilter.trim() || undefined,
    sisben: sisbenFilter.trim() || undefined,
    stratum: stratumFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<Student>({
    queryKey: ['students', 'list'],
    url: '/api/students/',
    params,
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const sortModel = useMemo(
    () => studentSortHandlers.orderingToSortModel(ordering),
    [ordering],
  )
  const dataGridLocaleText = useMuiDataGridLocaleText()
  const handleSortModelChange = useCallback((model: GridSortModel) => {
    setOrdering(studentSortHandlers.sortModelToOrdering(model))
  }, [])

  const columns = useMemo<GridColDef<Student>[]>(
    () => [
      {
        field: 'full_name',
        headerName: t('students.name'),
        flex: 1,
        minWidth: 200,
        sortable: true,
      },
      {
        field: 'document_number',
        headerName: t('students.document'),
        width: 160,
        sortable: true,
      },
      {
        field: 'document_type',
        headerName: t('students.documentType'),
        width: 120,
        sortable: false,
      },
      {
        field: 'actions',
        headerName: t('common.actions'),
        minWidth: 240,
        sortable: false,
        renderCell: (params) => (
          <Box
            sx={{
              display: 'inline-flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 0.5,
              typography: 'body2',
            }}
          >
            <Link
              to={`/students/${params.row.id}`}
              className="text-blue-600 underline"
            >
              {t('common.view')}
            </Link>
            <span>·</span>
            <Link
              to={`/students/${params.row.id}/grades-summary`}
              className="text-blue-600 underline"
            >
              {t('students.gradesSummary')}
            </Link>
          </Box>
        ),
      },
    ],
    [t],
  )

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('students.title')}
          subtitle={
            <>
              {`${t('students.detailPrefix')} `}
              <Link
                to="/students/bulk-load"
                className="text-blue-600 underline"
              >
                {t('students.bulkLoadCsv')}
              </Link>
              .
            </>
          }
        />
        <Button
          variant="contained"
          component={Link}
          to="/students/new"
          startIcon={<AddIcon />}
        >
          {t('students.newStudent')}
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-center">
        <TextField
          size="small"
          label={t('common.search')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setAppliedSearch(searchInput)
          }}
          slotProps={{
            input: { 'aria-label': t('students.searchAria') },
          }}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={() => setAppliedSearch(searchInput)}
        >
          {t('common.apply')}
        </Button>
        <TextField
          size="small"
          label={t('students.documentTypeExact')}
          value={documentTypeFilter}
          onChange={(e) => setDocumentTypeFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.documentNumberExact')}
          value={documentNumberFilter}
          onChange={(e) => setDocumentNumberFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.genderExact')}
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.sisbenExact')}
          value={sisbenFilter}
          onChange={(e) => setSisbenFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.stratumExact')}
          value={stratumFilter}
          onChange={(e) => setStratumFilter(e.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('students.order')}</InputLabel>
          <Select
            label={t('students.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('students.defaultOrder')}</MenuItem>
            <MenuItem value="full_name">{t('students.nameAsc')}</MenuItem>
            <MenuItem value="-full_name">{t('students.nameDesc')}</MenuItem>
            <MenuItem value="document_number">{t('students.documentAsc')}</MenuItem>
            <MenuItem value="-document_number">{t('students.documentDesc')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setDocumentTypeFilter('')
            setDocumentNumberFilter('')
            setGenderFilter('')
            setSisbenFilter('')
            setStratumFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('students.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <Paper sx={{ width: '100%', p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          sortingOrder={['asc', 'desc', null]}
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !isLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />
    </Box>
  )
}
