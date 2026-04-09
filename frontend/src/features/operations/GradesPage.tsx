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
import {
  Controller,
  useForm,
  useWatch,
  type Resolver,
} from 'react-hook-form'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import {
  useAcademicPeriodsForYear,
  useCourseAssignmentsList,
  useGradingScalesForInstitution,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicPeriod,
  AcademicYear,
  CourseAssignment,
  Enrollment,
  Grade,
  GradingScale,
  Student,
} from '@/types/schemas'

const dec = z
  .string()
  .min(1)
  .regex(/^-?\d{0,2}(\.\d{0,2})?$/, 'Formato inválido')

const decOpt = z
  .string()
  .regex(/^-?\d{0,2}(\.\d{0,2})?$/, 'Formato inválido')
  .optional()
  .or(z.literal(''))

const schema = z.object({
  student: z.string().uuid('Selecciona estudiante'),
  course_assignment: z.string().uuid('Selecciona asignación'),
  academic_period: z.string().uuid('Selecciona período'),
  numerical_grade: dec,
  performance_level: z.string().uuid().optional().or(z.literal('')),
  definitive_grade: decOpt,
})

type FormValues = z.infer<typeof schema>

function bodyFromValues(v: FormValues) {
  const body: Record<string, unknown> = {
    student: v.student,
    course_assignment: v.course_assignment,
    academic_period: v.academic_period,
    numerical_grade: v.numerical_grade,
  }
  if (v.performance_level) body.performance_level = v.performance_level
  if (v.definitive_grade && v.definitive_grade !== '')
    body.definitive_grade = v.definitive_grade
  return body
}

