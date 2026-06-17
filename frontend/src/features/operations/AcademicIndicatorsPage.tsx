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
  TextField,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { resolvedAppRole } from '@/app/roleMatrix'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { PageHeader } from '@/components/PageHeader'
import {
  useAcademicAreasQuery,
  useAcademicIndicatorCatalogsQuery,
  useAcademicYearsQuery,
} from '@/features/academic-structure/academicQueries'
import { fetchMe } from '@/features/auth/meApi'
import {
  useAcademicPeriodsForYear,
  useCourseAssignmentsList,
  useStudentsSearch,
  useTeacherCourseAssignments,
} from '@/features/operations/operationsQueries'
import { useTeacherScopeListDefaults } from '@/features/operations/useTeacherScopeListDefaults'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicIndicator,
  AcademicIndicatorCatalog,
  AcademicPeriod,
  AcademicYear,
  CourseAssignment,
  Student,
} from '@/types/schemas'

const schema = z.object({
  student: z.string().uuid(),
  course_assignment: z.string().uuid(),
  academic_period: z.string().uuid(),
  catalog: z.string().uuid().nullable(),
  numerical_grade: z.string().optional(),
  performance_level: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function clip(text: string, max: number) {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function assignmentLabel(ca: CourseAssignment) {
  return `${ca.subject_name} · ${ca.group_name} · ${ca.teacher_name}`
}

function catalogOptionLabel(c: AcademicIndicatorCatalog) {
  const period =
    c.period_label && c.period_label !== 'Todos' ? ` / ${c.period_label}` : ''
  return `${c.academic_area_name} / ${c.grade_level_name}${period}`
}

function pickDefaultPeriodId(periods: AcademicPeriod[]): string | null {
  const p1 = periods.find((p) => p.number === 1)
  return p1?.id ?? periods[0]?.id ?? null
}

function catalogMatchesPeriod(
  catalog: AcademicIndicatorCatalog,
  periodNumber: number,
) {
  return (
    catalog.period_number == null || Number(catalog.period_number) === periodNumber
  )
}

export function AcademicIndicatorsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [filterAcademicAreaId, setFilterAcademicAreaId] = useState<string | null>(
    null,
  )
  const [filterTeacherDocExact, setFilterTeacherDocExact] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogYearId, setDialogYearId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AcademicIndicator | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicIndicator | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(selectedInstitutionId)
  const { data: academicAreas = [] } = useAcademicAreasQuery(selectedInstitutionId)
  const { data: indicatorCatalogs = [] } = useAcademicIndicatorCatalogsQuery(
    selectedInstitutionId,
  )

  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  })
  const effectiveRole = useMemo(
    () => resolvedAppRole(me?.role ?? null),
    [me?.role],
  )
  const { data: teacherAssignments } = useTeacherCourseAssignments(
    me?.teacher_id,
    {
      enabled:
        effectiveRole === 'TEACHER' &&
        Boolean(me?.teacher_id) &&
        Boolean(selectedInstitutionId),
    },
  )

  useTeacherScopeListDefaults(
    effectiveRole,
    me?.teacher_id,
    selectedInstitutionId,
    academicYears,
    teacherAssignments,
    setFilterYearId,
    setFilterTeacherDocExact,
    setFilterAcademicAreaId,
    () => {},
  )

  const academicAreaFilterOptions = useMemo(() => {
    if (effectiveRole !== 'TEACHER' || !teacherAssignments?.length) {
      return academicAreas
    }
    const ids = new Set(
      teacherAssignments.map((a) => a.subject_academic_area),
    )
    return academicAreas.filter((a) => ids.has(a.id))
  }, [academicAreas, effectiveRole, teacherAssignments])

  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(filterYearId)

  useEffect(() => {
    if (!filterYearId || filterPeriodId || periodsForFilter.length === 0) return
    const defaultPeriodId = pickDefaultPeriodId(periodsForFilter)
    if (defaultPeriodId) setFilterPeriodId(defaultPeriodId)
  }, [filterYearId, filterPeriodId, periodsForFilter])

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    academic_period__academic_year: filterYearId ?? undefined,
    course_assignment__subject__institution: selectedInstitutionId ?? undefined,
    course_assignment__subject__academic_area:
      filterAcademicAreaId ?? undefined,
    course_assignment__teacher__document_number:
      filterTeacherDocExact.trim() || undefined,
    search: appliedSearch || undefined,
  }

  const listQuery = useInfiniteList<AcademicIndicator>({
    queryKey: queryKeys.academicIndicators(listParams),
    url: '/api/academic-indicators/',
    params: listParams,
    enabled: !!selectedInstitutionId,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

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
      catalog: null,
      numerical_grade: '',
      performance_level: '',
      description: '',
    },
  })

  const watchedAssignmentId = form.watch('course_assignment')
  const watchedPeriodId = form.watch('academic_period')

  useEffect(() => {
    if (!dialogOpen || editing || !dialogYearId || periodsForDialog.length === 0) {
      return
    }
    if (form.getValues('academic_period')) return
    const defaultPeriodId = pickDefaultPeriodId(periodsForDialog)
    if (defaultPeriodId) form.setValue('academic_period', defaultPeriodId)
  }, [dialogOpen, dialogYearId, editing, form, periodsForDialog])

  const matchingCatalogs = useMemo(() => {
    const assignment = assignmentsForDialog.find(
      (a) => a.id === watchedAssignmentId,
    )
    const period = periodsForDialog.find((p) => p.id === watchedPeriodId)
    if (!assignment || !period) return []
    return indicatorCatalogs
      .filter(
        (c) =>
          c.academic_area === assignment.subject_academic_area &&
          c.grade_level === assignment.group_grade_level &&
          catalogMatchesPeriod(c, period.number),
      )
      .sort((a, b) => {
        const aSpecific = a.period_number != null ? 0 : 1
        const bSpecific = b.period_number != null ? 0 : 1
        return aSpecific - bSpecific
      })
  }, [
    assignmentsForDialog,
    indicatorCatalogs,
    periodsForDialog,
    watchedAssignmentId,
    watchedPeriodId,
  ])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['academic-indicators'] })
  }

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicIndicator>('/api/academic-indicators/', body),
    onSuccess: () => {
      invalidate()
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
      apiClient.patch<AcademicIndicator>(`/api/academic-indicators/${id}/`, body),
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/academic-indicators/${id}/`),
    onSuccess: () => {
      invalidate()
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
      academic_period: filterPeriodId ?? '',
      catalog: null,
      numerical_grade: '',
      performance_level: '',
      description: '',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: AcademicIndicator) => {
      setEditing(row)
      setFormError(null)
      setDialogYearId(null)
      form.reset({
        student: row.student,
        course_assignment: row.course_assignment,
        academic_period: row.academic_period,
        catalog: row.catalog ?? null,
        numerical_grade: row.numerical_grade ?? '',
        performance_level: row.performance_level ?? '',
        description: row.description ?? '',
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<AcademicIndicator>[]>(
    () => [
      {
        field: 'student_name',
        headerName: t('academicIndicatorsOps.student'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'catalog_label',
        headerName: t('academicIndicatorsOps.catalog'),
        width: 180,
        sortable: false,
        valueFormatter: (v: string | null | undefined) => v || '—',
      },
      {
        field: 'numerical_grade',
        headerName: t('academicIndicatorsOps.numericalGrade'),
        width: 90,
        sortable: false,
        valueFormatter: (v: string | null | undefined) => v ?? '—',
      },
      {
        field: 'description',
        headerName: t('academicIndicatorsOps.description'),
        flex: 1,
        minWidth: 200,
        sortable: false,
        valueFormatter: (v: string | null | undefined) =>
          clip(String(v ?? ''), 80),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<AcademicIndicator>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('academicIndicatorsOps.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('academicIndicatorsOps.delete')}
            onClick={() => setDeleteTarget(params.row)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>,
        ],
      },
    ],
    [openEdit, t],
  )

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setDialogYearId(null)
    setFormError(null)
  }

  function buildBody(values: FormValues): Record<string, unknown> {
    return {
      student: values.student,
      course_assignment: values.course_assignment,
      academic_period: values.academic_period,
      catalog: values.catalog,
      numerical_grade: values.numerical_grade?.trim() || null,
      performance_level: values.performance_level?.trim() || '',
      description: values.description?.trim() || '',
    }
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const body = buildBody(values)
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
          title={t('academicIndicatorsOps.title')}
          subtitle={t('academicIndicatorsOps.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId || academicYears.length === 0}
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
          {t('common.apply')}
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
            {periodsForFilter.map((p: AcademicPeriod) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }} disabled={!selectedInstitutionId}>
          <InputLabel>{t('academicIndicatorsOps.academicArea')}</InputLabel>
          <Select
            label={t('academicIndicatorsOps.academicArea')}
            value={filterAcademicAreaId ?? ''}
            onChange={(e) =>
              setFilterAcademicAreaId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('academicIndicatorsOps.all')}</MenuItem>
            {academicAreaFilterOptions.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label={t('academicIndicatorsOps.teacherDocExact')}
          value={filterTeacherDocExact}
          onChange={(e) => setFilterTeacherDocExact(e.target.value)}
          sx={{ minWidth: 180 }}
        />
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      {selectedInstitutionId &&
      !isLoading &&
      !error &&
      rows.length === 0 &&
      filterYearId ? (
        <Alert severity="info">
          {t('academicIndicatorsOps.emptyForFilters')}
        </Alert>
      ) : null}

      <Paper sx={{ width: '100%', p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !isLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing
            ? t('academicIndicatorsOps.editDialog')
            : t('academicIndicatorsOps.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="student"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={studentOptions}
                  getOptionLabel={(o: Student) =>
                    `${o.full_name} (${o.document_number})`
                  }
                  value={studentOptions.find((s) => s.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  onInputChange={(_, v, reason) => {
                    if (reason === 'input') setStudentSearchInput(v)
                  }}
                  onOpen={() => {
                    if (!appliedStudentSearch && studentSearchInput) {
                      setAppliedStudentSearch(studentSearchInput)
                    }
                  }}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicIndicatorsOps.student')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      onBlur={() => setAppliedStudentSearch(studentSearchInput)}
                    />
                  )}
                />
              )}
            />
            <FormControl fullWidth size="small">
              <InputLabel>{t('academicIndicatorsOps.year')}</InputLabel>
              <Select
                label={t('academicIndicatorsOps.year')}
                value={dialogYearId ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : e.target.value
                  setDialogYearId(v)
                  form.setValue('course_assignment', '')
                  form.setValue('academic_period', '')
                  form.setValue('catalog', null)
                }}
                disabled={!!editing}
              >
                {academicYears.map((y) => (
                  <MenuItem key={y.id} value={y.id}>
                    {yearLabel(y)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Controller
              name="course_assignment"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={assignmentsForDialog}
                  getOptionLabel={assignmentLabel}
                  value={
                    assignmentsForDialog.find((a) => a.id === field.value) ??
                    null
                  }
                  onChange={(_, v) => {
                    field.onChange(v?.id ?? '')
                    form.setValue('catalog', null)
                  }}
                  disabled={!!editing || !dialogYearId}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicIndicatorsOps.courseAssignment')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_period"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error}>
                  <InputLabel>{t('academicIndicatorsOps.period')}</InputLabel>
                  <Select
                    label={t('academicIndicatorsOps.period')}
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      form.setValue('catalog', null)
                    }}
                    disabled={!!editing || !dialogYearId}
                  >
                    {periodsForDialog.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="catalog"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={matchingCatalogs}
                  getOptionLabel={catalogOptionLabel}
                  value={
                    matchingCatalogs.find((c) => c.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? null)}
                  disabled={!watchedAssignmentId || !watchedPeriodId}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicIndicatorsOps.catalog')}
                      helperText={t('academicIndicatorsOps.catalogHint')}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('academicIndicatorsOps.numericalGrade')}
              {...form.register('numerical_grade')}
              fullWidth
            />
            <TextField
              label={t('academicIndicatorsOps.performanceLevel')}
              {...form.register('performance_level')}
              fullWidth
            />
            <TextField
              label={t('academicIndicatorsOps.description')}
              {...form.register('description')}
              fullWidth
              multiline
              minRows={2}
              helperText={t('academicIndicatorsOps.descriptionHint')}
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('academicIndicatorsOps.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('academicIndicatorsOps.deletePrompt', {
            name: deleteTarget?.student_name ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
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
