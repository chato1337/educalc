import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRowModel,
} from '@mui/x-data-grid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import {
  fetchAllEnrollments,
  fetchAllGrades,
  useAcademicPeriodsForYear,
} from '@/features/operations/operationsQueries'
import type {
  CourseAssignment,
  Grade,
  GradingScale,
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

type BulkGradeRow = GridRowModel & {
  id: string
  studentName: string
  gradeId: string | null
  numericalGrade: string
  performanceLevelId: string | null
  performanceLevelName: string
  definitiveGrade: string
}

function parseScaleBound(s: string): number | null {
  const n = Number(String(s).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

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

function uniqueGroupsFromAssignments(
  assignments: CourseAssignment[],
): CourseAssignment[] {
  const byGroup = new Map<string, CourseAssignment>()
  for (const a of assignments) {
    if (!byGroup.has(a.group)) byGroup.set(a.group, a)
  }
  return [...byGroup.values()].sort((a, b) => {
    if (a.academic_year_year !== b.academic_year_year) {
      return b.academic_year_year - a.academic_year_year
    }
    return a.group_name.localeCompare(b.group_name, 'es')
  })
}

function groupOptionLabel(a: CourseAssignment): string {
  const y = a.academic_year_year
  const head = y ? `${a.group_name} · ${y}` : a.group_name
  if (a.campus_name?.trim()) {
    return `${head} · ${a.campus_name}`
  }
  return head
}

function buildGradeBody(args: {
  student: string
  courseAssignment: string
  academicPeriod: string
  numericalGrade: string
  gradingScales: GradingScale[]
  definitiveGrade: string
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    student: args.student,
    course_assignment: args.courseAssignment,
    academic_period: args.academicPeriod,
    numerical_grade: args.numericalGrade,
  }
  const parsed = Number(args.numericalGrade.replace(',', '.'))
  const auto =
    Number.isFinite(parsed) && args.gradingScales.length > 0
      ? matchGradingScaleId(parsed, args.gradingScales)
      : null
  if (auto) body.performance_level = auto
  if (args.definitiveGrade.trim() !== '') {
    body.definitive_grade = args.definitiveGrade.trim()
  }
  return body
}

export type GradesByGroupModalProps = {
  open: boolean
  onClose: () => void
  teacherAssignments: CourseAssignment[]
  gradingScales: GradingScale[]
}

export function GradesByGroupModal({
  open,
  onClose,
  teacherAssignments,
  gradingScales,
}: GradesByGroupModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const dataGridLocaleText = useMuiDataGridLocaleText()
  const [pickGroupId, setPickGroupId] = useState<string | null>(null)
  const [pickAssignmentId, setPickAssignmentId] = useState<string | null>(null)
  const [pickPeriodId, setPickPeriodId] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const uniqueGroups = useMemo(
    () => uniqueGroupsFromAssignments(teacherAssignments),
    [teacherAssignments],
  )

  const selectedGroupId = useMemo(() => {
    if (!open || uniqueGroups.length === 0) return ''
    if (pickGroupId && uniqueGroups.some((g) => g.group === pickGroupId)) {
      return pickGroupId
    }
    return uniqueGroups[0]!.group
  }, [open, uniqueGroups, pickGroupId])

  const assignmentsInGroup = useMemo(() => {
    if (!selectedGroupId) return []
    return teacherAssignments
      .filter((a) => a.group === selectedGroupId)
      .slice()
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name, 'es'))
  }, [teacherAssignments, selectedGroupId])

  const selectedAssignmentId = useMemo(() => {
    if (!open || assignmentsInGroup.length === 0) return ''
    if (
      pickAssignmentId &&
      assignmentsInGroup.some((a) => a.id === pickAssignmentId)
    ) {
      return pickAssignmentId
    }
    return assignmentsInGroup[0]!.id
  }, [open, assignmentsInGroup, pickAssignmentId])

  const selectedAssignment = useMemo(
    () => assignmentsInGroup.find((a) => a.id === selectedAssignmentId),
    [assignmentsInGroup, selectedAssignmentId],
  )

  const academicYearId = selectedAssignment?.academic_year ?? null

  const { data: periods = [], isFetching: periodsLoading } =
    useAcademicPeriodsForYear(open ? academicYearId : null)

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.number - b.number),
    [periods],
  )

  const selectedPeriodId = useMemo(() => {
    if (!open || sortedPeriods.length === 0) return ''
    if (pickPeriodId && sortedPeriods.some((p) => p.id === pickPeriodId)) {
      return pickPeriodId
    }
    return sortedPeriods[0]!.id
  }, [open, sortedPeriods, pickPeriodId])

  const handleClose = () => {
    setPickGroupId(null)
    setPickAssignmentId(null)
    setPickPeriodId(null)
    setSheetError(null)
    onClose()
  }

  const enrollmentsQuery = useQuery({
    queryKey: queryKeys.enrollments({
      group: selectedAssignment?.group,
      academic_year: selectedAssignment?.academic_year,
      status: 'active',
    }),
    queryFn: () =>
      fetchAllEnrollments({
        group: selectedAssignment?.group,
        academic_year: selectedAssignment?.academic_year,
        status: 'active',
      }),
    enabled:
      open &&
      Boolean(selectedAssignment?.group) &&
      Boolean(selectedAssignment?.academic_year),
  })

  const gradesQuery = useQuery({
    queryKey: queryKeys.grades({
      course_assignment: selectedAssignmentId || undefined,
      academic_period: selectedPeriodId || undefined,
    }),
    queryFn: () =>
      fetchAllGrades({
        course_assignment: selectedAssignmentId,
        academic_period: selectedPeriodId,
      }),
    enabled:
      open && Boolean(selectedAssignmentId) && Boolean(selectedPeriodId),
  })

  const rows: BulkGradeRow[] = useMemo(() => {
    const enrollments = enrollmentsQuery.data ?? []
    const gradesList = gradesQuery.data ?? []
    const byStudent = new Map<string, Grade>()
    for (const g of gradesList) {
      byStudent.set(g.student, g)
    }
    const sortedEnroll = [...enrollments].sort((a, b) =>
      a.student_name.localeCompare(b.student_name, 'es'),
    )
    return sortedEnroll.map((e) => {
      const gr = byStudent.get(e.student)
      return {
        id: e.student,
        studentName: e.student_name,
        gradeId: gr?.id ?? null,
        numericalGrade: gr ? String(gr.numerical_grade) : '',
        performanceLevelId: gr?.performance_level ?? null,
        performanceLevelName: gr?.performance_level_name ?? '',
        definitiveGrade: gr?.definitive_grade ? String(gr.definitive_grade) : '',
      }
    })
  }, [enrollmentsQuery.data, gradesQuery.data])

  const invalidateGrades = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['grades'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<Grade>('/api/grades/', body),
    onSuccess: invalidateGrades,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Record<string, unknown>
    }) => apiClient.patch<Grade>(`/api/grades/${id}/`, body),
    onSuccess: invalidateGrades,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/grades/${id}/`),
    onSuccess: invalidateGrades,
  })

  const processRowUpdate = useCallback(
    async (newRow: BulkGradeRow, oldRow: BulkGradeRow): Promise<BulkGradeRow> => {
      setSheetError(null)
      if (!selectedAssignmentId || !selectedPeriodId) {
        throw new Error('missing_scope')
      }

      const rawNum = String(newRow.numericalGrade ?? '').trim()
      const rawDef = String(newRow.definitiveGrade ?? '').trim()

      if (rawNum === '') {
        if (oldRow.gradeId) {
          await deleteMutation.mutateAsync(oldRow.gradeId)
          return {
            ...newRow,
            gradeId: null,
            numericalGrade: '',
            performanceLevelId: null,
            performanceLevelName: '',
            definitiveGrade: '',
          }
        }
        const defChanged =
          rawDef !== String(oldRow.definitiveGrade ?? '').trim()
        if (defChanged) {
          setSheetError(t('grades.byGroupNeedNumericalFirst'))
          throw new Error('validation')
        }
        return oldRow
      }

      const normalizedNum = rawNum.replace(',', '.')
      const parsedNum = dec.safeParse(normalizedNum)
      if (!parsedNum.success) {
        setSheetError(parsedNum.error.issues[0]?.message ?? 'Nota inválida')
        throw new Error('validation')
      }

      if (rawDef !== '') {
        const defParsed = decOpt.safeParse(rawDef.replace(',', '.'))
        if (!defParsed.success) {
          setSheetError(
            defParsed.error.issues[0]?.message ?? 'Definitiva inválida',
          )
          throw new Error('validation')
        }
      }

      const body = buildGradeBody({
        student: newRow.id,
        courseAssignment: selectedAssignmentId,
        academicPeriod: selectedPeriodId,
        numericalGrade: parsedNum.data,
        gradingScales,
        definitiveGrade: rawDef,
      })
      if (rawDef === '') body.definitive_grade = null

      try {
        if (oldRow.gradeId) {
          const { data } = await updateMutation.mutateAsync({
            id: oldRow.gradeId,
            body,
          })
          return {
            ...newRow,
            gradeId: data.id,
            numericalGrade: String(data.numerical_grade),
            performanceLevelId: data.performance_level ?? null,
            performanceLevelName: data.performance_level_name ?? '',
            definitiveGrade: data.definitive_grade
              ? String(data.definitive_grade)
              : '',
          }
        }
        const { data } = await createMutation.mutateAsync(body)
        return {
          ...newRow,
          gradeId: data.id,
          numericalGrade: String(data.numerical_grade),
          performanceLevelId: data.performance_level ?? null,
          performanceLevelName: data.performance_level_name ?? '',
          definitiveGrade: data.definitive_grade
            ? String(data.definitive_grade)
            : '',
        }
      } catch (e) {
        setSheetError(getErrorMessage(e))
        throw e
      }
    },
    [
      createMutation,
      deleteMutation,
      gradingScales,
      selectedAssignmentId,
      selectedPeriodId,
      t,
      updateMutation,
    ],
  )

  const columns = useMemo<GridColDef<BulkGradeRow>[]>(
    () => [
      {
        field: 'studentName',
        headerName: t('grades.student'),
        flex: 1,
        minWidth: 200,
        editable: false,
      },
      {
        field: 'numericalGrade',
        headerName: t('grades.grade'),
        width: 120,
        editable: true,
        sortable: false,
      },
      {
        field: 'performanceLevelName',
        headerName: t('grades.level'),
        flex: 0.8,
        minWidth: 120,
        editable: false,
        valueFormatter: (v: string | null | undefined) =>
          v == null || v === '' ? '—' : String(v),
      },
      {
        field: 'definitiveGrade',
        headerName: t('grades.finalGradeOptional'),
        width: 130,
        editable: true,
        sortable: false,
      },
    ],
    [t],
  )

  const loadingSheet =
    enrollmentsQuery.isFetching ||
    gradesQuery.isFetching ||
    periodsLoading ||
    !selectedPeriodId

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>{t('grades.byGroupTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('grades.byGroupHint')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2,
            alignItems: 'flex-start',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="bulk-grade-group-label">
              {t('grades.byGroupSelectGroup')}
            </InputLabel>
            <Select
              labelId="bulk-grade-group-label"
              label={t('grades.byGroupSelectGroup')}
              value={selectedGroupId}
              onChange={(e) => {
                setPickGroupId(e.target.value)
                setPickAssignmentId(null)
                setPickPeriodId(null)
              }}
            >
              {uniqueGroups.map((g) => (
                <MenuItem key={g.group} value={g.group}>
                  {groupOptionLabel(g)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="bulk-grade-assignment-label">
              {t('grades.byGroupSelectSubject')}
            </InputLabel>
            <Select
              labelId="bulk-grade-assignment-label"
              label={t('grades.byGroupSelectSubject')}
              value={selectedAssignmentId}
              onChange={(e) => {
                setPickAssignmentId(e.target.value)
                setPickPeriodId(null)
              }}
            >
              {assignmentsInGroup.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.subject_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="bulk-grade-period-label">{t('grades.period')}</InputLabel>
            <Select
              labelId="bulk-grade-period-label"
              label={t('grades.period')}
              value={selectedPeriodId}
              onChange={(e) => setPickPeriodId(e.target.value)}
            >
              {sortedPeriods.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} ({p.number})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {sheetError ? (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSheetError(null)}>
            {sheetError}
          </Alert>
        ) : null}

        {enrollmentsQuery.isError ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {getErrorMessage(enrollmentsQuery.error)}
          </Alert>
        ) : null}
        {gradesQuery.isError ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {getErrorMessage(gradesQuery.error)}
          </Alert>
        ) : null}

        <Box sx={{ width: '100%', height: 440 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loadingSheet}
            editMode="cell"
            processRowUpdate={processRowUpdate}
            localeText={dataGridLocaleText}
            disableRowSelectionOnClick
            getRowId={(r) => r.id}
            sx={{
              ...dataGridDefaultSx,
              height: '100%',
              '& .MuiDataGrid-cell:focus-within': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('grades.byGroupClose')}</Button>
      </DialogActions>
    </Dialog>
  )
}
