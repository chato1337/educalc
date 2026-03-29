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
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { PageHeader } from '@/components/PageHeader'
import type { Parent, Student, StudentGuardian } from '@/types/schemas'

const schema = z.object({
  student: z.string().uuid('Selecciona estudiante'),
  parent: z.string().uuid('Selecciona acudiente'),
  is_primary: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function StudentGuardiansPage() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StudentGuardian | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentGuardian | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['student-guardians', 'list', appliedSearch],
    queryFn: async () => {
      const { data } = await apiClient.get<StudentGuardian[]>(
        '/api/student-guardians/',
        {
          params: appliedSearch ? { search: appliedSearch } : undefined,
        },
      )
      return data
    },
  })

  const { data: students = [] } = useQuery({
    queryKey: ['students', 'pick-guardian'],
    queryFn: async () => {
      const { data } = await apiClient.get<Student[]>('/api/students/')
      return data
    },
    enabled: dialogOpen,
  })
  const { data: parents = [] } = useQuery({
    queryKey: ['parents', 'pick-guardian'],
    queryFn: async () => {
      const { data } = await apiClient.get<Parent[]>('/api/parents/')
      return data
    },
    enabled: dialogOpen,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      student: '',
      parent: '',
      is_primary: false,
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: FormValues) =>
      apiClient.post<StudentGuardian>('/api/student-guardians/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-guardians'] })
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
      body: FormValues
    }) => apiClient.patch<StudentGuardian>(`/api/student-guardians/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-guardians'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/student-guardians/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-guardians'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({ student: '', parent: '', is_primary: false })
    setDialogOpen(true)
  }

  function openEdit(row: StudentGuardian) {
    setEditing(row)
    setFormError(null)
    form.reset({
      student: row.student,
      parent: row.parent,
      is_primary: row.is_primary ?? false,
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setFormError(null)
    form.reset({ student: '', parent: '', is_primary: false })
  }

  function onSubmit(values: FormValues) {
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
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader title="Estudiante — acudiente" />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nueva relación
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
              <TableCell>Estudiante</TableCell>
              <TableCell>Acudiente</TableCell>
              <TableCell>Principal</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Cargando…</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>Sin registros.</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.student_name}</TableCell>
                <TableCell>{row.parent_name}</TableCell>
                <TableCell>{row.is_primary ? 'Sí' : 'No'}</TableCell>
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
          {editing ? 'Editar relación' : 'Nueva relación'}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="student"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={students}
                  getOptionLabel={(s: Student) => s.full_name}
                  value={students.find((s) => s.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Estudiante"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="parent"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={parents}
                  getOptionLabel={(p: Parent) => p.full_name}
                  value={parents.find((p) => p.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Acudiente"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="is_primary"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(_, c) => field.onChange(c)}
                    />
                  }
                  label="Acudiente principal"
                />
              )}
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Eliminar relación</DialogTitle>
        <DialogContent>
          ¿Eliminar vínculo {deleteTarget?.student_name} —{' '}
          {deleteTarget?.parent_name}?
        </DialogContent>
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
