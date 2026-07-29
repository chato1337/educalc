import ReplayIcon from '@mui/icons-material/Replay'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import { PageHeader } from '@/components/PageHeader'
import { RichTextEditor } from '@/components/RichTextEditor'
import {
  isRichTextEmpty,
  normalizeRichText,
} from '@/components/richTextUtils'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { resolvedAppRole } from '@/app/roleMatrix'
import { fetchMe } from '@/features/auth/meApi'
import {
  useAcademicYearsQuery,
} from '@/features/academic-structure/academicQueries'
import {
  createGradeRecovery,
  HIDE_RECOVERED_QUERY_KEY,
  type GradeRecoveriesEligibleParams,
} from '@/features/operations/gradeRecoveriesApi'
import {
  useAcademicPeriodsForYear,
  useGroupsForFilters,
  useTeacherCourseAssignments,
} from '@/features/operations/operationsQueries'
import { useTeacherScopeListDefaults } from '@/features/operations/useTeacherScopeListDefaults'
import { useUiStore } from '@/stores/uiStore'
import type { Grade } from '@/types/schemas'

const recoverySchema = z.object({
  recovery_grade: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Number(v)), { message: 'invalid' }),
  description: z
    .string()
    .refine((v) => !isRichTextEmpty(v), { message: 'required' }),
})

type RecoveryFormValues = z.infer<typeof recoverySchema>

function isTruthyQueryParam(raw: string | null): boolean {
  if (raw == null) return false
  return ['1', 'true', 't', 'yes', 'y', 'si', 'sí'].includes(
    raw.trim().toLowerCase(),
  )
}