function parseScaleBound(s: string): number | null {
  const n = Number(String(s).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Nivel de desempeño cuyo rango [min_score, max_score] contiene la nota. */
function matchGradingScaleId(
  grade: number,
  scales: GradingScale[],
): string | null {
  const matches: GradingScale[] = []
  for (const s of scales) {
    const min = parseScaleBound(s.min_score)
    const max = parseScaleBound(s.max_score)
    if (min === null || max === null) continue
    if (grade >= min && grade <= max) matches.push(s)
  }
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0].id
  matches.sort((a, b) => {
    const aw = parseScaleBound(a.max_score)! - parseScaleBound(a.min_score)!
    const bw = parseScaleBound(b.max_score)! - parseScaleBound(b.min_score)!
    if (aw !== bw) return aw - bw
    return a.name.localeCompare(b.name)
  })
  return matches[0].id
}

/** Asignaciones cuyo `group` coincide con la matrícula activa; en edición incluye la actual si hiciera falta. */
function courseAssignmentsForStudentGroups(
  all: CourseAssignment[],
  enrollments: Enrollment[],
  editingAssignmentId: string | null | undefined,
): CourseAssignment[] {
  const groups = new Set(enrollments.map((e) => e.group))
  if (groups.size === 0) {
    if (editingAssignmentId) {
      const only = all.find((a) => a.id === editingAssignmentId)
      return only ? [only] : []
    }
    return []
  }
  const base = all.filter((a) => groups.has(a.group))
  if (editingAssignmentId) {
    const cur = all.find((a) => a.id === editingAssignmentId)
    if (cur && !base.some((a) => a.id === cur.id)) {
      return [cur, ...base]
    }
  }
  return base
}

export function GradesPage() {
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [filterAssignmentId, setFilterAssignmentId] = useState<string | null>(
    null,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogYearId, setDialogYearId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Grade | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Grade | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )
  const { data: assignmentsForFilter = [] } = useCourseAssignmentsList(
    { academic_year: filterYearId ?? undefined },
    { enabled: !!filterYearId },
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    course_assignment: filterAssignmentId ?? undefined,
    search: appliedSearch || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.grades(listParams),
    queryFn: async () => {
      const { data } = await apiClient.get<Grade[]>('/api/grades/', {
        params: listParams,
      })
      return data
    },
  })

  const { data: gradingScales = [] } = useGradingScalesForInstitution(
    selectedInstitutionId,
  )
  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)

  const { data: periodsForDialog = [] } = useAcademicPeriodsForYear(
    dialogOpen ? dialogYearId : null,
  )
  const { data: assignmentsForDialog = [] } = useCourseAssignmentsList(
    { academic_year: dialogYearId ?? undefined },
    { enabled: dialogOpen && !!dialogYearId },
  )

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    void apiClient
      .get<CourseAssignment>(`/api/course-assignments/${editing.course_assignment}/`)
      .then(({ data }) => {
        if (!cancelled) setDialogYearId(data.academic_year)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [editing])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      student: '',
      course_assignment: '',
      academic_period: '',
      numerical_grade: '',
      performance_level: '',
      definitive_grade: '',
    },
  })

  const watchedStudent = useWatch({ control: form.control, name: 'student' })
  const dialogStudentId =
    editing?.student ??
    (typeof watchedStudent === 'string' ? watchedStudent : '')

  const needStudentEnrollments =
    dialogOpen && !!dialogYearId && !!dialogStudentId

  const { data: enrollmentsRaw, isLoading: enrollmentsLoading } = useQuery({
    queryKey: queryKeys.enrollments({
      student: dialogStudentId || undefined,
      academic_year: dialogYearId ?? undefined,
      status: 'active',
    }),
    queryFn: async () => {
      const { data } = await apiClient.get<Enrollment[]>('/api/enrollments/', {
        params: {
          student: dialogStudentId,
          academic_year: dialogYearId!,
          status: 'active',
        },
      })
      return data
    },
    enabled: needStudentEnrollments,
  })
  const enrollmentsForDialog = enrollmentsRaw ?? []

  const assignmentsForDialogScoped = useMemo(() => {
    if (!dialogOpen || !dialogYearId) return []
    if (!dialogStudentId) return []
    if (enrollmentsLoading) return []
    return courseAssignmentsForStudentGroups(
      assignmentsForDialog,
      enrollmentsForDialog,
      editing?.course_assignment,
    )
  }, [
    dialogOpen,
    dialogYearId,
    dialogStudentId,
    enrollmentsLoading,
    assignmentsForDialog,
    enrollmentsForDialog,
    editing?.course_assignment,
  ])

  useEffect(() => {
    if (!dialogOpen || editing) return
    if (!dialogStudentId) {
      if (form.getValues('course_assignment')) {
        form.setValue('course_assignment', '')
      }
      return
    }
    if (enrollmentsLoading) return
    const ca = form.getValues('course_assignment')
    if (!ca) return
    if (!assignmentsForDialogScoped.some((a) => a.id === ca)) {
      form.setValue('course_assignment', '')
    }
  }, [
    dialogOpen,
    editing,
    dialogStudentId,
    enrollmentsLoading,
    assignmentsForDialogScoped,
    form.getValues,
    form.setValue,
  ])

  const watchedNumericalGrade = useWatch({
    control: form.control,
    name: 'numerical_grade',
  })

  useEffect(() => {
    if (!dialogOpen || gradingScales.length === 0) return
    const parsed = dec.safeParse(watchedNumericalGrade ?? '')
    if (!parsed.success) return
    const grade = Number(parsed.data.replace(',', '.'))
    if (!Number.isFinite(grade)) return
    const scaleId = matchGradingScaleId(grade, gradingScales)
    const next = scaleId ?? ''
    if (form.getValues('performance_level') !== next) {
      form.setValue('performance_level', next, { shouldDirty: true })
    }
  }, [
    dialogOpen,
    watchedNumericalGrade,
    gradingScales,
    form.getValues,
    form.setValue,
  ])

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<Grade>('/api/grades/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
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
    }) => apiClient.patch<Grade>(`/api/grades/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/grades/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    setDialogYearId(filterYearId ?? academicYears[0]?.id ?? null)
    form.reset({
      student: '',
      course_assignment: '',
      academic_period: '',
      numerical_grade: '',
      performance_level: '',
      definitive_grade: '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: Grade) {
    setEditing(row)
    setFormError(null)
    form.reset({
      student: row.student,
      course_assignment: row.course_assignment,
      academic_period: row.academic_period,
      numerical_grade: String(row.numerical_grade),
      performance_level: row.performance_level ?? '',
      definitive_grade: row.definitive_grade
        ? String(row.definitive_grade)
        : '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setDialogYearId(null)
    setFormError(null)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const body = bodyFromValues(values)
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

  const yearLabel = (y: AcademicYear) => String(y.year)

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title="Calificaciones"
          subtitle="Notas numéricas por estudiante, asignación y período."
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId || academicYears.length === 0}
        >
          Nueva calificación
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          Selecciona una institución para usar años y escalas.
        </Alert>
      ) : null}

      <Paper className="p-3 flex flex-wrap gap-2 items-end">
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
          Buscar
        </Button>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Año (filtro)</InputLabel>
          <Select
            label="Año (filtro)"
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterPeriodId(null)
              setFilterAssignmentId(null)
            }}
          >
            <MenuItem value="">(todos)</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>Período</InputLabel>
          <Select
            label="Período"
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">(todos)</MenuItem>
            {periodsForFilter.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl
          size="small"
          sx={{ minWidth: 200 }}
          disabled={!filterYearId}
        >
          <InputLabel>Asignación</InputLabel>
          <Select
            label="Asignación"
            value={filterAssignmentId ?? ''}
            onChange={(e) =>
              setFilterAssignmentId(
                e.target.value === '' ? null : e.target.value,
              )
            }
          >
            <MenuItem value="">(todas)</MenuItem>
            {assignmentsForFilter.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.subject_name} — {a.group_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Estudiante</TableCell>
              <TableCell>Asignación (id)</TableCell>
              <TableCell>Nota</TableCell>
              <TableCell>Nivel</TableCell>
              <TableCell align="right" width={100}>
                Acciones
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Sin registros.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.student_name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.course_assignment.slice(0, 8)}…
                  </TableCell>
                  <TableCell>{row.numerical_grade}</TableCell>
                  <TableCell>{row.performance_level_name ?? '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label="editar"
                      size="small"
                      onClick={() => openEdit(row)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label="eliminar"
                      size="small"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? 'Editar calificación' : 'Nueva calificación'}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {!editing ? (
              <FormControl fullWidth required>
                <InputLabel>Año lectivo (formulario)</InputLabel>
                <Select
                  label="Año lectivo (formulario)"
                  value={dialogYearId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDialogYearId(v === '' ? null : v)
                    form.setValue('course_assignment', '')
                    form.setValue('academic_period', '')
                  }}
                >
                  {academicYears.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {yearLabel(y)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            {!editing ? (
              <Box className="flex flex-col gap-1">
                <Box className="flex gap-2 items-end">
                  <TextField
                    size="small"
                    label="Buscar estudiante"
                    fullWidth
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        setAppliedStudentSearch(studentSearchInput)
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setAppliedStudentSearch(studentSearchInput)
                    }
                  >
                    Buscar
                  </Button>
                </Box>
                <Controller
                  name="student"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      options={studentOptions}
                      getOptionKey={(o: Student) => o.id}
                      getOptionLabel={(o: Student) => o.full_name}
                      value={
                        studentOptions.find((s) => s.id === field.value) ??
                        null
                      }
                      onChange={(_, v) => field.onChange(v?.id ?? '')}
                      renderInput={(params: AutocompleteRenderInputParams) => (
                        <TextField
                          {...params}
                          label="Estudiante"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                  )}
                />
              </Box>
            ) : (
              <TextField
                label="Estudiante"
                value={editing.student_name}
                disabled
                fullWidth
              />
            )}
            <Controller
              name="course_assignment"
              control={form.control}
              render={({ field, fieldState }) => {
                const assignmentHint = (() => {
                  if (!dialogYearId) return undefined
                  if (!editing && !dialogStudentId) {
                    return 'Selecciona un estudiante para ver las asignaturas de su grupo matriculado.'
                  }
                  if (dialogStudentId && enrollmentsLoading) {
                    return 'Cargando matrícula…'
                  }
                  if (
                    !enrollmentsLoading &&
                    dialogStudentId &&
                    enrollmentsForDialog.length === 0
                  ) {
                    return 'No hay matrícula activa en este año lectivo.'
                  }
                  if (
                    !enrollmentsLoading &&
                    dialogStudentId &&
                    enrollmentsForDialog.length > 0 &&
                    assignmentsForDialogScoped.length === 0
                  ) {
                    return 'No hay asignaciones docentes para el grupo del estudiante.'
                  }
                  return undefined
                })()
                const assignmentDisabled = !!(
                  !dialogYearId ||
                  enrollmentsLoading ||
                  (!editing && !dialogStudentId) ||
                  (dialogStudentId &&
                    !enrollmentsLoading &&
                    assignmentsForDialogScoped.length === 0)
                )
                const helperParts = [
                  fieldState.error?.message,
                  assignmentHint,
                ].filter(Boolean)
                return (
                  <Autocomplete
                    options={assignmentsForDialogScoped}
                    getOptionKey={(a: CourseAssignment) => a.id}
                    getOptionLabel={(a: CourseAssignment) =>
                      `${a.subject_name} — ${a.group_name}`
                    }
                    value={
                      assignmentsForDialogScoped.find(
                        (a) => a.id === field.value,
                      ) ??
                      assignmentsForDialog.find((a) => a.id === field.value) ??
                      null
                    }
                    onChange={(_, v) => field.onChange(v?.id ?? '')}
                    disabled={assignmentDisabled}
                    renderInput={(params: AutocompleteRenderInputParams) => (
                      <TextField
                        {...params}
                        label="Asignación docente–curso"
                        error={!!fieldState.error}
                        helperText={
                          helperParts.length > 0
                            ? helperParts.join(' ')
                            : undefined
                        }
                        required
                      />
                    )}
                  />
                )
              }}
            />
            <Controller
              name="academic_period"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl
                  fullWidth
                  error={!!fieldState.error}
                  required
                  disabled={!dialogYearId}
                >
                  <InputLabel>Período</InputLabel>
                  <Select
                    label="Período"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {periodsForDialog.map((p: AcademicPeriod) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              label="Nota numérica"
              fullWidth
              required
              {...form.register('numerical_grade')}
              error={!!form.formState.errors.numerical_grade}
              helperText={form.formState.errors.numerical_grade?.message}
            />
            <Controller
              name="performance_level"
              control={form.control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Escala (opcional)</InputLabel>
                  <Select
                    label="Escala (opcional)"
                    value={field.value || ''}
                    onChange={(e) => {
                      const v = String(e.target.value)
                      field.onChange(v === '' ? '' : v)
                    }}
                  >
                    <MenuItem value="">(ninguna)</MenuItem>
                    {gradingScales.map((s: GradingScale) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}{' '}
                        <span className="text-gray-500 text-xs">
                          ({s.min_score}–{s.max_score})
                        </span>
                      </MenuItem>
                    ))}
                  </Select>
                  {gradingScales.length > 0 ? (
                    <span className="text-xs text-gray-500 px-3.5 pt-0.5 block">
                      Se elige automáticamente según la nota y los rangos de cada
                      nivel; puedes cambiarla manualmente.
                    </span>
                  ) : null}
                </FormControl>
              )}
            />
            <TextField
              label="Nota definitiva (opcional)"
              fullWidth
              {...form.register('definitive_grade')}
              error={!!form.formState.errors.definitive_grade}
              helperText={form.formState.errors.definitive_grade?.message}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancelar</Button>
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
        <DialogTitle>Eliminar calificación</DialogTitle>
        <DialogContent>
          ¿Eliminar la nota de {deleteTarget?.student_name}?
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
