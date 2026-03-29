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
import { Controller, useForm } from 'react-hook-form'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import {
  useAcademicYearsQuery,
  useCampusesForInstitution,
  useGradeLevelsQuery,
} from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicYear,
  Campus,
  GradeLevel,
  Group,
} from '@/types/schemas'

const schema = z.object({
  grade_level: z.string().uuid('Selecciona un nivel'),
  academic_year: z.string().uuid('Selecciona un año lectivo'),
  campus: z.string().uuid('Selecciona una sede'),
  name: z.string().trim().min(1).max(50),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  grade_level: '',
  academic_year: '',
  campus: '',
  name: '',
}

export function GroupsPage() {
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterCampusId, setFilterCampusId] = useState<string | null>(null)
  const [filterGradeLevelId, setFilterGradeLevelId] = useState<string | null>(
    null,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: campuses = [] } = useCampusesForInstitution(
    selectedInstitutionId,
  )
  const { data: gradeLevels = [] } = useGradeLevelsQuery(
    selectedInstitutionId,
  )

  const listParams = {
    academic_year: filterYearId ?? undefined,
    campus: filterCampusId ?? undefined,
    grade_level: filterGradeLevelId ?? undefined,
    search: appliedSearch || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: [
      'groups',
      'list',
      {
        institution: selectedInstitutionId,
        ...listParams,
      },
    ],
    queryFn: async () => {
      const { data } = await apiClient.get<Group[]>('/api/groups/', {
        params: listParams,
      })
      return data
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<Group>('/api/groups/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
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
    }) => apiClient.patch<Group>(`/api/groups/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/groups/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      grade_level: gradeLevels[0]?.id ?? '',
      academic_year: academicYears[0]?.id ?? '',
      campus: campuses[0]?.id ?? '',
      name: '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: Group) {
    setEditing(row)
    setFormError(null)
    form.reset({
      grade_level: row.grade_level,
      academic_year: row.academic_year,
      campus: row.campus,
      name: row.name,
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

  const canForm =
    gradeLevels.length > 0 &&
    academicYears.length > 0 &&
    campuses.length > 0

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title="Grupos"
          subtitle="Filtra por institución en la barra; opcionalmente por año, sede y nivel."
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!canForm}
        >
          Nuevo grupo
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          Elige una institución para cargar sedes, años y niveles coherentes en
          el formulario y filtros.
        </Alert>
      ) : null}

      {selectedInstitutionId && !canForm ? (
        <Alert severity="warning">
          Faltan datos: necesitas al menos un año lectivo, una sede y un nivel
          para esta institución.
        </Alert>
      ) : null}

      <Alert severity="info">
        Ranking de estudiantes:{' '}
        <code className="text-xs">/groups/&lt;uuid&gt;/rankings</code> — en la
        tabla usa el enlace «Ranking».
      </Alert>

      <Paper className="p-3 flex flex-col gap-3">
        <Box className="flex flex-wrap gap-2 items-end">
          <Autocomplete
            className="min-w-[200px] flex-1"
            size="small"
            options={academicYears}
            getOptionLabel={(y: AcademicYear) =>
              `${y.year} (${y.institution_name})`
            }
            value={
              academicYears.find((y) => y.id === filterYearId) ?? null
            }
            onChange={(_, v) => setFilterYearId(v?.id ?? null)}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Año lectivo" />
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
          <Autocomplete
            className="min-w-[180px] flex-1"
            size="small"
            options={campuses}
            getOptionLabel={(c: Campus) => c.name}
            value={campuses.find((c) => c.id === filterCampusId) ?? null}
            onChange={(_, v) => setFilterCampusId(v?.id ?? null)}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Sede" />
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
          <Autocomplete
            className="min-w-[180px] flex-1"
            size="small"
            options={gradeLevels}
            getOptionLabel={(g: GradeLevel) => g.name}
            value={
              gradeLevels.find((g) => g.id === filterGradeLevelId) ?? null
            }
            onChange={(_, v) => setFilterGradeLevelId(v?.id ?? null)}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Nivel" />
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
        </Box>
        <Box className="flex flex-wrap gap-2 items-center">
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
        </Box>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Nivel</TableCell>
              <TableCell>Año</TableCell>
              <TableCell>Sede</TableCell>
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
                <TableCell>{row.grade_level_name}</TableCell>
                <TableCell>{row.academic_year_year}</TableCell>
                <TableCell>{row.campus_name}</TableCell>
                <TableCell align="right">
                  <Link
                    to={`/groups/${row.id}/rankings`}
                    className="text-blue-600 text-sm mr-2"
                  >
                    Ranking
                  </Link>
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
          {editing ? 'Editar grupo' : 'Nuevo grupo'}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="grade_level"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={gradeLevels}
                  getOptionLabel={(g: GradeLevel) => g.name}
                  value={
                    gradeLevels.find((g) => g.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Nivel"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={academicYears}
                  getOptionLabel={(y: AcademicYear) =>
                    `${y.year} (${y.institution_name})`
                  }
                  value={
                    academicYears.find((y) => y.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Año lectivo"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="campus"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={campuses}
                  getOptionLabel={(c: Campus) => c.name}
                  value={campuses.find((c) => c.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Sede"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label="Nombre del grupo"
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              required
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
        <DialogTitle>Eliminar grupo</DialogTitle>
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
