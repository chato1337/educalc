import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SearchIcon from '@mui/icons-material/Search'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Resolver } from 'react-hook-form'
import { Controller, useForm } from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import {
  flatInfinitePages,
  useInfiniteList,
} from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicPeriod, AcademicYear } from '@/types/schemas'

const schema = z.object({
  academic_year: z.string().uuid('Selecciona un año lectivo'),
  number: z.coerce.number().int().min(0),
  name: z.string().trim().min(1).max(20),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  academic_year: '',
  number: 1,
  name: '',
  start_date: '',
  end_date: '',
}

function yearLabel(y: AcademicYear) {
  return `${y.year} — ${y.institution_name}`
}

export function AcademicPeriodsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicPeriod | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicPeriod | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )

  const yearOptions = useMemo(() => academicYears, [academicYears])

  const listParams = {
    academic_year: filterYearId ?? undefined,
    search: appliedSearch || undefined,
  }

  const listQuery = useInfiniteList<AcademicPeriod>({
    queryKey: [
      'academic-periods',
      'list',
      { filterYearId, search: appliedSearch },
    ],
    url: '/api/academic-periods/',
    params: listParams,
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicPeriod>('/api/academic-periods/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-periods'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Record<string, unknown>
    }) => apiClient.patch<AcademicPeriod>(`/api/academic-periods/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-periods'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/academic-periods/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-periods'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    return {
      academic_year: values.academic_year,
      number: values.number,
      name: values.name,
      start_date: values.start_date?.trim() || undefined,
      end_date: values.end_date?.trim() || undefined,
    }
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    const firstYear = yearOptions[0]?.id ?? ''
    form.reset({
      ...defaults,
      academic_year: firstYear,
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: AcademicPeriod) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        academic_year: row.academic_year,
        number: row.number,
        name: row.name,
        start_date: row.start_date?.slice(0, 10) ?? '',
        end_date: row.end_date?.slice(0, 10) ?? '',
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<AcademicPeriod>[]>(
    () => [
      {
        field: 'name',
        headerName: t('academicPeriods.name'),
        flex: 1,
        minWidth: 120,
        sortable: false,
      },
      {
        field: 'number',
        headerName: t('academicPeriods.numberShort'),
        width: 90,
        sortable: false,
      },
      {
        field: 'academic_year_year',
        headerName: t('academicPeriods.academicYear'),
        flex: 0.8,
        minWidth: 100,
        sortable: false,
      },
      {
        field: 'dates',
        headerName: t('academicPeriods.dates'),
        flex: 1,
        minWidth: 160,
        sortable: false,
        valueGetter: (_v, row) =>
          [row.start_date, row.end_date].filter(Boolean).join(' → ') || '-',
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<AcademicPeriod>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('academicPeriods.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('academicPeriods.delete')}
            onClick={() => setDeleteTarget(params.row)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>,
        ],
      },
    ],
    [openEdit, t],
  )

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setFormError(null)
    form.reset(defaults)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const body = toPayload(values)
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  const filterYear =
    yearOptions.find((y) => y.id === filterYearId) ?? null

  return (
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('academicPeriods.title')}
          subtitle={t('academicPeriods.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={yearOptions.length === 0}
        >
          {t('academicPeriods.new')}
        </Button>
      </Box>

      {yearOptions.length === 0 ? (
        <Alert severity="info">
          {t('academicPeriods.noYears')}
        </Alert>
      ) : null}

      <Paper className="p-3 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <Autocomplete
          className="min-w-[240px] flex-1"
          options={yearOptions}
          getOptionLabel={yearLabel}
          value={filterYear}
          onChange={(_, v) => setFilterYearId(v?.id ?? null)}
          renderInput={(params: AutocompleteRenderInputParams) => (
            <TextField {...params} label={t('academicPeriods.filterByYear')} size="small" />
          )}
          isOptionEqualToValue={(a, b) => a.id === b.id}
        />
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
          {t('academicPeriods.applySearch')}
        </Button>
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

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('academicPeriods.editDialog') : t('academicPeriods.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={yearOptions}
                  getOptionLabel={yearLabel}
                  value={
                    yearOptions.find((y) => y.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicPeriods.academicYear')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('academicPeriods.periodNumber')}
              type="number"
              {...form.register('number', { valueAsNumber: true })}
              error={!!form.formState.errors.number}
              helperText={form.formState.errors.number?.message}
              required
              fullWidth
            />
            <TextField
              label={t('academicPeriods.nameExample')}
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              required
              fullWidth
            />
            <TextField
              label={t('academicPeriods.start')}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('start_date')}
              fullWidth
            />
            <TextField
              label={t('academicPeriods.end')}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('end_date')}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {t('common.save')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>{t('academicPeriods.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('academicPeriods.deletePrompt', {
            name: deleteTarget?.name ?? '',
            year: deleteTarget?.academic_year_year ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteTarget && deleteMutation.mutate(deleteTarget.id)
            }
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
