import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
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
import { useUiStore } from '@/stores/uiStore'
import type { Campus } from '@/types/schemas'
import type { Institution } from '@/types/schemas'

const campusSchema = z.object({
  institution: z.string().uuid('Elige una institución'),
  name: z.string().trim().min(1).max(255),
  code: z.string().max(50).optional(),
})

type CampusForm = z.infer<typeof campusSchema>

const emptyForm: CampusForm = {
  institution: '',
  name: '',
  code: '',
}

export function CampusesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Campus | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campus | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useQuery({
    queryKey: queryKeys.institutions(),
    queryFn: async () =>
      fetchReferenceListResults<Institution>('/api/institutions/'),
  })

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId }
      : undefined

  const listQuery = useInfiniteList<Campus>({
    queryKey: queryKeys.campuses(selectedInstitutionId, undefined),
    url: '/api/campuses/',
    params: listParams,
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<CampusForm>({
    resolver: zodResolver(campusSchema),
    defaultValues: emptyForm,
  })

  const createMutation = useMutation({
    mutationFn: (body: CampusForm) =>
      apiClient.post<Campus>('/api/campuses/', {
        ...body,
        code: body.code || '',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campuses'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CampusForm }) =>
      apiClient.patch<Campus>(`/api/campuses/${id}/`, {
        ...body,
        code: body.code || '',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campuses'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/campuses/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campuses'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      ...emptyForm,
      institution: selectedInstitutionId ?? '',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: Campus) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        institution: row.institution,
        name: row.name,
        code: row.code ?? '',
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<Campus>[]>(
    () => [
      {
        field: 'name',
        headerName: t('campuses.name'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'code',
        headerName: t('campuses.code'),
        flex: 0.5,
        minWidth: 100,
        sortable: false,
        valueFormatter: (value: string | null | undefined) =>
          value == null || value === '' ? '-' : String(value),
      },
      {
        field: 'institution_name',
        headerName: t('campuses.institution'),
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
        getActions: (params: GridRenderCellParams<Campus>) => [
          <IconButton
            key="edit"
            aria-label={t('campuses.edit')}
            onClick={() => openEdit(params.row)}
            size="small"
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            aria-label={t('campuses.delete')}
            onClick={() => setDeleteTarget(params.row)}
            size="small"
            color="error"
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
    form.reset(emptyForm)
  }

  function onSubmit(values: CampusForm) {
    setFormError(null)
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: values })
    } else {
      createMutation.mutate(values)
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
          title={t('campuses.title')}
          subtitle={t('campuses.subtitle')}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('campuses.new')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          Sin filtro: se muestran todas las sedes visibles para tu usuario. Elige
          una institución en la barra para acotar el listado.
        </Alert>
      ) : null}

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
        <DialogTitle>{editing ? t('campuses.editDialog') : t('campuses.newDialog')}</DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="institution"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={institutions}
                  getOptionLabel={(o) => o.name}
                  value={
                    institutions.find((i) => i.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  disabled={!!editing}
                  renderInput={(params) =>
                    campusInstitutionField(
                      params,
                      fieldState.error?.message,
                      t('campuses.institution'),
                      t('campuses.institutionAria'),
                    )
                  }
                />
              )}
            />
            <TextField
              label={t('campuses.name')}
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              fullWidth
              required
            />
            <TextField
              label={t('campuses.code')}
              {...form.register('code')}
              error={!!form.formState.errors.code}
              helperText={form.formState.errors.code?.message}
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
        <DialogTitle>{t('campuses.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('campuses.deletePrompt', { name: deleteTarget?.name ?? '' })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function campusInstitutionField(
  params: AutocompleteRenderInputParams,
  error?: string,
  label?: string,
  ariaLabel?: string,
) {
  return (
    <TextField
      {...params}
      label={label ?? 'Institucion'}
      required
      error={!!error}
      helperText={error}
      slotProps={{
        htmlInput: {
          ...params.inputProps,
          'aria-label': ariaLabel ?? 'Institucion de la sede',
        },
      }}
    />
  )
}
