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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
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

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.institutions(),
    queryFn: async () => {
      const { data } = await apiClient.get<Institution[]>('/api/institutions/')
      return data
    },
  })

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

  function openEdit(row: Institution) {
    setEditing(row)
    setFormError(null)
    form.reset({
      name: row.name,
      dane_code: row.dane_code,
      legal_reference: row.legal_reference ?? '',
      nit: row.nit ?? '',
    })
    setDialogOpen(true)
  }

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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('institutions.name')}</TableCell>
              <TableCell>{t('institutions.dane')}</TableCell>
              <TableCell>{t('institutions.nit')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.none')}</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.dane_code}</TableCell>
                <TableCell>{row.nit ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    aria-label={t('institutions.edit')}
                    onClick={() => openEdit(row)}
                    size="small"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={t('institutions.delete')}
                    onClick={() => setDeleteTarget(row)}
                    size="small"
                    color="error"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
