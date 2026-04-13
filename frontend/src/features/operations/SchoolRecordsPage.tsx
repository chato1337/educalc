import AddIcon from '@mui/icons-material/Add'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
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
  ToggleButton,
  ToggleButtonGroup,
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
import { downloadGradesBulletinPdf } from '@/features/operations/gradesBulletinApi'
import {
  useAcademicPeriodsForYear,
  useCampusesForInstitution,
  useGroupsForFilters,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicPeriod,
  AcademicYear,
  Campus,
  Group,
  SchoolRecord,
  Student,
} from '@/types/schemas'

const schema = z.object({
  student: z.string().uuid(),
  group: z.string().uuid(),
  academic_year: z.string().uuid(),
  institution: z.string().uuid(),
  campus: z.string().uuid(),
})

type FormValues = z.infer<typeof schema>

type BulletinScope = 'student' | 'group'

export function SchoolRecordsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [studentDocFilter, setStudentDocFilter] = useState('')
  const [institutionDaneFilter, setInstitutionDaneFilter] = useState('')
  const [yearNumberFilter, setYearNumberFilter] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')
  const [compSearchInput, setCompSearchInput] = useState('')
  const [compAppliedSearch, setCompAppliedSearch] = useState('')
  const [compStudentId, setCompStudentId] = useState('')
  const [compYearId, setCompYearId] = useState('')
  const [compRequest, setCompRequest] = useState<{
    student: string
    year: string
  } | null>(null)
  const [bulletinStudentSearchInput, setBulletinStudentSearchInput] =
    useState('')
  const [bulletinAppliedStudentSearch, setBulletinAppliedStudentSearch] =
    useState('')
  const [bulletinStudentId, setBulletinStudentId] = useState('')
  const [bulletinYearId, setBulletinYearId] = useState('')
  const [bulletinPeriodIds, setBulletinPeriodIds] = useState<string[]>([])
  const [bulletinScope, setBulletinScope] = useState<BulletinScope>('student')
  const [bulletinGroupId, setBulletinGroupId] = useState('')
  const [bulletinError, setBulletinError] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: campuses = [] } = useCampusesForInstitution(
    selectedInstitutionId,
  )

  const listParams = {
    academic_year: filterYearId ?? undefined,
    institution: selectedInstitutionId ?? undefined,
    search: appliedSearch || undefined,
    student__document_number: studentDocFilter.trim() || undefined,
    institution__dane_code: institutionDaneFilter.trim() || undefined,
    academic_year__year: yearNumberFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<SchoolRecord>({
    queryKey: queryKeys.schoolRecords(listParams),
    url: '/api/school-records/',
    params: listParams,
    enabled: !!selectedInstitutionId,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)
  const { data: compStudentOptions = [] } = useStudentsSearch(compAppliedSearch)
  const { data: bulletinStudentOptions = [] } = useStudentsSearch(
    bulletinAppliedStudentSearch,
  )
  const { data: periodsForBulletin = [] } = useAcademicPeriodsForYear(
    bulletinYearId || null,
  )
  const { data: groupsForBulletin = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: bulletinYearId || null },
    undefined,
    { enabled: !!selectedInstitutionId && !!bulletinYearId },
  )

  const {
    data: compositeRecord,
    isFetching: compositeLoading,
    error: compositeError,
    isError: compositeIsError,
  } = useQuery({
    queryKey: compRequest
      ? queryKeys.schoolRecordComposite(compRequest.student, compRequest.year)
      : ['school-records', 'composite', 'idle'],
    queryFn: async () => {
      if (!compRequest) throw new Error('missing')
      const { data } = await apiClient.get<SchoolRecord>(
        `/api/school-records/${compRequest.student}/${compRequest.year}/`,
      )
      return data
    },
    enabled: !!compRequest,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      student: '',
      group: '',
      academic_year: '',
      institution: '',
      campus: '',
    },
  })

  const dialogYearId = useWatch({
    control: form.control,
    name: 'academic_year',
  })

  const { data: groupsForDialog = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: dialogYearId || null },
    undefined,
    { enabled: dialogOpen && !!dialogYearId },
  )

  useEffect(() => {
    if (!bulletinYearId && academicYears[0]?.id) {
      setBulletinYearId(academicYears[0].id)
    }
  }, [academicYears, bulletinYearId])

  useEffect(() => {
    setBulletinPeriodIds([])
    setBulletinGroupId('')
  }, [bulletinYearId])

  const downloadBulletinMutation = useMutation({
    mutationFn: () => {
      const period_ids =
        bulletinPeriodIds.length > 0
          ? bulletinPeriodIds.join(',')
          : undefined
      if (bulletinScope === 'student') {
        return downloadGradesBulletinPdf({
          student: bulletinStudentId,
          academic_year: bulletinYearId,
          period_ids,
        })
      }
      return downloadGradesBulletinPdf({
        group: bulletinGroupId,
        academic_year: bulletinYearId,
        period_ids,
      })
    },
    onMutate: () => setBulletinError(null),
    onError: (e) => setBulletinError(getErrorMessage(e)),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<SchoolRecord>('/api/school-records/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['school-records'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  function openCreate() {
    if (!selectedInstitutionId) return
    setFormError(null)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    form.reset({
      student: '',
      group: '',
      academic_year: academicYears[0]?.id ?? '',
      institution: selectedInstitutionId,
      campus: campuses[0]?.id ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setFormError(null)
  }

  const pending = createMutation.isPending || form.formState.isSubmitting

  const yearLabel = (y: AcademicYear) => String(y.year)

  const groupBulletinLabel = (g: Group) =>
    `${g.name} (${g.academic_year_year}) — ${g.grade_level_name}`

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('schoolRecords.title')}
          subtitle={t('schoolRecords.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={
            !selectedInstitutionId ||
            academicYears.length === 0 ||
            campuses.length === 0
          }
        >
          {t('schoolRecords.generateRecord')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('schoolRecords.selectInstitution')}
        </Alert>
      ) : null}

      <Paper className="p-4 flex flex-col gap-3">
        <Box>
          <Typography variant="subtitle1" className="font-medium">
            {t('schoolRecords.queryOrCreate')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('schoolRecords.useEndpoint')}{' '}
            <Box
              component="code"
              sx={{
                fontSize: 12,
                bgcolor: 'action.hover',
                px: 0.5,
                borderRadius: 0.5,
              }}
            >
              GET /api/school-records/&lt;student_id&gt;/&lt;academic_year_id&gt;/
            </Box>
            {t('schoolRecords.endpointHelp')}
          </Typography>
        </Box>
        <Box className="flex flex-wrap gap-2 items-end">
          <TextField
            size="small"
            label={t('schoolRecords.searchStudent')}
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
              <TextField {...params} label={t('schoolRecords.student')} size="small" />
            )}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('schoolRecords.academicYear')}</InputLabel>
            <Select
              label={t('schoolRecords.academicYear')}
              value={compYearId}
              onChange={(e) => setCompYearId(e.target.value)}
            >
              <MenuItem value="">
                <em>{t('schoolRecords.select')}</em>
              </MenuItem>
              {academicYears.map((y) => (
                <MenuItem key={y.id} value={y.id}>
                  {yearLabel(y)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={!compStudentId || !compYearId || compositeLoading}
            onClick={() => {
              if (compStudentId && compYearId) {
                setCompRequest({ student: compStudentId, year: compYearId })
              }
            }}
          >
            {compositeLoading ? t('schoolRecords.consulting') : t('schoolRecords.consult')}
          </Button>
        </Box>
        {compositeIsError ? (
          <Alert severity="error">
            {getErrorMessage(compositeError)}
          </Alert>
        ) : null}
        {compositeRecord && !compositeLoading ? (
          <Alert severity="success" className="[&_.MuiAlert-message]:w-full">
            <Typography variant="body2" className="font-medium mb-1">
              {t('schoolRecords.recordFetched')}
            </Typography>
            <Typography variant="body2">
              {t('schoolRecords.recordLine', {
                student: compositeRecord.student_name,
                group: compositeRecord.group_name,
                campus: compositeRecord.campus_name,
              })}
            </Typography>
            <Typography variant="body2">
              {t('schoolRecords.generated')}{' '}
              {compositeRecord.generated_at
                ? new Date(compositeRecord.generated_at).toLocaleString()
                : '-'}
            </Typography>
          </Alert>
        ) : null}
      </Paper>

      {selectedInstitutionId && academicYears.length > 0 ? (
        <Paper className="p-4 flex flex-col gap-3">
          <Box>
            <Typography variant="subtitle1" className="font-medium">
              {t('grades.bulletinTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('grades.bulletinSubtitle')}
            </Typography>
          </Box>
          {bulletinError ? (
            <Alert
              severity="error"
              onClose={() => setBulletinError(null)}
            >
              {bulletinError}
            </Alert>
          ) : null}
          <ToggleButtonGroup
            exclusive
            value={bulletinScope}
            onChange={(_, v: BulletinScope | null) => {
              if (v != null) setBulletinScope(v)
            }}
            size="small"
            color="primary"
          >
            <ToggleButton value="student">
              {t('grades.bulletinScopeStudent')}
            </ToggleButton>
            <ToggleButton value="group">
              {t('grades.bulletinScopeGroup')}
            </ToggleButton>
          </ToggleButtonGroup>
          <Box className="flex flex-col gap-0.5">
            <Box className="flex flex-wrap gap-2 items-start">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t('grades.bulletinYear')}</InputLabel>
                <Select
                  label={t('grades.bulletinYear')}
                  value={bulletinYearId}
                  onChange={(e) => setBulletinYearId(e.target.value)}
                >
                  {academicYears.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {yearLabel(y)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                multiple
                sx={{ minWidth: 260, flex: 1 }}
                options={periodsForBulletin}
                getOptionLabel={(p: AcademicPeriod) => p.name}
                value={periodsForBulletin.filter((p) =>
                  bulletinPeriodIds.includes(p.id),
                )}
                onChange={(_, v) => setBulletinPeriodIds(v.map((p) => p.id))}
                disabled={!bulletinYearId}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField
                    {...params}
                    label={t('grades.bulletinPeriods')}
                    size="small"
                  />
                )}
                isOptionEqualToValue={(a, b) => a.id === b.id}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.25 }}>
              {t('grades.bulletinPeriodsHint')}
            </Typography>
          </Box>
          {bulletinScope === 'student' ? (
            <Box className="flex flex-wrap gap-2 items-center">
              <TextField
                size="small"
                label={t('grades.searchStudent')}
                value={bulletinStudentSearchInput}
                onChange={(e) => setBulletinStudentSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setBulletinAppliedStudentSearch(bulletinStudentSearchInput)
                  }
                }}
                sx={{ minWidth: 200 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setBulletinAppliedStudentSearch(bulletinStudentSearchInput)
                }
              >
                {t('common.search')}
              </Button>
              <Autocomplete
                sx={{ minWidth: 260, flex: 1 }}
                options={bulletinStudentOptions}
                getOptionLabel={(o: Student) => o.full_name}
                value={
                  bulletinStudentOptions.find(
                    (s) => s.id === bulletinStudentId,
                  ) ?? null
                }
                onChange={(_, v) => setBulletinStudentId(v?.id ?? '')}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField
                    {...params}
                    label={t('grades.student')}
                    size="small"
                  />
                )}
              />
            </Box>
          ) : (
            <Autocomplete
              sx={{ minWidth: 320, maxWidth: '100%' }}
              options={groupsForBulletin}
              getOptionLabel={(g: Group) => groupBulletinLabel(g)}
              value={
                groupsForBulletin.find((g) => g.id === bulletinGroupId) ?? null
              }
              onChange={(_, v) => setBulletinGroupId(v?.id ?? '')}
              disabled={!bulletinYearId}
              renderInput={(params: AutocompleteRenderInputParams) => (
                <TextField
                  {...params}
                  label={t('grades.bulletinGroup')}
                  size="small"
                />
              )}
              isOptionEqualToValue={(a, b) => a.id === b.id}
            />
          )}
          <Box>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PictureAsPdfIcon />}
              disabled={
                !bulletinYearId ||
                downloadBulletinMutation.isPending ||
                (bulletinScope === 'student' && !bulletinStudentId) ||
                (bulletinScope === 'group' && !bulletinGroupId)
              }
              onClick={() => downloadBulletinMutation.mutate()}
            >
              {downloadBulletinMutation.isPending
                ? t('grades.bulletinDownloading')
                : bulletinScope === 'group'
                  ? t('grades.downloadBulletinGroup')
                  : t('grades.downloadBulletin')}
            </Button>
          </Box>
        </Paper>
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
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t('schoolRecords.year')}</InputLabel>
          <Select
            label={t('schoolRecords.year')}
            value={filterYearId ?? ''}
            onChange={(e) =>
              setFilterYearId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('schoolRecords.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label={t('schoolRecords.studentDocExact')}
          value={studentDocFilter}
          onChange={(e) => setStudentDocFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('schoolRecords.institutionDane')}
          value={institutionDaneFilter}
          onChange={(e) => setInstitutionDaneFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('schoolRecords.yearExact')}
          value={yearNumberFilter}
          onChange={(e) => setYearNumberFilter(e.target.value)}
          sx={{ maxWidth: 160 }}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('schoolRecords.order')}</InputLabel>
          <Select
            label={t('schoolRecords.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('schoolRecords.defaultOrder')}</MenuItem>
            <MenuItem value="student__full_name">{t('schoolRecords.studentAsc')}</MenuItem>
            <MenuItem value="-student__full_name">{t('schoolRecords.studentDesc')}</MenuItem>
            <MenuItem value="group__name">{t('schoolRecords.groupAsc')}</MenuItem>
            <MenuItem value="-group__name">{t('schoolRecords.groupDesc')}</MenuItem>
            <MenuItem value="-generated_at">{t('schoolRecords.recentFirst')}</MenuItem>
            <MenuItem value="generated_at">{t('schoolRecords.oldFirst')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setFilterYearId(null)
            setStudentDocFilter('')
            setInstitutionDaneFilter('')
            setYearNumberFilter('')
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
              <TableCell>{t('schoolRecords.student')}</TableCell>
              <TableCell>{t('schoolRecords.group')}</TableCell>
              <TableCell>{t('schoolRecords.campus')}</TableCell>
              <TableCell>{t('schoolRecords.generated')}</TableCell>
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
                <TableCell>{row.campus_name}</TableCell>
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
        <DialogTitle>{t('schoolRecords.generateFinalBook')}</DialogTitle>
        <form
          onSubmit={form.handleSubmit((v) => {
            setFormError(null)
            createMutation.mutate({
              ...v,
              generated_at: new Date().toISOString(),
            })
          })}
        >
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Box className="flex gap-2 items-end">
              <TextField
                size="small"
                label={t('schoolRecords.searchStudent')}
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
                      label={t('schoolRecords.student')}
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
                  <InputLabel>{t('schoolRecords.academicYear')}</InputLabel>
                  <Select
                    label={t('schoolRecords.academicYear')}
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      form.setValue('group', '')
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
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!dialogYearId}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('schoolRecords.group')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <input type="hidden" {...form.register('institution')} />
            <Controller
              name="campus"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('schoolRecords.campus')}</InputLabel>
                  <Select
                    label={t('schoolRecords.campus')}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {campuses.map((c: Campus) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {t('schoolRecords.generate')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
