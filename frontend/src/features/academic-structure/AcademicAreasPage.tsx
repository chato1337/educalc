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
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicArea, Institution } from '@/types/schemas'

const schema = z.object({
  institution: z.string().uuid('Selecciona una institución'),
  name: z.string().trim().min(1).max(255),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  institution: '',
  name: '',
  code: '',
  description: '',
}

export function AcademicAreasPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicArea | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicArea | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId, search: appliedSearch || undefined }
      : { search: appliedSearch || undefined }

  const listQuery = useInfiniteList<AcademicArea>({
    queryKey: [
      'academic-areas',
      'list',
      { institution: selectedInstitutionId, search: appliedSearch },
    ],
    url: '/api/academic-areas/',
    params: listParams,
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicArea>('/api/academic-areas/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-areas'] })
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
    }) => apiClient.patch<AcademicArea>(`/api/academic-areas/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-areas'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/academic-areas/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-areas'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    return {
      institution: values.institution,
      name: values.name,
      code: values.code?.trim() || undefined,
      description: values.description?.trim() || undefined,
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
    (row: AcademicArea) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        institution: row.institution,
        name: row.name,
        code: row.code ?? '',
        description: row.description ?? '',
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<AcademicArea>[]>(
    () => [
      {
        field: 'name',
        headerName: t('academicAreas.name'),
        flex: 1,
        minWidth: 140,
        sortable: false,
      },
      {
        field: 'code',
        headerName: t('academicAreas.code'),
        flex: 0.6,
        minWidth: 100,
        sortable: false,
        valueFormatter: (value: string | null | undefined) =>
          value == null || value === '' ? '-' : String(value),
      },
      {
        field: 'institution_name',
        headerName: t('academicAreas.institution'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<AcademicArea>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('academicAreas.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('academicAreas.delete')}
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
        <PageHeader title={t('academicAreas.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('academicAreas.new')}
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
          {editing ? t('academicAreas.editDialog') : t('academicAreas.newDialog')}
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
                      label={t('academicAreas.institution')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('academicAreas.name')}
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              required
              fullWidth
            />
            <TextField
              label={t('academicAreas.code')}
              {...form.register('code')}
              fullWidth
            />
            <TextField
              label={t('academicAreas.description')}
              {...form.register('description')}
              fullWidth
              multiline
              minRows={2}
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
        <DialogTitle>{t('academicAreas.deleteDialog')}</DialogTitle>
        <DialogContent>{t('academicAreas.deletePrompt', { name: deleteTarget?.name ?? '' })}</DialogContent>
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
