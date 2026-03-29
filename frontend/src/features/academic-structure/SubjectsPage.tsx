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
import type { Resolver } from 'react-hook-form'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicArea, Institution, Subject } from '@/types/schemas'

const schema = z.object({
  institution: z.string().uuid('Selecciona una institución'),
  academic_area: z.string().uuid('Selecciona un área'),
  name: z.string().trim().min(1).max(255),
  emphasis: z.string().max(255).optional(),
  hours: z.preprocess(
    (v) =>
      v === '' || v === undefined || Number.isNaN(Number(v))
        ? undefined
        : Number(v),
    z.number().int().min(0).optional(),
  ),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  institution: '',
  academic_area: '',
  name: '',
  emphasis: '',
  hours: undefined,
}

export function SubjectsPage() {
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId, search: appliedSearch || undefined }
      : { search: appliedSearch || undefined }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: [
      'subjects',
      'list',
      { institution: selectedInstitutionId, search: appliedSearch },
    ],
    queryFn: async () => {
      const { data } = await apiClient.get<Subject[]>('/api/subjects/', {
        params: listParams,
      })
      return data
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })

  const watchedInstitution = useWatch({
    control: form.control,
    name: 'institution',
  })

  const { data: areasForForm = [] } = useQuery({
    queryKey: ['academic-areas', 'for-subject-dialog', watchedInstitution],
    queryFn: async () => {
      const { data } = await apiClient.get<AcademicArea[]>(
        '/api/academic-areas/',
        { params: { institution: watchedInstitution } },
      )
      return data
    },
    enabled: dialogOpen && !!watchedInstitution,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<Subject>('/api/subjects/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] })
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
    }) => apiClient.patch<Subject>(`/api/subjects/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/subjects/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    const body: Record<string, unknown> = {
      institution: values.institution,
      academic_area: values.academic_area,
      name: values.name,
      emphasis: values.emphasis?.trim() || undefined,
    }
    if (values.hours !== undefined) body.hours = values.hours
    return body
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    const inst = selectedInstitutionId ?? ''
    form.reset({
      ...defaults,
      institution: inst,
    })
    setDialogOpen(true)
  }

  function openEdit(row: Subject) {
    setEditing(row)
    setFormError(null)
    form.reset({
      institution: row.institution,
      academic_area: row.academic_area,
      name: row.name,
      emphasis: row.emphasis ?? '',
      hours: row.hours ?? undefined,
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
        <PageHeader title="Materias (asignaturas)" />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nueva materia
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-center">
        <TextField
          size="small"
          label="Buscar"
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
          Aplicar
        </Button>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Área</TableCell>
              <TableCell>Institución</TableCell>
              <TableCell>Horas</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Sin registros.</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.academic_area_name}</TableCell>
                <TableCell>{row.institution_name}</TableCell>
                <TableCell>{row.hours ?? '—'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label="Editar"
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Eliminar"
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
          {editing ? 'Editar materia' : 'Nueva materia'}
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
                  onChange={(_, v) => {
                    field.onChange(v?.id ?? '')
                    form.setValue('academic_area', '')
                  }}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Institución"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_area"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={areasForForm}
                  getOptionLabel={(o: AcademicArea) => o.name}
                  value={
                    areasForForm.find((a) => a.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing || !watchedInstitution}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Área académica"
                      required
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ||
                        (!watchedInstitution
                          ? 'Elige primero la institución'
                          : undefined)
                      }
                    />
                  )}
                />
              )}
            />
            <TextField
              label="Nombre"
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              required
              fullWidth
            />
            <TextField
              label="Énfasis"
              {...form.register('emphasis')}
              fullWidth
            />
            <TextField
              label="Horas (opcional)"
              type="number"
              {...form.register('hours')}
              error={!!form.formState.errors.hours}
              helperText={form.formState.errors.hours?.message}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>Eliminar materia</DialogTitle>
        <DialogContent>¿Eliminar «{deleteTarget?.name}»?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteTarget && deleteMutation.mutate(deleteTarget.id)
            }
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
