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
import { useTranslation } from 'react-i18next'
import type { Resolver } from 'react-hook-form'
import { Controller, useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { GradeLevel, Institution } from '@/types/schemas'

const schema = z.object({
  institution: z.string().uuid('Selecciona una institución'),
  name: z.string().trim().min(1).max(100),
  level_order: z.preprocess(
    (v) => (v === '' || v === undefined || Number.isNaN(Number(v))
      ? undefined
      : Number(v)),
    z.number().int().min(0).optional(),
  ),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  institution: '',
  name: '',
  level_order: undefined,
}

export function GradeLevelsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GradeLevel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GradeLevel | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId, search: appliedSearch || undefined }
      : { search: appliedSearch || undefined }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: [
      'grade-levels',
      'list',
      { institution: selectedInstitutionId, search: appliedSearch },
    ],
    queryFn: async () => {
      const { data } = await apiClient.get<GradeLevel[]>(
        '/api/grade-levels/',
        { params: listParams },
      )
      return data
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<GradeLevel>('/api/grade-levels/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-levels'] })
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
    }) => apiClient.patch<GradeLevel>(`/api/grade-levels/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-levels'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/grade-levels/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-levels'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    const body: Record<string, unknown> = {
      institution: values.institution,
      name: values.name,
    }
    if (values.level_order !== undefined) {
      body.level_order = values.level_order
    }
    return body
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

  function openEdit(row: GradeLevel) {
    setEditing(row)
    setFormError(null)
    form.reset({
      institution: row.institution,
      name: row.name,
      level_order: row.level_order ?? undefined,
    })
    setDialogOpen(true)
  }

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
        <PageHeader title={t('gradeLevels.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('gradeLevels.new')}
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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('gradeLevels.name')}</TableCell>
              <TableCell>{t('gradeLevels.order')}</TableCell>
              <TableCell>{t('gradeLevels.institution')}</TableCell>
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
                <TableCell>{row.level_order ?? '-'}</TableCell>
                <TableCell>{row.institution_name}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('gradeLevels.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('gradeLevels.delete')}
                    onClick={() => setDeleteTarget(row)}
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
          {editing ? t('gradeLevels.editDialog') : t('gradeLevels.newDialog')}
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
                      label={t('gradeLevels.institution')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('gradeLevels.levelName')}
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              required
              fullWidth
            />
            <TextField
              label={t('gradeLevels.orderOptional')}
              type="number"
              {...form.register('level_order')}
              error={!!form.formState.errors.level_order}
              helperText={form.formState.errors.level_order?.message}
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
        <DialogTitle>{t('gradeLevels.deleteDialog')}</DialogTitle>
        <DialogContent>{t('gradeLevels.deletePrompt', { name: deleteTarget?.name ?? '' })}</DialogContent>
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
