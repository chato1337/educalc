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
import { Controller, useForm } from 'react-hook-form'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
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
    queryFn: async () => {
      const { data } = await apiClient.get<Institution[]>('/api/institutions/')
      return data
    },
  })

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId }
      : undefined

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.campuses(selectedInstitutionId, undefined),
    queryFn: async () => {
      const { data } = await apiClient.get<Campus[]>('/api/campuses/', {
        params: listParams,
      })
      return data
    },
  })

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

  function openEdit(row: Campus) {
    setEditing(row)
    setFormError(null)
    form.reset({
      institution: row.institution,
      name: row.name,
      code: row.code ?? '',
    })
    setDialogOpen(true)
  }

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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('campuses.name')}</TableCell>
              <TableCell>{t('campuses.code')}</TableCell>
              <TableCell>{t('campuses.institution')}</TableCell>
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
                <TableCell>{row.code || '-'}</TableCell>
                <TableCell>{row.institution_name}</TableCell>
                <TableCell align="right">
                  <IconButton
                    aria-label={t('campuses.edit')}
                    onClick={() => openEdit(row)}
                    size="small"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={t('campuses.delete')}
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
