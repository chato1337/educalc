import AddIcon from '@mui/icons-material/Add'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
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
  useGradeDirectorsList,
  useGroupsForFilters,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicIndicatorsReport,
  AcademicPeriod,
  AcademicYear,
  GradeDirector,
  Group,
  Student,
} from '@/types/schemas'

const schema = z.object({
  academic_year: z.string().uuid(),
  student: z.string().uuid(),
  group: z.string().uuid(),
  academic_period: z.string().uuid(),
  grade_director: z.string().uuid(),
  general_observations: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function AcademicIndicatorsReportsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [studentDocFilter, setStudentDocFilter] = useState('')
  const [gradeDirectorDocFilter, setGradeDirectorDocFilter] = useState('')
  const [periodNumberFilter, setPeriodNumberFilter] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')
  const [compSearchInput, setCompSearchInput] = useState('')
  const [compAppliedSearch, setCompAppliedSearch] = useState('')
  const [compStudentId, setCompStudentId] = useState('')
  const [compYearId, setCompYearId] = useState('')
  const [compPeriodId, setCompPeriodId] = useState('')
  const [compRequest, setCompRequest] = useState<{
    student: string
    period: string
  } | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )
  const { data: compPeriods = [] } = useAcademicPeriodsForYear(
    compYearId || null,
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    search: appliedSearch || undefined,
    student__document_number: studentDocFilter.trim() || undefined,
    grade_director__document_number:
      gradeDirectorDocFilter.trim() || undefined,
    academic_period__number: periodNumberFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<AcademicIndicatorsReport>({
    queryKey: queryKeys.academicIndicatorsReports(listParams),
    url: '/api/academic-indicators-reports/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)
  const { data: compStudentOptions = [] } = useStudentsSearch(compAppliedSearch)

  const {
    data: compositeReport,
    isFetching: compositeLoading,
    error: compositeError,
    isError: compositeIsError,
  } = useQuery({
    queryKey: compRequest
      ? queryKeys.academicIndicatorsReportComposite(
          compRequest.student,
          compRequest.period,
        )
      : ['academic-indicators-reports', 'composite', 'idle'],
    queryFn: async () => {
      if (!compRequest) throw new Error('missing')
      const { data } = await apiClient.get<AcademicIndicatorsReport>(
        `/api/academic-indicators-reports/${compRequest.student}/${compRequest.period}/`,
      )
      return data
    },
    enabled: !!compRequest,
  })

  useEffect(() => {
    if (compositeReport && compRequest) {
      void queryClient.invalidateQueries({
        queryKey: ['academic-indicators-reports'],
      })
    }
  }, [compositeReport, compRequest, queryClient])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      academic_year: '',
      student: '',
      group: '',
      academic_period: '',
      grade_director: '',
      general_observations: '',
    },
  })

  const dialogYearId = useWatch({
    control: form.control,
    name: 'academic_year',
  })

  const dialogGroupId = useWatch({
    control: form.control,
    name: 'group',
  })

  const { data: groupsForDialog = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: dialogYearId || null },
    undefined,
    { enabled: dialogOpen && !!dialogYearId },
  )

  const { data: periodsForDialog = [] } = useAcademicPeriodsForYear(
    dialogOpen ? dialogYearId || null : null,
  )

  const { data: directorsForDialog = [] } = useGradeDirectorsList(
    {
      academic_year: dialogYearId ?? undefined,
      group: dialogGroupId ?? undefined,
    },
    { enabled: dialogOpen && !!dialogYearId && !!dialogGroupId },
  )

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicIndicatorsReport>(
        '/api/academic-indicators-reports/',
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['academic-indicators-reports'],
      })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  function openCreate() {
    setFormError(null)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    form.reset({
      academic_year: academicYears[0]?.id ?? '',
      student: '',
      group: '',
      academic_period: '',
      grade_director: '',
      general_observations: '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setFormError(null)
  }

  const pending = createMutation.isPending || form.formState.isSubmitting

  const yearLabel = (y: AcademicYear) => String(y.year)

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('academicIndicators.title')}
          subtitle={t('academicIndicators.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={academicYears.length === 0}
        >
          {t('academicIndicators.generateReport')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('academicIndicators.selectInstitution')}
        </Alert>
      ) : null}

      <Paper className="p-4 flex flex-col gap-3">
        <Box>
          <Typography variant="subtitle1" className="font-medium">
            {t('academicIndicators.queryOrCreate')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('academicIndicators.use')}{' '}
            <Box
              component="code"
              sx={{
                fontSize: 12,
                bgcolor: 'action.hover',
                px: 0.5,
                borderRadius: 0.5,
              }}
            >
              GET /api/academic-indicators-reports/&lt;student_id&gt;/&lt;period_id&gt;/
            </Box>
            {t('academicIndicators.endpointHelp')}
          </Typography>
        </Box>
        <Box className="flex flex-wrap gap-2 items-end">
          <TextField
            size="small"
            label={t('academicIndicators.searchStudent')}
            value={compSearchInput}
            onChange={(e) => setCompSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setCompAppliedSearch(compSearchInput)
              }
            }}
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => setCompAppliedSearch(compSearchInput)}
          >
            {t('common.search')}
          </Button>
          <Autocomplete
            sx={{ minWidth: 260, flex: 1 }}
            options={compStudentOptions}
            getOptionLabel={(o: Student) => o.full_name}
            value={
              compStudentOptions.find((s) => s.id === compStudentId) ?? null
            }
            onChange={(_, v) => setCompStudentId(v?.id ?? '')}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('academicIndicators.student')} size="small" />
            )}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('academicIndicators.yearPeriods')}</InputLabel>
            <Select
              label={t('academicIndicators.yearPeriods')}
              value={compYearId}
              onChange={(e) => {
                const v = e.target.value
                setCompYearId(v)
                setCompPeriodId('')
              }}
            >
              <MenuItem value="">
                <em>{t('academicIndicators.select')}</em>
              </MenuItem>
              {academicYears.map((y) => (
                <MenuItem key={y.id} value={y.id}>
                  {yearLabel(y)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            size="small"
            sx={{ minWidth: 180 }}
            disabled={!compYearId}
          >
            <InputLabel>{t('academicIndicators.period')}</InputLabel>
            <Select
              label={t('academicIndicators.period')}
              value={compPeriodId}
              onChange={(e) => setCompPeriodId(e.target.value)}
            >
              <MenuItem value="">
                <em>{t('academicIndicators.select')}</em>
              </MenuItem>
              {compPeriods.map((p: AcademicPeriod) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={
              !compStudentId || !compPeriodId || compositeLoading
            }
            onClick={() => {
              if (compStudentId && compPeriodId) {
                setCompRequest({
                  student: compStudentId,
                  period: compPeriodId,
                })
              }
            }}
          >
            {compositeLoading ? t('academicIndicators.consulting') : t('academicIndicators.consult')}
          </Button>
        </Box>
        {compositeIsError ? (
          <Alert severity="error">
            {getErrorMessage(compositeError)}
          </Alert>
        ) : null}
        {compositeReport && !compositeLoading ? (
          <Alert severity="success" className="[&_.MuiAlert-message]:w-full">
            <Typography variant="body2" className="font-medium mb-1">
              {t('academicIndicators.fetched')}
            </Typography>
            <Typography variant="body2">
              {t('academicIndicators.infoLine', {
                student: compositeReport.student_name,
                group: compositeReport.group_name,
                director: compositeReport.grade_director_name,
              })}
            </Typography>
            {compositeReport.general_observations ? (
              <Typography variant="body2" className="mt-1">
                {t('academicIndicators.observations')}: {compositeReport.general_observations}
              </Typography>
            ) : null}
            <Typography variant="body2">
              {t('academicIndicators.generated')}{' '}
              {compositeReport.generated_at
                ? new Date(compositeReport.generated_at).toLocaleString()
                : '-'}
            </Typography>
          </Alert>
        ) : null}
      </Paper>

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
          <InputLabel>{t('academicIndicators.year')}</InputLabel>
          <Select
            label={t('academicIndicators.year')}
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterPeriodId(null)
            }}
          >
            <MenuItem value="">{t('academicIndicators.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>{t('academicIndicators.period')}</InputLabel>
          <Select
            label={t('academicIndicators.period')}
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('academicIndicators.all')}</MenuItem>
            {periodsForFilter.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label={t('academicIndicators.studentDocExact')}
          value={studentDocFilter}
          onChange={(e) => setStudentDocFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('academicIndicators.directorDocExact')}
          value={gradeDirectorDocFilter}
          onChange={(e) => setGradeDirectorDocFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('academicIndicators.periodNumberExact')}
          value={periodNumberFilter}
          onChange={(e) => setPeriodNumberFilter(e.target.value)}
          sx={{ maxWidth: 180 }}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('academicIndicators.order')}</InputLabel>
          <Select
            label={t('academicIndicators.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('academicIndicators.defaultOrder')}</MenuItem>
            <MenuItem value="student__full_name">{t('academicIndicators.studentAsc')}</MenuItem>
            <MenuItem value="-student__full_name">{t('academicIndicators.studentDesc')}</MenuItem>
            <MenuItem value="academic_period__name">{t('academicIndicators.periodAsc')}</MenuItem>
            <MenuItem value="-academic_period__name">{t('academicIndicators.periodDesc')}</MenuItem>
            <MenuItem value="-generated_at">{t('academicIndicators.recentFirst')}</MenuItem>
            <MenuItem value="generated_at">{t('academicIndicators.oldFirst')}</MenuItem>
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
            setStudentDocFilter('')
            setGradeDirectorDocFilter('')
            setPeriodNumberFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
      </Paper>

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('academicIndicators.student')}</TableCell>
              <TableCell>{t('academicIndicators.group')}</TableCell>
              <TableCell>{t('academicIndicators.director')}</TableCell>
              <TableCell>{t('academicIndicators.generated')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.none')}</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.student_name}</TableCell>
                <TableCell>{row.group_name}</TableCell>
                <TableCell>{row.grade_director_name}</TableCell>
                <TableCell>
                  {row.generated_at
                    ? new Date(row.generated_at).toLocaleString()
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
            <InfiniteTableBodyFooter
              columnCount={4}
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
        <DialogTitle>{t('academicIndicators.generateReportDialog')}</DialogTitle>
        <form
          onSubmit={form.handleSubmit((v) => {
            setFormError(null)
            const body: Record<string, unknown> = {
              student: v.student,
              group: v.group,
              academic_period: v.academic_period,
              grade_director: v.grade_director,
              generated_at: new Date().toISOString(),
            }
            if (v.general_observations?.trim()) {
              body.general_observations = v.general_observations
            }
            createMutation.mutate(body)
          })}
        >
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Box className="flex gap-2 items-end">
              <TextField
                size="small"
                label={t('academicIndicators.searchStudent')}
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
                onClick={() => setAppliedStudentSearch(studentSearchInput)}
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
                    studentOptions.find((s) => s.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicIndicators.student')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('academicIndicators.academicYear')}</InputLabel>
                  <Select
                    label={t('academicIndicators.academicYear')}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      form.setValue('group', '')
                      form.setValue('academic_period', '')
                      form.setValue('grade_director', '')
                    }}
                  >
                    {academicYears.map((y) => (
                      <MenuItem key={y.id} value={y.id}>
                        {yearLabel(y)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
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
                  onChange={(_, v) => {
                    field.onChange(v?.id ?? '')
                    form.setValue('grade_director', '')
                  }}
                  disabled={!dialogYearId}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicIndicators.group')}
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
                  <InputLabel>{t('academicIndicators.period')}</InputLabel>
                  <Select
                    label={t('academicIndicators.period')}
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
            <Controller
              name="grade_director"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl
                  fullWidth
                  required
                  error={!!fieldState.error}
                  disabled={directorsForDialog.length === 0}
                >
                  <InputLabel>{t('academicIndicators.director')}</InputLabel>
                  <Select
                    label={t('academicIndicators.director')}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {directorsForDialog.map((d: GradeDirector) => (
                      <MenuItem key={d.id} value={d.teacher}>
                        {d.teacher_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              label={t('academicIndicators.generalObservations')}
              fullWidth
              multiline
              minRows={3}
              {...form.register('general_observations')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {t('academicIndicators.generate')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
