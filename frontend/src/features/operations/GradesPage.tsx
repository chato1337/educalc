import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
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
  Tooltip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  type GridSortModel,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { resolvedAppRole } from '@/app/roleMatrix'
import { useTranslation } from 'react-i18next'
import {
  Controller,
  useForm,
  useWatch,
  type Resolver,
} from 'react-hook-form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { fetchMe } from '@/features/auth/meApi'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { createServerSortHandlers } from '@/lib/dataGridServerSort'
import { PageHeader } from '@/components/PageHeader'
import { GradesByGroupModal } from '@/features/operations/GradesByGroupModal'
import {
  useAcademicAreasQuery,
  useAcademicYearsQuery,
} from '@/features/academic-structure/academicQueries'
import {
  useAcademicPeriodsForYear,
  useCourseAssignmentsList,
  useGradingScalesForInstitution,
  useGroupsForFilters,
  useStudentsSearch,
  useTeacherCourseAssignments,
} from '@/features/operations/operationsQueries'
import { useTeacherScopeListDefaults } from '@/features/operations/useTeacherScopeListDefaults'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicPeriod,
  AcademicYear,
  CourseAssignment,
  Enrollment,
  Grade,
  GradingScale,
  Group,
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

type GradeRow = Grade & {
  student_document_number: string
  student_document_type: string
  course_assignment_subject_name: string
  course_assignment_subject_emphasis: string
  course_assignment_teacher_name: string
  course_assignment_group_name: string
  course_assignment_academic_year_year: number
  academic_period_name: string
  academic_period_number: number
}

const gradeListSortHandlers = createServerSortHandlers({
  student_name: 'student__full_name',
  academic_period_name: 'academic_period__name',
  numerical_grade: 'numerical_grade',
})

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

/** Lista desplegable: grado, sección, sede y año para distinguir filas. */
function groupFilterMenuLabel(g: Group): string {
  const grade = g.grade_level_name?.trim() ?? ''
  const name = g.name?.trim() ?? ''
  const campus = g.campus_name?.trim() ?? ''
  const year =
    g.academic_year_year != null ? String(g.academic_year_year) : ''
  let head = ''
  if (grade && name) head = `${grade} — ${name}`
  else head = name || grade || '—'
  const extras = [campus, year].filter(Boolean)
  if (extras.length === 0) return head
  return `${head} (${extras.join(' · ')})`
}

/** Valor cerrado del Select: compacto; sede y nombre largo solo en tooltip / lista. */
function groupFilterCompactLabel(g: Group): string {
  const grade = g.grade_level_name?.trim() ?? ''
  const name = g.name?.trim() ?? ''
  const year =
    g.academic_year_year != null ? String(g.academic_year_year) : ''
  if (grade && name) {
    return year ? `${grade} — ${name} · ${year}` : `${grade} — ${name}`
  }
  return name || grade || '—'
}

