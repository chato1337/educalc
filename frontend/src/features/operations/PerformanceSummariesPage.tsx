import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
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
  FormControl,
  FormControlLabel,
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
  Typography,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteTableBodyFooter } from '@/components/InfiniteTableBodyFooter'
import { PageHeader } from '@/components/PageHeader'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import {
  useAcademicPeriodsForYear,
  useCampusesForInstitution,
  useGradeLevelsQuery,
  useGroupsForFilters,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import {
  postPerformanceSummaryRecalculateByGrade,
  postPerformanceSummaryRecalculateByInstitution,
} from '@/features/operations/performanceSummariesRecalcApi'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicPeriod,
  AcademicYear,
  GradeLevel,
  Group,
  PerformanceSummary,
  PerformanceSummaryRecalculateByGradeRequest,
  PerformanceSummaryRecalculateByInstitutionRequest,
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
  student: z.string().uuid(),
  group: z.string().uuid(),
  academic_period: z.string().uuid(),
  period_average: dec,
  rank: z.string().optional(),
  definitive_average: decOpt,
})

type FormValues = z.infer<typeof schema>

export function PerformanceSummariesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogYearId, setDialogYearId] = useState<string | null>(null)
  const [editing, setEditing] = useState<PerformanceSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PerformanceSummary | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const [recalcYearId, setRecalcYearId] = useState('')
  const [recalcGradeLevelId, setRecalcGradeLevelId] = useState('')
  const [recalcCampusId, setRecalcCampusId] = useState('')
  const [recalcPeriodId, setRecalcPeriodId] = useState('')
  const [recalcGradeSyncAll, setRecalcGradeSyncAll] = useState(false)
  const [instRecalcYearId, setInstRecalcYearId] = useState('')
  const [instRecalcCampusId, setInstRecalcCampusId] = useState('')
  const [instRecalcPeriodId, setInstRecalcPeriodId] = useState('')
  const [instRecalcSyncAll, setInstRecalcSyncAll] = useState(false)
  const [recalcFeedback, setRecalcFeedback] = useState<{
    severity: 'success' | 'error'
    message: string
  } | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )
  const { data: groupsForDialog = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: dialogYearId },
    undefined,
    { enabled: dialogOpen && !!dialogYearId },
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    search: appliedSearch || undefined,
  }

  const listQuery = useInfiniteList<PerformanceSummary>({
    queryKey: queryKeys.performanceSummaries(listParams),
    url: '/api/performance-summaries/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)
  const { data: periodsForDialog = [] } = useAcademicPeriodsForYear(
    dialogOpen ? dialogYearId : null,
  )

  const { data: gradeLevels = [] } = useGradeLevelsQuery(selectedInstitutionId)
  const { data: campuses = [] } = useCampusesForInstitution(selectedInstitutionId)
  const { data: periodsForRecalcGrade = [] } = useAcademicPeriodsForYear(
    recalcYearId || null,
  )
  const { data: periodsForRecalcInst = [] } = useAcademicPeriodsForYear(
    instRecalcYearId || null,
  )

  useEffect(() => {
    if (!selectedInstitutionId) {
      setRecalcYearId('')
      setInstRecalcYearId('')
      return
    }
    const first = academicYears[0]?.id ?? ''
    setRecalcYearId((prev) => (prev && academicYears.some((y) => y.id === prev) ? prev : first))
    setInstRecalcYearId((prev) =>
      prev && academicYears.some((y) => y.id === prev) ? prev : first,
    )
  }, [selectedInstitutionId, academicYears])

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    void apiClient
      .get<Group>(`/api/groups/${editing.group}/`)
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
      group: '',
      academic_period: '',
      period_average: '',
      rank: '',
      definitive_average: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<PerformanceSummary>('/api/performance-summaries/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['performance-summaries'],
      })
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
      apiClient.patch<PerformanceSummary>(
        `/api/performance-summaries/${id}/`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['performance-summaries'],
      })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/performance-summaries/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['performance-summaries'],
      })
      setDeleteTarget(null)
    },
  })

  const recalcByGradeMutation = useMutation({
    mutationFn: postPerformanceSummaryRecalculateByGrade,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['performance-summaries'] })
      setRecalcFeedback({
        severity: 'success',
        message: t('performanceSummaries.recalc.successGrade', {
          pairs: data.pairs_synced,
          groups: data.groups_in_scope,
          mode: data.mode,
        }),
      })
    },
    onError: (e) =>
      setRecalcFeedback({
        severity: 'error',
        message: getErrorMessage(e),
      }),
  })

  const recalcByInstitutionMutation = useMutation({
    mutationFn: postPerformanceSummaryRecalculateByInstitution,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['performance-summaries'] })
      setRecalcFeedback({
        severity: 'success',
        message: t('performanceSummaries.recalc.successInstitution', {
          pairs: data.pairs_synced,
          groups: data.groups_in_scope,
          mode: data.mode,
        }),
      })
    },
    onError: (e) =>
      setRecalcFeedback({
        severity: 'error',
        message: getErrorMessage(e),
      }),
  })

  function toBody(v: FormValues) {
    const body: Record<string, unknown> = {
      student: v.student,
      group: v.group,
      academic_period: v.academic_period,
      period_average: v.period_average,
    }
    if (v.rank?.trim()) body.rank = parseInt(v.rank, 10)
    if (v.definitive_average && v.definitive_average !== '')
      body.definitive_average = v.definitive_average
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
      group: '',
      academic_period: '',
      period_average: '',
      rank: '',
      definitive_average: '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: PerformanceSummary) {
    setEditing(row)
    setFormError(null)
    setDialogYearId(null)
    form.reset({
      student: row.student,
      group: row.group,
      academic_period: row.academic_period,
      period_average: String(row.period_average),
      rank: row.rank != null ? String(row.rank) : '',
      definitive_average: row.definitive_average
        ? String(row.definitive_average)
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

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  const recalcPending =
    recalcByGradeMutation.isPending || recalcByInstitutionMutation.isPending

  const yearLabel = (y: AcademicYear) => String(y.year)

  function submitRecalcByGrade() {
    if (!recalcGradeLevelId) {
      setRecalcFeedback({
        severity: 'error',
        message: t('performanceSummaries.recalc.pickGradeLevel'),
      })
      return
    }
    if (!recalcYearId) {
      setRecalcFeedback({
        severity: 'error',
        message: t('performanceSummaries.recalc.pickYear'),
      })
      return
    }
    setRecalcFeedback(null)
    const body: PerformanceSummaryRecalculateByGradeRequest = {
      grade_level: recalcGradeLevelId,
      academic_year: recalcYearId,
      sync_all_group_period_combinations: recalcGradeSyncAll,
    }
    if (recalcCampusId) body.campus = recalcCampusId
    if (recalcPeriodId) body.academic_period = recalcPeriodId
    recalcByGradeMutation.mutate(body)
  }

  function submitRecalcByInstitution() {
    if (!selectedInstitutionId) return
    setRecalcFeedback(null)
    const body: PerformanceSummaryRecalculateByInstitutionRequest = {
      institution: selectedInstitutionId,
      sync_all_group_period_combinations: instRecalcSyncAll,
    }
    if (instRecalcYearId) body.academic_year = instRecalcYearId
    if (instRecalcCampusId) body.campus = instRecalcCampusId
    if (instRecalcPeriodId) body.academic_period = instRecalcPeriodId
    recalcByInstitutionMutation.mutate(body)
  }

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('performanceSummaries.title')}
          subtitle={t('performanceSummaries.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId || academicYears.length === 0}
        >
          {t('performanceSummaries.new')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('performanceSummaries.selectInstitution')}
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
          <InputLabel>{t('performanceSummaries.year')}</InputLabel>
          <Select
            label={t('performanceSummaries.year')}
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterPeriodId(null)
            }}
          >
            <MenuItem value="">{t('performanceSummaries.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>{t('performanceSummaries.period')}</InputLabel>
          <Select
            label={t('performanceSummaries.period')}
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('performanceSummaries.all')}</MenuItem>
            {periodsForFilter.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {selectedInstitutionId ? (
        <Paper className="p-4 flex flex-col gap-3">
          <Typography variant="subtitle1">
            {t('performanceSummaries.recalc.sectionTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('performanceSummaries.recalc.sectionHint')}
          </Typography>
          {recalcFeedback ? (
            <Alert
              severity={recalcFeedback.severity}
              onClose={() => setRecalcFeedback(null)}
            >
              {recalcFeedback.message}
            </Alert>
          ) : null}
          <Box className="grid gap-6 md:grid-cols-2 md:gap-8">
            <Box className="flex flex-col gap-2">
              <Typography variant="subtitle2">
                {t('performanceSummaries.recalc.byGradeTitle')}
              </Typography>
              <FormControl size="small" fullWidth required>
                <InputLabel>{t('performanceSummaries.recalc.year')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.year')}
                  value={recalcYearId}
                  onChange={(e) => {
                    setRecalcYearId(e.target.value)
                    setRecalcPeriodId('')
                  }}
                >
                  {academicYears.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {yearLabel(y)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('performanceSummaries.recalc.gradeLevel')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.gradeLevel')}
                  value={recalcGradeLevelId}
                  onChange={(e) => setRecalcGradeLevelId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>{t('performanceSummaries.recalc.gradeLevelPlaceholder')}</em>
                  </MenuItem>
                  {gradeLevels.map((gl: GradeLevel) => (
                    <MenuItem key={gl.id} value={gl.id}>
                      {gl.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('performanceSummaries.recalc.campus')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.campus')}
                  value={recalcCampusId}
                  onChange={(e) => setRecalcCampusId(e.target.value)}
                >
                  <MenuItem value="">{t('performanceSummaries.recalc.campusAll')}</MenuItem>
                  {campuses.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth disabled={!recalcYearId}>
                <InputLabel>{t('performanceSummaries.recalc.period')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.period')}
                  value={recalcPeriodId}
                  onChange={(e) => setRecalcPeriodId(e.target.value)}
                >
                  <MenuItem value="">{t('performanceSummaries.recalc.periodAll')}</MenuItem>
                  {periodsForRecalcGrade.map((p: AcademicPeriod) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={recalcGradeSyncAll}
                    onChange={(_, c) => setRecalcGradeSyncAll(c)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      {t('performanceSummaries.recalc.syncAll')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('performanceSummaries.recalc.syncAllHint')}
                    </Typography>
                  </Box>
                }
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={submitRecalcByGrade}
                disabled={recalcPending || !recalcYearId}
              >
                {t('performanceSummaries.recalc.runByGrade')}
              </Button>
            </Box>

            <Box className="flex flex-col gap-2">
              <Typography variant="subtitle2">
                {t('performanceSummaries.recalc.byInstitutionTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('performanceSummaries.recalc.institutionUsesContext')}
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('performanceSummaries.recalc.institutionYear')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.institutionYear')}
                  value={instRecalcYearId}
                  onChange={(e) => {
                    setInstRecalcYearId(e.target.value)
                    setInstRecalcPeriodId('')
                  }}
                >
                  <MenuItem value="">{t('performanceSummaries.recalc.institutionYearAll')}</MenuItem>
                  {academicYears.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {yearLabel(y)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('performanceSummaries.recalc.campus')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.campus')}
                  value={instRecalcCampusId}
                  onChange={(e) => setInstRecalcCampusId(e.target.value)}
                >
                  <MenuItem value="">{t('performanceSummaries.recalc.campusAll')}</MenuItem>
                  {campuses.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth disabled={!instRecalcYearId}>
                <InputLabel>{t('performanceSummaries.recalc.period')}</InputLabel>
                <Select
                  label={t('performanceSummaries.recalc.period')}
                  value={instRecalcPeriodId}
                  onChange={(e) => setInstRecalcPeriodId(e.target.value)}
                >
                  <MenuItem value="">{t('performanceSummaries.recalc.periodAll')}</MenuItem>
                  {periodsForRecalcInst.map((p: AcademicPeriod) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={instRecalcSyncAll}
                    onChange={(_, c) => setInstRecalcSyncAll(c)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      {t('performanceSummaries.recalc.syncAll')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('performanceSummaries.recalc.syncAllHint')}
                    </Typography>
                  </Box>
                }
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={submitRecalcByInstitution}
                disabled={recalcPending}
              >
                {t('performanceSummaries.recalc.runByInstitution')}
              </Button>
            </Box>
          </Box>
        </Paper>
      ) : null}

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('performanceSummaries.student')}</TableCell>
              <TableCell>{t('performanceSummaries.group')}</TableCell>
              <TableCell>{t('performanceSummaries.average')}</TableCell>
              <TableCell>{t('performanceSummaries.rank')}</TableCell>
              <TableCell align="right" width={100} />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>{t('common.none')}</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.student_name}</TableCell>
                <TableCell>{row.group_name}</TableCell>
                <TableCell>{row.period_average}</TableCell>
                <TableCell>{row.rank ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => openEdit(row)}
                    aria-label={t('performanceSummaries.edit')}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setDeleteTarget(row)}
                    aria-label={t('performanceSummaries.delete')}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <InfiniteTableBodyFooter
              columnCount={5}
              hasRows={rows.length > 0}
              isLoading={isLoading}
              isFetchingNextPage={listQuery.isFetchingNextPage}
              hasNextPage={listQuery.hasNextPage ?? false}
              onLoadMore={() => void listQuery.fetchNextPage()}
            />
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('performanceSummaries.editDialog') : t('performanceSummaries.newDialog')}
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
                <InputLabel>{t('performanceSummaries.academicYear')}</InputLabel>
                <Select
                  label={t('performanceSummaries.academicYear')}
                  value={dialogYearId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDialogYearId(v === '' ? null : v)
                    form.setValue('group', '')
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
                    label={t('performanceSummaries.searchStudent')}
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
                          label={t('performanceSummaries.student')}
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
                label={t('performanceSummaries.student')}
                value={editing.student_name}
                disabled
                fullWidth
              />
            )}
            <Controller
              name="group"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={groupsForDialog}
                  getOptionLabel={(g: Group) => g.name}
                  value={
                    groupsForDialog.find((g) => g.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!dialogYearId}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('performanceSummaries.group')}
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
                  <InputLabel>{t('performanceSummaries.period')}</InputLabel>
                  <Select
                    label={t('performanceSummaries.period')}
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
              label={t('performanceSummaries.periodAverage')}
              fullWidth
              required
              {...form.register('period_average')}
            />
            <TextField
              label={t('performanceSummaries.rankOptional')}
              type="number"
              fullWidth
              inputProps={{ min: 0 }}
              {...form.register('rank')}
            />
            <TextField
              label={t('performanceSummaries.definitiveAverageOptional')}
              fullWidth
              {...form.register('definitive_average')}
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
        <DialogTitle>{t('performanceSummaries.deleteDialog')}</DialogTitle>
        <DialogContent>{t('performanceSummaries.deletePrompt')}</DialogContent>
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
