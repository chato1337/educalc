import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SearchIcon from '@mui/icons-material/Search'
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
import { useForm, type Resolver } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { PageHeader } from '@/components/PageHeader'
import type { Teacher } from '@/types/schemas'

const schema = z.object({
  document_type: z.string().max(10).optional(),
  document_number: z.string().max(20).optional(),
  first_name: z.string().trim().min(1).max(100),
  second_name: z.string().max(100).optional(),
  first_last_name: z.string().trim().min(1).max(100),
  second_last_name: z.string().max(100).optional(),
  full_name: z.string().trim().min(1).max(400),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().max(30).optional(),
  specialty: z.string().max(100).optional(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  document_type: '',
  document_number: '',
  first_name: '',
  second_name: '',
  first_last_name: '',
  second_last_name: '',
  full_name: '',
  email: '',
  phone: '',
  specialty: '',
}

function toApiBody(v: FormValues) {
  return {
    document_type: v.document_type || undefined,
    document_number: v.document_number || undefined,
    first_name: v.first_name,
    second_name: v.second_name || undefined,
    first_last_name: v.first_last_name,
    second_last_name: v.second_last_name || undefined,
    full_name: v.full_name,
    email: v.email || undefined,
    phone: v.phone || undefined,
    specialty: v.specialty || undefined,
  }
}

export function TeachersPage() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['teachers', 'list', appliedSearch],
    queryFn: async () => {
      const { data } = await apiClient.get<Teacher[]>('/api/teachers/', {
        params: appliedSearch ? { search: appliedSearch } : undefined,
      })
      return data
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })

  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toApiBody>) =>
      apiClient.post<Teacher>('/api/teachers/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
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
      body: ReturnType<typeof toApiBody>
    }) => apiClient.patch<Teacher>(`/api/teachers/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/teachers/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset(defaults)
    setDialogOpen(true)
  }

  function openEdit(row: Teacher) {
    setEditing(row)
    setFormError(null)
    form.reset({
      document_type: row.document_type ?? '',
      document_number: row.document_number ?? '',
      first_name: row.first_name,
      second_name: row.second_name ?? '',
      first_last_name: row.first_last_name,
      second_last_name: row.second_last_name ?? '',
      full_name: row.full_name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      specialty: row.specialty ?? '',
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
    const body = toApiBody(values)
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
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader title="Docentes" />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo docente
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
              <TableCell>Documento</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Especialidad</TableCell>
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
                <TableCell>{row.full_name}</TableCell>
                <TableCell>
                  {row.document_type} {row.document_number}
                </TableCell>
                <TableCell>{row.email ?? '—'}</TableCell>
                <TableCell>{row.specialty ?? '—'}</TableCell>
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
          {editing ? 'Editar docente' : 'Nuevo docente'}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1 max-h-[70vh] overflow-auto">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField label="Tipo documento" {...form.register('document_type')} fullWidth />
            <TextField label="Número documento" {...form.register('document_number')} fullWidth />
            <TextField
              label="Nombre"
              {...form.register('first_name')}
              required
              error={!!form.formState.errors.first_name}
              helperText={form.formState.errors.first_name?.message}
              fullWidth
            />
            <TextField label="Segundo nombre" {...form.register('second_name')} fullWidth />
            <TextField
              label="Primer apellido"
              {...form.register('first_last_name')}
              required
              error={!!form.formState.errors.first_last_name}
              helperText={form.formState.errors.first_last_name?.message}
              fullWidth
            />
            <TextField label="Segundo apellido" {...form.register('second_last_name')} fullWidth />
            <TextField
              label="Nombre completo"
              {...form.register('full_name')}
              required
              error={!!form.formState.errors.full_name}
              helperText={form.formState.errors.full_name?.message}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              {...form.register('email')}
              error={!!form.formState.errors.email}
              helperText={form.formState.errors.email?.message}
              fullWidth
            />
            <TextField label="Teléfono" {...form.register('phone')} fullWidth />
            <TextField label="Especialidad" {...form.register('specialty')} fullWidth />
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
        <DialogTitle>Eliminar docente</DialogTitle>
        <DialogContent>¿Eliminar a {deleteTarget?.full_name}?</DialogContent>
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
