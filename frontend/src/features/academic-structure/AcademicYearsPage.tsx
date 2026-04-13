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
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import type { Resolver } from 'react-hook-form'
import { Controller, useForm } from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { PageHeader } from '@/components/PageHeader'
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicYear, Institution } from '@/types/schemas'

const schema = z.object({
  institution: z.string().uuid('Selecciona una institución'),
  year: z.coerce.number().int().min(1900).max(2100),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  institution: '',
  year: new Date().getFullYear(),
  start_date: '',
  end_date: '',
  is_active: true,
}

export function AcademicYearsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId, search: appliedSearch || undefined }
      : { search: appliedSearch || undefined }

  const listQuery = useInfiniteList<AcademicYear>({
    queryKey: [
      'academic-years',
      'list',
      { institution: selectedInstitutionId, search: appliedSearch },
    ],
    url: '/api/academic-years/',
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
      apiClient.post<AcademicYear>('/api/academic-years/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
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
    }) => apiClient.patch<AcademicYear>(`/api/academic-years/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/academic-years/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    return {
      institution: values.institution,
      year: values.year,
      start_date: values.start_date?.trim() || undefined,
      end_date: values.end_date?.trim() || undefined,
      is_active: values.is_active,
    }
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      ...defaults,
      institution: selectedInstitutionId ?? '',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: AcademicYear) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        institution: row.institution,
        year: row.year,
        start_date: row.start_date?.slice(0, 10) ?? '',
        end_date: row.end_date?.slice(0, 10) ?? '',
        is_active: row.is_active ?? true,
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<AcademicYear>[]>(
    () => [
      {
        field: 'year',
        headerName: t('academicYears.year'),
        width: 100,
        sortable: false,
      },
      {
        field: 'institution_name',
        headerName: t('academicYears.institution'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'is_active',
        headerName: t('academicYears.active'),
        width: 100,
        sortable: false,
        valueFormatter: (value: boolean | null | undefined) =>
          value ? t('academicYears.yes') : t('academicYears.no'),
      },
      {
        field: 'date_range',
        headerName: t('academicYears.dateRange'),
        flex: 1,
        minWidth: 180,
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
        getActions: (params: GridRenderCellParams<AcademicYear>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('academicYears.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('academicYears.delete')}
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

  return (
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('academicYears.title')}
          subtitle={t('academicYears.subtitle')}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('academicYears.new')}
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
        />
        <Button
          variant="outlined"
          startIcon={<SearchIcon />}
          onClick={() => setAppliedSearch(searchInput)}
        >
          {t('common.apply')}
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
          {editing ? t('academicYears.editDialog') : t('academicYears.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="institution"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={institutions}
                  getOptionLabel={(o: Institution) => o.name}
                  value={
                    institutions.find((i) => i.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicYears.institution')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('academicYears.yearNumber')}
              type="number"
              {...form.register('year', { valueAsNumber: true })}
              error={!!form.formState.errors.year}
              helperText={form.formState.errors.year?.message}
              required
              fullWidth
              disabled={!!editing}
            />
            <TextField
              label={t('academicYears.start')}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('start_date')}
              fullWidth
            />
            <TextField
              label={t('academicYears.end')}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('end_date')}
              fullWidth
            />
            <Controller
              name="is_active"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(_, c) => field.onChange(c)}
                    />
                  }
                  label={t('academicYears.activeYear')}
                />
              )}
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
        <DialogTitle>{t('academicYears.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('academicYears.deletePrompt', {
            year: deleteTarget?.year ?? '',
            institution: deleteTarget?.institution_name ?? '',
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
