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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import {
  useAcademicPeriodsForYear,
  useCourseAssignmentsList,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicPeriod,
  AcademicYear,
  AcademicIndicator,
  CourseAssignment,
  Student,
} from '@/types/schemas'

const decOpt = z
  .string()
  .regex(/^-?\d{0,2}(\.\d{0,2})?$/, 'Formato inválido')
  .optional()
  .or(z.literal(''))

const schema = z.object({
  student: z.string().uuid(),
  course_assignment: z.string().uuid(),
  academic_period: z.string().uuid(),
  description: z.string().trim().min(1),
  numerical_grade: decOpt,
  performance_level: z.string().max(50).optional(),
})

type FormValues = z.infer<typeof schema>

export function AcademicIndicatorsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogYearId, setDialogYearId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AcademicIndicator | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicIndicator | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    search: appliedSearch || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.academicIndicators(listParams),
    queryFn: async () => {
      const { data } = await apiClient.get<AcademicIndicator[]>(
        '/api/academic-indicators/',
        { params: listParams },
      )
      return data
    },
  })

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
      .get<CourseAssignment>(
        `/api/course-assignments/${editing.course_assignment}/`,
      )
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
      description: '',
      numerical_grade: '',
      performance_level: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicIndicator>('/api/academic-indicators/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-indicators'] })
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
    }) =>
      apiClient.patch<AcademicIndicator>(
        `/api/academic-indicators/${id}/`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-indicators'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/academic-indicators/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-indicators'] })
      setDeleteTarget(null)
    },
  })

  function toBody(v: FormValues) {
    const body: Record<string, unknown> = {
      student: v.student,
      course_assignment: v.course_assignment,
      academic_period: v.academic_period,
      description: v.description,
    }
    if (v.numerical_grade && v.numerical_grade !== '')
      body.numerical_grade = v.numerical_grade
    if (v.performance_level) body.performance_level = v.performance_level
    return body
  }

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
      description: '',
      numerical_grade: '',
      performance_level: '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: AcademicIndicator) {
    setEditing(row)
    setFormError(null)
    form.reset({
      student: row.student,
      course_assignment: row.course_assignment,
      academic_period: row.academic_period,
      description: row.description,
      numerical_grade: row.numerical_grade
        ? String(row.numerical_grade)
        : '',
      performance_level: row.performance_level ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setDialogYearId(null)
    setFormError(null)
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
          title={t('academicIndicatorsOps.title')}
          subtitle={t('academicIndicatorsOps.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={
            !selectedInstitutionId || academicYears.length === 0
          }
        >
          {t('academicIndicatorsOps.new')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('academicIndicatorsOps.selectInstitution')}
        </Alert>
      ) : null}

      <Paper className="p-3 flex flex-wrap gap-2 items-end">
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
          {t('common.search')}
        </Button>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('academicIndicatorsOps.year')}</InputLabel>
          <Select
            label={t('academicIndicatorsOps.year')}
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterPeriodId(null)
            }}
          >
            <MenuItem value="">{t('academicIndicatorsOps.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>{t('academicIndicatorsOps.period')}</InputLabel>
          <Select
            label={t('academicIndicatorsOps.period')}
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('academicIndicatorsOps.all')}</MenuItem>
            {periodsForFilter.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
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
              <TableCell>{t('academicIndicatorsOps.student')}</TableCell>
              <TableCell>{t('academicIndicatorsOps.description')}</TableCell>
              <TableCell>{t('academicIndicatorsOps.grade')}</TableCell>
              <TableCell>{t('academicIndicatorsOps.level')}</TableCell>
              <TableCell align="right" width={100} />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>{t('common.none')}</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.student_name}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {row.description}
                  </TableCell>
                  <TableCell>{row.numerical_grade ?? '-'}</TableCell>
                  <TableCell>{row.performance_level || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openEdit(row)}
                      aria-label={t('academicIndicatorsOps.edit')}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget(row)}
                      aria-label={t('academicIndicatorsOps.delete')}
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
          {editing ? t('academicIndicatorsOps.editDialog') : t('academicIndicatorsOps.newDialog')}
        </DialogTitle>
        <form
          onSubmit={form.handleSubmit((v) => {
            setFormError(null)
            const body = toBody(v)
            if (editing) {
              updateMutation.mutate({ id: editing.id, body })
            } else {
              createMutation.mutate(body)
            }
          })}
        >
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {!editing ? (
              <FormControl fullWidth required>
                <InputLabel>{t('academicIndicatorsOps.academicYear')}</InputLabel>
                <Select
                  label={t('academicIndicatorsOps.academicYear')}
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
                    label={t('academicIndicatorsOps.searchStudent')}
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
                    {t('common.search')}
                  </Button>
                </Box>
                <Controller
                  name="student"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      options={studentOptions}
                      getOptionLabel={(o: Student) => o.full_name}
                      value={
                        studentOptions.find((s) => s.id === field.value) ??
                        null
                      }
                      onChange={(_, v) => field.onChange(v?.id ?? '')}
                      renderInput={(params: AutocompleteRenderInputParams) => (
                        <TextField
                          {...params}
                          label={t('academicIndicatorsOps.student')}
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
                label={t('academicIndicatorsOps.student')}
                value={editing.student_name}
                disabled
                fullWidth
              />
            )}
            <Controller
              name="course_assignment"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={assignmentsForDialog}
                  getOptionLabel={(a: CourseAssignment) =>
                    `${a.subject_name} — ${a.group_name}`
                  }
                  value={
                    assignmentsForDialog.find((a) => a.id === field.value) ??
                    null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!dialogYearId}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicIndicatorsOps.assignment')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_period"
              control={form.control}
              render={({ field }) => (
                <FormControl fullWidth required disabled={!dialogYearId}>
                  <InputLabel>{t('academicIndicatorsOps.period')}</InputLabel>
                  <Select
                    label={t('academicIndicatorsOps.period')}
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
              label={t('academicIndicatorsOps.description')}
              fullWidth
              required
              multiline
              minRows={2}
              {...form.register('description')}
            />
            <TextField
              label={t('academicIndicatorsOps.numericalGradeOptional')}
              fullWidth
              {...form.register('numerical_grade')}
            />
            <TextField
              label={t('academicIndicatorsOps.performanceLevel')}
              fullWidth
              {...form.register('performance_level')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>{t('common.cancel')}</Button>
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
        <DialogTitle>{t('academicIndicatorsOps.deleteDialog')}</DialogTitle>
        <DialogContent>{t('academicIndicatorsOps.deletePrompt')}</DialogContent>
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