function getDocumentTypeAbbr(documentType: string): string {
  const normalized = documentType.trim()
  if (!normalized) return ''
  const [left] = normalized.split(':', 1)
  return left.trim()
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

export function GradesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [filterAssignmentId, setFilterAssignmentId] = useState<string | null>(
    null,
  )
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null)
  const [filterAcademicAreaId, setFilterAcademicAreaId] = useState<string | null>(
    null,
  )
  const [filterStudentDocExact, setFilterStudentDocExact] = useState('')
  const [filterTeacherDocExact, setFilterTeacherDocExact] = useState('')
  const [filterPeriodNumberExact, setFilterPeriodNumberExact] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [byGroupModalOpen, setByGroupModalOpen] = useState(false)
  const [dialogYearId, setDialogYearId] = useState<string | null>(null)
  const [editing, setEditing] = useState<GradeRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GradeRow | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(
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
  const { data: academicAreas = [] } = useAcademicAreasQuery(
    selectedInstitutionId,
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
    setFilterGroupId,
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

  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )
  const { data: assignmentsForFilter = [] } = useCourseAssignmentsList(
    { academic_year: filterYearId ?? undefined },
    { enabled: !!filterYearId },
  )

  const { data: groupsForFilter = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: filterYearId ?? undefined },
    undefined,
    { enabled: !!selectedInstitutionId },
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    course_assignment: filterAssignmentId ?? undefined,
    course_assignment__group: filterGroupId ?? undefined,
    course_assignment__subject__academic_area:
      filterAcademicAreaId ?? undefined,
    search: appliedSearch.trim() || undefined,
    student__document_number: filterStudentDocExact.trim() || undefined,
    course_assignment__teacher__document_number:
      filterTeacherDocExact.trim() || undefined,
    academic_period__number: filterPeriodNumberExact.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<GradeRow>({
    queryKey: queryKeys.grades(listParams),
    url: '/api/grades/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const sortModel = useMemo(
    () => gradeListSortHandlers.orderingToSortModel(ordering),
    [ordering],
  )
  const dataGridLocaleText = useMuiDataGridLocaleText()
  const handleSortModelChange = useCallback((model: GridSortModel) => {
    setOrdering(gradeListSortHandlers.sortModelToOrdering(model))
  }, [])

  const { data: gradingScales = [] } = useGradingScalesForInstitution(
    selectedInstitutionId,
  )
  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)

  const { data: periodsForDialog = [] } = useAcademicPeriodsForYear(
    dialogOpen ? dialogYearId : null,
  )

  const { data: editingDialogCourseAssignment, isLoading: editingDialogCourseAssignmentLoading } =
    useQuery({
      queryKey: ['course-assignments', 'detail', editing?.course_assignment ?? ''],
      queryFn: async () => {
        const { data } = await apiClient.get<CourseAssignment>(
          `/api/course-assignments/${editing!.course_assignment}/`,
        )
        return data
      },
      enabled: dialogOpen && !!editing?.course_assignment,
    })

  useEffect(() => {
    const y = editingDialogCourseAssignment?.academic_year
    if (!y || !editing) return
    setDialogYearId(y)
  }, [editing, editingDialogCourseAssignment?.academic_year])

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
    queryFn: async () =>
      fetchReferenceListResults<Enrollment>('/api/enrollments/', {
        params: {
          student: dialogStudentId,
          academic_year: dialogYearId!,
          status: 'active',
        },
      }),
    enabled: needStudentEnrollments,
  })
  const enrollmentsForDialog = enrollmentsRaw ?? []

  const enrollmentGroupIds = useMemo(() => {
    const ids = [...new Set(enrollmentsForDialog.map((e) => e.group))]
    ids.sort()
    return ids
  }, [enrollmentsForDialog])

  const dialogCourseListParams = useMemo(
    () => ({
      academic_year: dialogYearId ?? undefined,
      group__in:
        enrollmentGroupIds.length > 0
          ? enrollmentGroupIds.join(',')
          : undefined,
    }),
    [dialogYearId, enrollmentGroupIds],
  )

  const fetchDialogAssignmentsByGroups =
    dialogOpen &&
    !!dialogYearId &&
    !!dialogStudentId &&
    !enrollmentsLoading &&
    enrollmentGroupIds.length > 0

  const {
    data: assignmentsForDialogByGroup = [],
    isLoading: assignmentsForDialogByGroupLoading,
  } = useCourseAssignmentsList(dialogCourseListParams, {
    enabled: fetchDialogAssignmentsByGroups,
  })

  const dialogAssignmentsLoading =
    enrollmentsLoading ||
    (fetchDialogAssignmentsByGroups && assignmentsForDialogByGroupLoading) ||
    (!!editing?.course_assignment && editingDialogCourseAssignmentLoading)

  const assignmentsForDialogScoped = useMemo(() => {
    if (!dialogOpen || !dialogYearId) return []
    const fromGroups = assignmentsForDialogByGroup
    const extra = editingDialogCourseAssignment

    if (!editing) {
      if (!dialogStudentId || enrollmentsLoading) return []
      if (enrollmentGroupIds.length === 0) return []
      return fromGroups
    }

    if (enrollmentsLoading) {
      return extra ? [extra] : []
    }
    if (enrollmentGroupIds.length === 0) {
      return extra ? [extra] : []
    }
    if (extra && !fromGroups.some((a) => a.id === extra.id)) {
      return [extra, ...fromGroups]
    }
    return fromGroups
  }, [
    dialogOpen,
    dialogYearId,
    editing,
    dialogStudentId,
    enrollmentsLoading,
    enrollmentGroupIds.length,
    assignmentsForDialogByGroup,
    editingDialogCourseAssignment,
  ])

  useEffect(() => {
    if (!dialogOpen || editing) return
    if (!dialogStudentId) {
      if (form.getValues('course_assignment')) {
        form.setValue('course_assignment', '')
      }
      return
    }
    if (enrollmentsLoading || dialogAssignmentsLoading) return
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
    dialogAssignmentsLoading,
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

  useEffect(() => {
    if (!dialogOpen || !!editing) return
    if (!appliedStudentSearch.trim()) return
    if (studentOptions.length !== 1) return
    const only = studentOptions[0]
    if (!only?.id) return
    if (form.getValues('student') !== only.id) {
      form.setValue('student', only.id, { shouldDirty: true })
    }
  }, [
    dialogOpen,
    editing,
    appliedStudentSearch,
    studentOptions,
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

  const openEdit = useCallback(
    (row: GradeRow) => {
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
    },
    [form],
  )

  const columns = useMemo<GridColDef<GradeRow>[]>(
    () => [
      {
        field: 'student_name',
        headerName: t('grades.student'),
        flex: 1,
        minWidth: 160,
        sortable: true,
      },
      {
        field: 'document',
        headerName: t('grades.document'),
        minWidth: 140,
        flex: 0.7,
        sortable: false,
        valueGetter: (_v, row) =>
          `${getDocumentTypeAbbr(row.student_document_type)} ${row.student_document_number}`.trim(),
      },
      {
        field: 'subject',
        headerName: t('grades.subject'),
        flex: 1,
        minWidth: 160,
        sortable: false,
        valueGetter: (_v, row) => {
          const em = row.course_assignment_subject_emphasis
          const base = row.course_assignment_subject_name
          return em ? `${base} (${em})` : base
        },
      },
      {
        field: 'course_assignment_group_name',
        headerName: t('grades.group'),
        flex: 0.7,
        minWidth: 100,
        sortable: false,
      },
      {
        field: 'course_assignment_teacher_name',
        headerName: t('grades.teacher'),
        flex: 0.8,
        minWidth: 120,
        sortable: false,
      },
      {
        field: 'academic_period_name',
        headerName: t('grades.period'),
        minWidth: 160,
        flex: 0.9,
        sortable: true,
        valueGetter: (_v, row) =>
          `${row.academic_period_name} (${row.course_assignment_academic_year_year})`,
      },
      {
        field: 'numerical_grade',
        headerName: t('grades.grade'),
        width: 100,
        sortable: true,
      },
      {
        field: 'performance_level_name',
        headerName: t('grades.level'),
        flex: 0.6,
        minWidth: 100,
        sortable: false,
        valueFormatter: (value: string | null | undefined) =>
          value == null || value === '' ? '-' : String(value),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<GradeRow>) => [
          <IconButton
            key="edit"
            aria-label={t('grades.edit')}
            size="small"
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            aria-label={t('grades.delete')}
            size="small"
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
          title={t('grades.title')}
          subtitle={t('grades.subtitle')}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {effectiveRole === 'TEACHER' &&
          me?.teacher_id &&
          (teacherAssignments?.length ?? 0) > 0 ? (
            <Button
              variant="outlined"
              onClick={() => setByGroupModalOpen(true)}
              disabled={!selectedInstitutionId}
            >
              {t('grades.addByGroup')}
            </Button>
          ) : null}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={!selectedInstitutionId || academicYears.length === 0}
          >
            {t('grades.new')}
          </Button>
        </Stack>
      </Box>

      <GradesByGroupModal
        open={byGroupModalOpen}
        onClose={() => setByGroupModalOpen(false)}
        teacherAssignments={teacherAssignments ?? []}
        gradingScales={gradingScales}
      />

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('grades.selectInstitution')}
        </Alert>
      ) : null}

      <Paper
        className="p-3"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 1.5,
          columnGap: 2,
          rowGap: 1.25,
        }}
      >
        <TextField
          size="small"
          label={t('common.search')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setAppliedSearch(searchInput)
          }}
          sx={{ minWidth: 160, flex: '1 1 160px', maxWidth: 280 }}
        />
        <Button
          variant="outlined"
          startIcon={<SearchIcon />}
          onClick={() => setAppliedSearch(searchInput)}
          sx={{ mt: 0.25 }}
        >
          {t('common.search')}
        </Button>
        <FormControl
          size="small"
          sx={{ minWidth: 120, width: 140, flex: '0 0 auto' }}
        >
          <InputLabel>{t('grades.yearFilter')}</InputLabel>
          <Select
            label={t('grades.yearFilter')}
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterPeriodId(null)
              setFilterAssignmentId(null)
              setFilterGroupId(null)
              setFilterAcademicAreaId(null)
            }}
          >
            <MenuItem value="">{t('grades.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.25,
            minWidth: 200,
            flex: '1 1 220px',
            maxWidth: { xs: '100%', sm: 300 },
          }}
        >
          <FormControl
            size="small"
            fullWidth
            disabled={!selectedInstitutionId}
            sx={{ minWidth: 0 }}
          >
            <InputLabel id="grades-group-filter-label" shrink>
              {t('grades.groupFilter')}
            </InputLabel>
            <Select
              labelId="grades-group-filter-label"
              label={t('grades.groupFilter')}
              notched
              value={filterGroupId ?? ''}
              onChange={(e) =>
                setFilterGroupId(e.target.value === '' ? null : e.target.value)
              }
              displayEmpty
              renderValue={(selected) => {
                if (selected == null || selected === '') {
                  return (
                    <Typography variant="body2" color="text.secondary">
                      {t('grades.all')}
                    </Typography>
                  )
                }
                const g = groupsForFilter.find((x) => x.id === selected)
                if (!g) return selected
                const full = groupFilterMenuLabel(g)
                const short = groupFilterCompactLabel(g)
                return (
                  <Typography
                    component="span"
                    variant="body2"
                    noWrap
                    title={full}
                    sx={{ display: 'block', maxWidth: '100%' }}
                  >
                    {short}
                  </Typography>
                )
              }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
            >
              <MenuItem value="">{t('grades.all')}</MenuItem>
              {groupsForFilter.map((g) => (
                <MenuItem key={g.id} value={g.id} title={groupFilterMenuLabel(g)}>
                  {groupFilterMenuLabel(g)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title={t('grades.groupFilterHint')} placement="top" arrow>
            <IconButton
              size="small"
              aria-label={t('grades.groupFilterInfoAria')}
              sx={{ mt: '3px', color: 'text.secondary' }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <FormControl size="small" sx={{ minWidth: 170 }} disabled={!selectedInstitutionId}>
          <InputLabel>{t('grades.academicArea')}</InputLabel>
          <Select
            label={t('grades.academicArea')}
            value={filterAcademicAreaId ?? ''}
            onChange={(e) =>
              setFilterAcademicAreaId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('grades.all')}</MenuItem>
            {academicAreaFilterOptions.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>{t('grades.period')}</InputLabel>
          <Select
            label={t('grades.period')}
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('grades.all')}</MenuItem>
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
          <InputLabel>{t('grades.assignment')}</InputLabel>
          <Select
            label={t('grades.assignment')}
            value={filterAssignmentId ?? ''}
            onChange={(e) =>
              setFilterAssignmentId(
                e.target.value === '' ? null : e.target.value,
              )
            }
          >
            <MenuItem value="">{t('grades.allFem')}</MenuItem>
            {assignmentsForFilter.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.subject_name} — {a.group_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label={t('grades.studentDocExact')}
          value={filterStudentDocExact}
          onChange={(e) => setFilterStudentDocExact(e.target.value)}
        />
        <TextField
          size="small"
          label={t('grades.teacherDocExact')}
          value={filterTeacherDocExact}
          onChange={(e) => setFilterTeacherDocExact(e.target.value)}
        />
        <TextField
          size="small"
          label={t('grades.periodNumberExact')}
          value={filterPeriodNumberExact}
          onChange={(e) => setFilterPeriodNumberExact(e.target.value)}
          sx={{ maxWidth: 180 }}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('grades.order')}</InputLabel>
          <Select
            label={t('grades.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('grades.defaultOrder')}</MenuItem>
            <MenuItem value="student__full_name">{t('grades.studentAsc')}</MenuItem>
            <MenuItem value="-student__full_name">{t('grades.studentDesc')}</MenuItem>
            <MenuItem value="academic_period__name">{t('grades.periodAsc')}</MenuItem>
            <MenuItem value="-academic_period__name">{t('grades.periodDesc')}</MenuItem>
            <MenuItem value="numerical_grade">{t('grades.gradeAsc')}</MenuItem>
            <MenuItem value="-numerical_grade">{t('grades.gradeDesc')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setFilterYearId(null)
            setFilterPeriodId(null)
            setFilterAssignmentId(null)
            setFilterGroupId(null)
            setFilterAcademicAreaId(null)
            setFilterStudentDocExact('')
            setFilterTeacherDocExact('')
            setFilterPeriodNumberExact('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('grades.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
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
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          sortingOrder={['asc', 'desc', null]}
          localeText={dataGridLocaleText}
          sx={{
            ...dataGridDefaultSx,
            '& .MuiDataGrid-cell[data-field="document"], & .MuiDataGrid-cell[data-field="academic_period_name"]':
              { whiteSpace: 'nowrap' },
          }}
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
          {editing ? t('grades.editGrade') : t('grades.newGrade')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {!editing ? (
              <FormControl fullWidth required>
                <InputLabel>{t('grades.yearForm')}</InputLabel>
                <Select
                  label={t('grades.yearForm')}
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
                    label={t('grades.searchStudent')}
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
                <Box
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    fontSize: 12,
                    px: 0.25,
                  }}
                >
                  Busca por documento o nombre/apellidos del estudiante. Si la
                  búsqueda devuelve un único resultado, se selecciona
                  automáticamente.
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
                          label={t('grades.student')}
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
                label={t('grades.student')}
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
                    dialogStudentId &&
                    !enrollmentsLoading &&
                    dialogAssignmentsLoading
                  ) {
                    return 'Cargando asignaciones docente-curso…'
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
                    !dialogAssignmentsLoading &&
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
                  dialogAssignmentsLoading ||
                  (!editing && !dialogStudentId) ||
                  (dialogStudentId &&
                    !dialogAssignmentsLoading &&
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
                      ) ?? null
                    }
                    onChange={(_, v) => field.onChange(v?.id ?? '')}
                    disabled={assignmentDisabled}
                    renderInput={(params: AutocompleteRenderInputParams) => (
                      <TextField
                        {...params}
                        label={t('grades.teacherCourseAssignment')}
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
                  <InputLabel>{t('grades.period')}</InputLabel>
                  <Select
                    label={t('grades.period')}
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
              label={t('grades.numericalGrade')}
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
                  <InputLabel>{t('grades.scaleOptional')}</InputLabel>
                  <Select
                    label={t('grades.scaleOptional')}
                    value={field.value || ''}
                    onChange={(e) => {
                      const v = String(e.target.value)
                      field.onChange(v === '' ? '' : v)
                    }}
                  >
                    <MenuItem value="">{t('grades.noneScale')}</MenuItem>
                    {gradingScales.map((s: GradingScale) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}{' '}
                        <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                          ({s.min_score}–{s.max_score})
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {gradingScales.length > 0 ? (
                    <Box
                      component="span"
                      sx={{
                        color: 'text.secondary',
                        fontSize: 12,
                        px: 1.75,
                        pt: 0.5,
                        display: 'block',
                      }}
                    >
                      {t('grades.scaleHelp')}
                    </Box>
                  ) : null}
                </FormControl>
              )}
            />
            <TextField
              label={t('grades.finalGradeOptional')}
              fullWidth
              {...form.register('definitive_grade')}
              error={!!form.formState.errors.definitive_grade}
              helperText={form.formState.errors.definitive_grade?.message}
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
        <DialogTitle>{t('grades.deleteGrade')}</DialogTitle>
        <DialogContent>
          {t('grades.deletePrompt', { student: deleteTarget?.student_name ?? '' })}
        </DialogContent>
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
