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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { Parent, RoleEnum, Teacher, UserProfile } from '@/types/schemas'
import type { Institution } from '@/types/schemas'

const roleOptions: RoleEnum[] = [
  'ADMIN',
  'COORDINATOR',
  'TEACHER',
  'PARENT',
]

const schema = z.object({
  user: z.coerce.number().int().positive(),
  role: z.enum(['ADMIN', 'COORDINATOR', 'TEACHER', 'PARENT']).optional(),
  institution: z.string().optional(),
  teacher: z.string().optional(),
  parent: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function toPatchBody(v: FormValues) {
  return {
    role: v.role,
    institution: v.institution || undefined,
    teacher: v.teacher || undefined,
    parent: v.parent || undefined,
  }
}

function toCreateBody(v: FormValues) {
  return {
    user: v.user,
    role: v.role,
    institution: v.institution || undefined,
    teacher: v.teacher || undefined,
    parent: v.parent || undefined,
  }
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleEnum | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', 'pick'],
    queryFn: async () => {
      const { data } = await apiClient.get<Teacher[]>('/api/teachers/')
      return data
    },
    enabled: dialogOpen,
  })
  const { data: parents = [] } = useQuery({
    queryKey: ['parents', 'pick'],
    queryFn: async () => {
      const { data } = await apiClient.get<Parent[]>('/api/parents/')
      return data
    },
    enabled: dialogOpen,
  })

  const listParams = {
    institution: selectedInstitutionId ?? undefined,
    role: roleFilter || undefined,
    search: appliedSearch || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['users', 'list', listParams],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile[]>('/api/users/', {
        params: listParams,
      })
      return data
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      user: 0,
      role: undefined,
      institution: '',
      teacher: '',
      parent: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toCreateBody>) =>
      apiClient.post<UserProfile>('/api/users/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
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
      body: ReturnType<typeof toPatchBody>
    }) => apiClient.patch<UserProfile>(`/api/users/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/users/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      user: 0,
      role: undefined,
      institution: selectedInstitutionId ?? '',
      teacher: '',
      parent: '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: UserProfile) {
    setEditing(row)
    setFormError(null)
    form.reset({
      user: row.user,
      role: row.role ?? undefined,
      institution: row.institution ?? '',
      teacher: row.teacher ?? '',
      parent: row.parent ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: toPatchBody(values) })
    } else {
      if (!values.user || values.user <= 0) {
        setFormError('Indica el ID numérico del usuario Django (pk).')
        return
      }
      createMutation.mutate(toCreateBody(values))
    }
  }

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title="Usuarios (perfiles)"
          subtitle="Vincula el usuario Django (pk) con rol e institución. Requiere permisos de administración en API."
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo perfil
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-end">
        <FormControl size="small" className="min-w-[160px]">
          <InputLabel>Rol</InputLabel>
          <Select
            label="Rol"
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as RoleEnum | '')
            }
          >
            <MenuItem value="">Todos</MenuItem>
            {roleOptions.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
              <TableCell>Usuario</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Institución (id)</TableCell>
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
                <TableCell>
                  #{row.user} — {row.username}
                </TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.role ?? '—'}</TableCell>
                <TableCell>{row.institution ?? '—'}</TableCell>
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
          {editing ? 'Editar perfil de usuario' : 'Nuevo perfil de usuario'}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label="ID usuario Django (pk)"
              type="number"
              {...form.register('user', { valueAsNumber: true })}
              disabled={!!editing}
              required={!editing}
              fullWidth
              helperText="Solo al crear. Es el pk de auth_user."
            />
            <FormControl fullWidth>
              <InputLabel>Rol</InputLabel>
              <Controller
                name="role"
                control={form.control}
                render={({ field }) => (
                  <Select
                    label="Rol"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const v = String(e.target.value)
                      field.onChange(
                        v === '' ? undefined : (v as RoleEnum),
                      )
                    }}
                  >
                    <MenuItem value="">(sin rol)</MenuItem>
                    {roleOptions.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
            <Controller
              name="institution"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={institutions}
                  getOptionLabel={(o: Institution) => o.name}
                  value={
                    institutions.find((i) => i.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField {...params} label="Institución" />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                />
              )}
            />
            <Controller
              name="teacher"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={teachers}
                  getOptionLabel={(t: Teacher) => t.full_name}
                  value={teachers.find((t) => t.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField {...params} label="Docente (opcional)" />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                />
              )}
            />
            <Controller
              name="parent"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={parents}
                  getOptionLabel={(p: Parent) => p.full_name}
                  value={parents.find((p) => p.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField {...params} label="Acudiente (opcional)" />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
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
        <DialogTitle>Eliminar perfil</DialogTitle>
        <DialogContent>
          ¿Eliminar el perfil de {deleteTarget?.username}?
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
