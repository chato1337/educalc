import DownloadIcon from '@mui/icons-material/Download'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { resolvedAppRole } from '@/app/roleMatrix'
import {
  useAcademicAreasQuery,
  useAcademicYearsQuery,
  useCampusesForInstitution,
  useGradeLevelsQuery,
} from '@/features/academic-structure/academicQueries'
import { fetchMe } from '@/features/auth/meApi'
import {
  downloadGradingConsolidatedCsv,
  type GradingConsolidatedCsvQuery,
} from '@/features/reports/gradingConsolidatedReportApi'
import {
  useAcademicPeriodsForYear,
  useGroupsForFilters,
  useSubjectsForInstitution,
  useTeachersSearch,
} from '@/features/operations/operationsQueries'
import { PageHeader } from '@/components/PageHeader'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicYear, Teacher } from '@/types/schemas'

const uuidOrEmpty = z.union([z.string().uuid(), z.literal('')])

const formSchema = z.object({
  academic_year: z
    .string()
    .min(1, 'reports.gradingConsolidated.errors.yearRequired')
    .uuid('reports.gradingConsolidated.errors.yearInvalid'),
  academic_period: uuidOrEmpty,
  campus: uuidOrEmpty,
  grade_level: uuidOrEmpty,
  group: uuidOrEmpty,
  academic_area: uuidOrEmpty,
  subject: uuidOrEmpty,
  teacher: uuidOrEmpty,
})

type FormValues = z.infer<typeof formSchema>

function toQuery(values: FormValues): GradingConsolidatedCsvQuery {
  const q: GradingConsolidatedCsvQuery = {
    academic_year: values.academic_year,
  }
  const add = (k: keyof FormValues, key: keyof GradingConsolidatedCsvQuery) => {
    const v = values[k]
    if (typeof v === 'string' && v.trim() !== '') {
      ;(q as Record<string, string>)[key as string] = v.trim()
    }
  }
  add('academic_period', 'academic_period')
  add('campus', 'campus')
  add('grade_level', 'grade_level')
  add('group', 'group')
  add('academic_area', 'academic_area')
  add('subject', 'subject')
  add('teacher', 'teacher')
  return q
}