export function GradeRecoveriesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const dataGridLocaleText = useMuiDataGridLocaleText()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchParams, setSearchParams] = useSearchParams()

  const hideRecovered = isTruthyQueryParam(
    searchParams.get(HIDE_RECOVERED_QUERY_KEY),
  )
  const setHideRecovered = useCallback(
    (next: boolean) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next) params.set(HIDE_RECOVERED_QUERY_KEY, 'true')
          else params.delete(HIDE_RECOVERED_QUERY_KEY)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null)
  const [filterTeacherDocExact, setFilterTeacherDocExact] = useState('')
  const [filterAcademicAreaId, setFilterAcademicAreaId] = useState<string | null>(
    null,
  )
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
  })
  const effectiveRole = resolvedAppRole(me?.role)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: teacherAssignments } = useTeacherCourseAssignments(
    effectiveRole === 'TEACHER' ? me?.teacher_id : null,
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

  const { data: periods = [] } = useAcademicPeriodsForYear(filterYearId)
  const { data: groups = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: filterYearId },
    undefined,
    { enabled: !!filterYearId },
  )

  const listParams: GradeRecoveriesEligibleParams = {
    course_assignment__academic_year: filterYearId ?? undefined,
    course_assignment__group: filterGroupId ?? undefined,
    course_assignment__subject__academic_area:
      filterAcademicAreaId ?? undefined,
    course_assignment__teacher__document_number:
      filterTeacherDocExact.trim() || undefined,
    academic_period: filterPeriodId ?? undefined,
    search: appliedSearch || undefined,
    hide_recovered: hideRecovered || undefined,
  }

  const listQuery = useInfiniteList<Grade>({
    queryKey: queryKeys.gradeRecoveriesEligible(listParams),
    url: '/api/grade-recoveries/eligible/',
    params: listParams,
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )

  const form = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema) as Resolver<RecoveryFormValues>,
    defaultValues: { recovery_grade: '', description: '' },
  })

  const applyMutation = useMutation({
    mutationFn: createGradeRecovery,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['grade-recoveries'],
      })
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      closeModal()
    },
    onError: (err) => {
      setFormError(getErrorMessage(err))
    },
  })

  function openRecovery(grade: Grade) {
    setSelectedGrade(grade)
    setFormError(null)
    form.reset({
      recovery_grade:
        grade.definitive_grade != null && grade.definitive_grade !== ''
          ? String(grade.definitive_grade)
          : '',
      description: '',
    })
  }

  function closeModal() {
    setSelectedGrade(null)
    setFormError(null)
    form.reset({ recovery_grade: '', description: '' })
  }

  function onSubmit(values: RecoveryFormValues) {
    if (!selectedGrade) return
    const description = normalizeRichText(values.description)
    if (!description) {
      setFormError(t('gradeRecoveries.descriptionRequired'))
      return
    }
    setFormError(null)
    applyMutation.mutate({
      grade: selectedGrade.id,
      recovery_grade: values.recovery_grade,
      description,
    })
  }

  const columns: GridColDef<Grade>[] = useMemo(
    () => [
      {
        field: 'student_name',
        headerName: t('gradeRecoveries.student'),
        flex: 1.2,
        minWidth: 160,
      },
      {
        field: 'student_document_number',
        headerName: t('gradeRecoveries.document'),
        width: 120,
      },
      {
        field: 'course_assignment_subject_name',
        headerName: t('gradeRecoveries.subject'),
        flex: 1,
        minWidth: 140,
      },
      {
        field: 'course_assignment_group_name',
        headerName: t('gradeRecoveries.group'),
        width: 100,
      },
      {
        field: 'academic_period_name',
        headerName: t('gradeRecoveries.period'),
        width: 120,
      },
      {
        field: 'numerical_grade',
        headerName: t('gradeRecoveries.numericalGrade'),
        width: 110,
      },
      {
        field: 'definitive_grade',
        headerName: t('gradeRecoveries.definitiveGrade'),
        width: 120,
        valueFormatter: (value: string | null | undefined) =>
          value == null || value === '' ? '—' : String(value),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 100,
        getActions: (params: GridRenderCellParams<Grade>) => [
          <IconButton
            key="recover"
            aria-label={t('gradeRecoveries.recover')}
            size="small"
            color="primary"
            onClick={() => openRecovery(params.row)}
          >
            <ReplayIcon fontSize="small" />
          </IconButton>,
        ],
      },
    ],
    [t],
  )

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('gradeRecoveries.title')}
        subtitle={t('gradeRecoveries.subtitle')}
      />

      {!selectedInstitutionId ? (
        <Alert severity="info">{t('gradeRecoveries.selectInstitution')}</Alert>
      ) : null}

      <Paper variant="outlined" className="p-3 flex flex-col gap-3">
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={2}
          useFlexGap
          alignItems="center"
        >
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="rec-year-label">{t('grades.yearFilter')}</InputLabel>
            <Select
              labelId="rec-year-label"
              label={t('grades.yearFilter')}
              value={filterYearId ?? ''}
              onChange={(e) => {
                const v = String(e.target.value)
                setFilterYearId(v || null)
                setFilterPeriodId(null)
                setFilterGroupId(null)
              }}
            >
              <MenuItem value="">{t('grades.all')}</MenuItem>
              {academicYears.map((y) => (
                <MenuItem key={y.id} value={y.id}>
                  {y.year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
            <InputLabel id="rec-period-label">{t('grades.period')}</InputLabel>
            <Select
              labelId="rec-period-label"
              label={t('grades.period')}
              value={filterPeriodId ?? ''}
              onChange={(e) => {
                const v = String(e.target.value)
                setFilterPeriodId(v || null)
              }}
            >
              <MenuItem value="">{t('grades.all')}</MenuItem>
              {periods.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }} disabled={!filterYearId}>
            <InputLabel id="rec-group-label">{t('grades.groupFilter')}</InputLabel>
            <Select
              labelId="rec-group-label"
              label={t('grades.groupFilter')}
              value={filterGroupId ?? ''}
              onChange={(e) => {
                const v = String(e.target.value)
                setFilterGroupId(v || null)
              }}
            >
              <MenuItem value="">{t('grades.all')}</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label={t('common.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(searchInput.trim())
            }}
            sx={{ minWidth: 220 }}
          />
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => setAppliedSearch(searchInput.trim())}
          >
            {t('common.search')}
          </Button>

          <FormControlLabel
            control={
              <Checkbox
                checked={hideRecovered}
                onChange={(e) => setHideRecovered(e.target.checked)}
                size="small"
              />
            }
            label={t('gradeRecoveries.hideRecovered')}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={listQuery.isLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !listQuery.isLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />

      <Dialog
        open={Boolean(selectedGrade)}
        onClose={closeModal}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('gradeRecoveries.modalTitle')}</DialogTitle>
        <DialogContent className="flex flex-col gap-3 pt-2">
          {selectedGrade ? (
            <Box className="flex flex-col gap-1 mb-1">
              <Typography variant="body2">
                <strong>{t('gradeRecoveries.student')}:</strong>{' '}
                {selectedGrade.student_name}
              </Typography>
              <Typography variant="body2">
                <strong>{t('gradeRecoveries.subject')}:</strong>{' '}
                {selectedGrade.course_assignment_subject_name} ·{' '}
                {selectedGrade.course_assignment_group_name} ·{' '}
                {selectedGrade.academic_period_name}
              </Typography>
              <Typography variant="body2">
                <strong>{t('gradeRecoveries.currentNumerical')}:</strong>{' '}
                {selectedGrade.numerical_grade}
              </Typography>
              {selectedGrade.definitive_grade != null &&
              selectedGrade.definitive_grade !== '' ? (
                <Typography variant="body2">
                  <strong>{t('gradeRecoveries.currentDefinitive')}:</strong>{' '}
                  {selectedGrade.definitive_grade}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {formError ? <Alert severity="error">{formError}</Alert> : null}

          <Controller
            name="recovery_grade"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('gradeRecoveries.recoveryGrade')}
                required
                fullWidth
                type="number"
                inputProps={{ step: '0.01', min: 0, max: 5 }}
                error={Boolean(fieldState.error)}
                helperText={
                  fieldState.error
                    ? t('gradeRecoveries.recoveryGradeRequired')
                    : t('gradeRecoveries.recoveryGradeHelp')
                }
              />
            )}
          />
          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => (
              <RichTextEditor
                label={t('gradeRecoveries.description')}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={Boolean(fieldState.error)}
                helperText={
                  fieldState.error
                    ? t('gradeRecoveries.descriptionRequired')
                    : t('gradeRecoveries.descriptionHelp')
                }
                minHeight={140}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={applyMutation.isPending || form.formState.isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
          >
            {t('gradeRecoveries.submit')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
