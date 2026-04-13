import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import {
  Alert,
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
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { apiClient } from '@/api/client'
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
import type { Institution } from '@/types/schemas'

const institutionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  dane_code: z.string().trim().min(1).max(20),
  legal_reference: z.string().max(255).optional(),
  nit: z.string().max(20).optional(),
})

type InstitutionForm = z.infer<typeof institutionSchema>

const emptyForm: InstitutionForm = {
  name: '',
  dane_code: '',
  legal_reference: '',
  nit: '',
}

export function InstitutionsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Institution | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const listQuery = useInfiniteList<Institution>({
    queryKey: queryKeys.institutions(),
    url: '/api/institutions/',
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<InstitutionForm>({
    resolver: zodResolver(institutionSchema),
    defaultValues: emptyForm,
  })

  const createMutation = useMutation({
    mutationFn: (body: InstitutionForm) =>
      apiClient.post<Institution>('/api/institutions/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['institutions'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: InstitutionForm }) =>
      apiClient.patch<Institution>(`/api/institutions/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['institutions'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/institutions/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['institutions'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = useCallback(
    (row: Institution) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        name: row.name,
        dane_code: row.dane_code,
        legal_reference: row.legal_reference ?? '',
        nit: row.nit ?? '',
      })
      setDialogOpen(true)
    },
    [form],
  )

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const columns = useMemo<GridColDef<Institution>[]>(
    () => [
      {
        field: 'name',
        headerName: t('institutions.name'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'dane_code',
        headerName: t('institutions.dane'),
        width: 130,
        sortable: false,
      },
      {
        field: 'nit',
        headerName: t('institutions.nit'),
        flex: 0.8,
        minWidth: 120,
        sortable: false,
        valueFormatter: (value: string | null | undefined) =>
          value == null || value === '' ? '-' : String(value),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<Institution>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('institutions.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('institutions.delete')}
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
    form.reset(emptyForm)
  }

  function onSubmit(values: InstitutionForm) {
    setFormError(null)
    const body = {
      ...values,
      legal_reference: values.legal_reference || undefined,
      nit: values.nit || undefined,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const pending =
    createMutation.isPending || updateMutation.isPending || form.formState.isSubmitting

  return (
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader title={t('institutions.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('institutions.new')}
        </Button>
      </Box>

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
          {editing ? t('institutions.editDialog') : t('institutions.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label={t('institutions.name')}
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              fullWidth
              required
            />
            <TextField
              label={t('institutions.daneCode')}
              {...form.register('dane_code')}
              error={!!form.formState.errors.dane_code}
              helperText={form.formState.errors.dane_code?.message}
              fullWidth
              required
            />
            <TextField
              label={t('institutions.legalReference')}
              {...form.register('legal_reference')}
              error={!!form.formState.errors.legal_reference}
              helperText={form.formState.errors.legal_reference?.message}
              fullWidth
            />
            <TextField
              label={t('institutions.nit')}
              {...form.register('nit')}
              error={!!form.formState.errors.nit}
              helperText={form.formState.errors.nit?.message}
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
        <DialogTitle>{t('institutions.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('institutions.deletePrompt', { name: deleteTarget?.name ?? '' })}
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