export function GradingConsolidatedReportPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const role = resolvedAppRole(user?.role)

  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  })

  const institutionForYearList =
    role === 'COORDINATOR'
      ? (me?.institution_id ?? user?.institution_id ?? null)
      : selectedInstitutionId

  const { data: yearsData, isLoading: yearsLoading } =
    useAcademicYearsQuery(institutionForYearList)

  const years = yearsData ?? []

  const { control, handleSubmit, resetField, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      academic_year: '',
      academic_period: '',
      campus: '',
      grade_level: '',
      group: '',
      academic_area: '',
      subject: '',
      teacher: '',
    },
  })

  const academicYearId = useWatch({ control, name: 'academic_year' })
  const campusId = useWatch({ control, name: 'campus' })
  const gradeLevelId = useWatch({ control, name: 'grade_level' })

  const selectedYear: AcademicYear | undefined = useMemo(
    () => years.find((y) => y.id === academicYearId),
    [years, academicYearId],
  )

  const institutionIdForYear = selectedYear?.institution ?? null

  useEffect(() => {
    resetField('academic_period')
    resetField('campus')
    resetField('grade_level')
    resetField('group')
    resetField('academic_area')
    resetField('subject')
    resetField('teacher')
  }, [academicYearId, resetField])

  const { data: periodsData } = useAcademicPeriodsForYear(
    academicYearId || null,
  )
  const periods = periodsData ?? []

  const { data: campusesData } = useCampusesForInstitution(
    institutionIdForYear,
  )
  const campuses = campusesData ?? []

  const { data: gradeLevelsData } = useGradeLevelsQuery(institutionIdForYear)
  const gradeLevels = gradeLevelsData ?? []

  const { data: groupsData } = useGroupsForFilters(institutionIdForYear, {
    academic_year: academicYearId || undefined,
    campus: campusId || undefined,
    grade_level: gradeLevelId || undefined,
  })
  const groups = groupsData ?? []

  const { data: areasData } = useAcademicAreasQuery(institutionIdForYear)
  const areas = areasData ?? []

  const { data: subjectsData } = useSubjectsForInstitution(
    institutionIdForYear,
  )
  const subjects = subjectsData ?? []

  const [teacherSearch, setTeacherSearch] = useState('')
  const deferredTeacherSearch = useDeferredValue(teacherSearch)
  const { data: teachersData } = useTeachersSearch(deferredTeacherSearch)
  const teachers = teachersData ?? []

  const downloadMutation = useMutation({
    mutationFn: downloadGradingConsolidatedCsv,
  })

  const onSubmit = (values: FormValues) => {
    downloadMutation.mutate(toQuery(values))
  }

  const coordinatorBlocked =
    role === 'COORDINATOR' &&
    !(me?.institution_id ?? user?.institution_id ?? '').trim()

  return (
    <Box className="p-4 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-4">
      <PageHeader title={t('reports.gradingConsolidated.title')} />
      <Typography variant="body2" color="text.secondary">
        {t('reports.gradingConsolidated.intro')}
      </Typography>

      {coordinatorBlocked ? (
        <Alert severity="warning">
          {t('reports.gradingConsolidated.coordinatorNoInstitution')}
        </Alert>
      ) : null}

      {downloadMutation.isError ? (
        <Alert severity="error">
          {getErrorMessage(downloadMutation.error)}
        </Alert>
      ) : null}

      <Paper className="p-4" component="form" onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <FormControl fullWidth required error={!!formState.errors.academic_year}>
            <InputLabel id="gcr-year-label">
              {t('reports.gradingConsolidated.fields.academicYear')}
            </InputLabel>
            <Controller
              name="academic_year"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-year-label"
                  label={t('reports.gradingConsolidated.fields.academicYear')}
                  disabled={yearsLoading || years.length === 0}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.pickYear')}</em>
                  </MenuItem>
                  {years.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {y.year}
                      {y.institution_name ? ` · ${y.institution_name}` : ''}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {formState.errors.academic_year?.message ? (
              <Typography variant="caption" color="error" className="mt-1">
                {t(formState.errors.academic_year.message)}
              </Typography>
            ) : null}
          </FormControl>

          <FormControl fullWidth disabled={!academicYearId}>
            <InputLabel id="gcr-period-label">
              {t('reports.gradingConsolidated.fields.academicPeriod')}
            </InputLabel>
            <Controller
              name="academic_period"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-period-label"
                  label={t('reports.gradingConsolidated.fields.academicPeriod')}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.allPeriods')}</em>
                  </MenuItem>
                  {periods.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>

          <FormControl fullWidth disabled={!institutionIdForYear}>
            <InputLabel id="gcr-campus-label">
              {t('reports.gradingConsolidated.fields.campus')}
            </InputLabel>
            <Controller
              name="campus"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-campus-label"
                  label={t('reports.gradingConsolidated.fields.campus')}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.any')}</em>
                  </MenuItem>
                  {campuses.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>

          <FormControl fullWidth disabled={!institutionIdForYear}>
            <InputLabel id="gcr-gl-label">
              {t('reports.gradingConsolidated.fields.gradeLevel')}
            </InputLabel>
            <Controller
              name="grade_level"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-gl-label"
                  label={t('reports.gradingConsolidated.fields.gradeLevel')}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.any')}</em>
                  </MenuItem>
                  {gradeLevels.map((gl) => (
                    <MenuItem key={gl.id} value={gl.id}>
                      {gl.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>

          <FormControl fullWidth disabled={!academicYearId}>
            <InputLabel id="gcr-group-label">
              {t('reports.gradingConsolidated.fields.group')}
            </InputLabel>
            <Controller
              name="group"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-group-label"
                  label={t('reports.gradingConsolidated.fields.group')}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.any')}</em>
                  </MenuItem>
                  {groups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      {g.name}
                      {g.grade_level_name ? ` (${g.grade_level_name})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>

          <FormControl fullWidth disabled={!institutionIdForYear}>
            <InputLabel id="gcr-area-label">
              {t('reports.gradingConsolidated.fields.academicArea')}
            </InputLabel>
            <Controller
              name="academic_area"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-area-label"
                  label={t('reports.gradingConsolidated.fields.academicArea')}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.any')}</em>
                  </MenuItem>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>

          <FormControl fullWidth disabled={!institutionIdForYear}>
            <InputLabel id="gcr-subject-label">
              {t('reports.gradingConsolidated.fields.subject')}
            </InputLabel>
            <Controller
              name="subject"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="gcr-subject-label"
                  label={t('reports.gradingConsolidated.fields.subject')}
                >
                  <MenuItem value="">
                    <em>{t('reports.gradingConsolidated.any')}</em>
                  </MenuItem>
                  {subjects.map((subj) => (
                    <MenuItem key={subj.id} value={subj.id}>
                      {subj.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>

          <Controller
            name="teacher"
            control={control}
            render={({ field }) => {
              const selected =
                teachers.find((x) => x.id === field.value) ?? null
              return (
                <Autocomplete<Teacher, false, false, false>
                  disabled={!academicYearId}
                  options={teachers}
                  value={selected}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  onInputChange={(_, v) => setTeacherSearch(v)}
                  getOptionLabel={(o) => o.full_name ?? o.id}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('reports.gradingConsolidated.fields.teacher')}
                      placeholder={t(
                        'reports.gradingConsolidated.teacherSearchPlaceholder',
                      )}
                    />
                  )}
                />
              )
            }}
          />

          <Button
            type="submit"
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={downloadMutation.isPending || years.length === 0}
          >
            {downloadMutation.isPending
              ? t('reports.gradingConsolidated.downloading')
              : t('reports.gradingConsolidated.download')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
