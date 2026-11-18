import DownloadIcon from '@mui/icons-material/Download'
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { resolvedAppRole } from '@/app/roleMatrix'
import {
  useAcademicYearsQuery,
  useCampusesForInstitution,
  useGradeLevelsQuery,
} from '@/features/academic-structure/academicQueries'
import { fetchMe } from '@/features/auth/meApi'
import {
  downloadFailingStudentsCsv,
  type FailingStudentsCsvQuery,
} from '@/features/reports/failingStudentsReportApi'
import { useGroupsForFilters } from '@/features/operations/operationsQueries'
import { PageHeader } from '@/components/PageHeader'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicYear } from '@/types/schemas'

const uuidOrEmpty = z.union([z.string().uuid(), z.literal('')])

const formSchema = z.object({
  academic_year: z
    .string()
    .min(1, 'reports.failingStudents.errors.yearRequired')
    .uuid('reports.failingStudents.errors.yearInvalid'),
  campus: uuidOrEmpty,
  grade_level: uuidOrEmpty,
  group: uuidOrEmpty,
})

type FormValues = z.infer<typeof formSchema>

function toQuery(values: FormValues): FailingStudentsCsvQuery {
  const q: FailingStudentsCsvQuery = {
    academic_year: values.academic_year,
  }
  const add = (k: keyof FormValues, key: keyof FailingStudentsCsvQuery) => {
    const v = values[k]
    if (typeof v === 'string' && v.trim() !== '') {
      ;(q as Record<string, string>)[key as string] = v.trim()
    }
  }
  add('campus', 'campus')
  add('grade_level', 'grade_level')
  add('group', 'group')
  return q
}

export function FailingStudentsReportPage() {
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
      campus: '',
      grade_level: '',
      group: '',
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
    resetField('campus')
    resetField('grade_level')
    resetField('group')
  }, [academicYearId, resetField])

  const { data: campusesData } = useCampusesForInstitution(institutionIdForYear)
  const campuses = campusesData ?? []

  const { data: gradeLevelsData } = useGradeLevelsQuery(institutionIdForYear)
  const gradeLevels = gradeLevelsData ?? []

  const { data: groupsData } = useGroupsForFilters(institutionIdForYear, {
    academic_year: academicYearId || undefined,
    campus: campusId || undefined,
    grade_level: gradeLevelId || undefined,
  })
  const groups = groupsData ?? []

  const downloadMutation = useMutation({
    mutationFn: downloadFailingStudentsCsv,
  })

  const onSubmit = (values: FormValues) => {
    downloadMutation.mutate(toQuery(values))
  }

  const coordinatorBlocked =
    role === 'COORDINATOR' &&
    !(me?.institution_id ?? user?.institution_id ?? '').trim()

  return (
    <Box className="p-4 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-4">
      <PageHeader title={t('reports.failingStudents.title')} />
      <Typography variant="body2" color="text.secondary">
        {t('reports.failingStudents.intro')}
      </Typography>

      {coordinatorBlocked ? (
        <Alert severity="warning">
          {t('reports.failingStudents.coordinatorNoInstitution')}
        </Alert>
      ) : null}

      {downloadMutation.isError ? (
        <Alert severity="error">{getErrorMessage(downloadMutation.error)}</Alert>
      ) : null}

      <Paper className="p-4" component="form" onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <FormControl fullWidth required error={!!formState.errors.academic_year}>
            <InputLabel id="fsr-year-label">
              {t('reports.failingStudents.fields.academicYear')}
            </InputLabel>
            <Controller
              name="academic_year"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="fsr-year-label"
                  label={t('reports.failingStudents.fields.academicYear')}
                  disabled={yearsLoading || years.length === 0}
                >
                  <MenuItem value="">
                    <em>{t('reports.failingStudents.pickYear')}</em>
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

          <FormControl fullWidth disabled={!institutionIdForYear}>
            <InputLabel id="fsr-campus-label">
              {t('reports.failingStudents.fields.campus')}
            </InputLabel>
            <Controller
              name="campus"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="fsr-campus-label"
                  label={t('reports.failingStudents.fields.campus')}
                >
                  <MenuItem value="">
                    <em>{t('reports.failingStudents.any')}</em>
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
            <InputLabel id="fsr-gl-label">
              {t('reports.failingStudents.fields.gradeLevel')}
            </InputLabel>
            <Controller
              name="grade_level"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="fsr-gl-label"
                  label={t('reports.failingStudents.fields.gradeLevel')}
                >
                  <MenuItem value="">
                    <em>{t('reports.failingStudents.any')}</em>
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
            <InputLabel id="fsr-group-label">
              {t('reports.failingStudents.fields.group')}
            </InputLabel>
            <Controller
              name="group"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="fsr-group-label"
                  label={t('reports.failingStudents.fields.group')}
                >
                  <MenuItem value="">
                    <em>{t('reports.failingStudents.any')}</em>
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

          <Button
            type="submit"
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={
              downloadMutation.isPending ||
              years.length === 0 ||
              coordinatorBlocked
            }
          >
            {downloadMutation.isPending
              ? t('reports.failingStudents.downloading')
              : t('reports.failingStudents.download')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
