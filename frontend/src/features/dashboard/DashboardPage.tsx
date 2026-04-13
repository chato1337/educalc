import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { getErrorMessage } from '@/api/errors'
import { APP_NAME } from '@/app/appName'
import { resolvedAppRole } from '@/app/roleMatrix'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { fetchMe } from '@/features/auth/meApi'
import { useAcademicPeriodsForYear } from '@/features/operations/operationsQueries'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicPeriod, AcademicYear } from '@/types/schemas'

import { DashboardKpiCharts } from './DashboardKpiCharts'
import { fetchDashboardKpis } from './dashboardKpisApi'
import type { DashboardKpiCounts } from './dashboardKpis.types'

const shortcuts = [
  { titleKey: 'dashboard.shortcuts.institutions.title', bodyKey: 'dashboard.shortcuts.institutions.body', path: '/institutions' },
  { titleKey: 'dashboard.shortcuts.campuses.title', bodyKey: 'dashboard.shortcuts.campuses.body', path: '/campuses' },
  { titleKey: 'dashboard.shortcuts.students.title', bodyKey: 'dashboard.shortcuts.students.body', path: '/students' },
  { titleKey: 'dashboard.shortcuts.bulkLoad.title', bodyKey: 'dashboard.shortcuts.bulkLoad.body', path: '/bulk-load' },
  { titleKey: 'dashboard.shortcuts.academicYears.title', bodyKey: 'dashboard.shortcuts.academicYears.body', path: '/academic-years' },
  { titleKey: 'dashboard.shortcuts.groups.title', bodyKey: 'dashboard.shortcuts.groups.body', path: '/groups' },
]

type KpiKey = keyof DashboardKpiCounts

const KPI_SECTIONS: { titleKey: string; keys: readonly KpiKey[] }[] = [
  {
    titleKey: 'dashboard.kpis.sections.structure',
    keys: [
      'institutions',
      'campuses',
      'academic_years',
      'academic_years_active',
      'grade_levels',
      'groups',
      'academic_periods',
    ],
  },
  {
    titleKey: 'dashboard.kpis.sections.curriculum',
    keys: [
      'academic_areas',
      'subjects',
      'grading_scales',
      'course_assignments',
      'grade_directors',
    ],
  },
  {
    titleKey: 'dashboard.kpis.sections.people',
    keys: ['students', 'teachers', 'parents', 'student_guardians'],
  },
  {
    titleKey: 'dashboard.kpis.sections.enrollmentEval',
    keys: [
      'enrollments',
      'enrollments_active',
      'grades',
      'attendances',
      'academic_indicators',
      'performance_summaries',
      'disciplinary_reports',
    ],
  },
  {
    titleKey: 'dashboard.kpis.sections.records',
    keys: ['school_records', 'academic_indicators_reports'],
  },
]

function formatCount(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function yearMenuLabel(y: AcademicYear, t: (k: string) => string) {
  const base = String(y.year)
  if (y.is_active) return `${base} (${t('dashboard.kpis.gradesPeriod.activeYear')})`
  return base
}

function periodMenuLabel(p: AcademicPeriod) {
  return `${p.name} (P${p.number})`
}

export function DashboardPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const prevInstitutionId = useRef(selectedInstitutionId)

  const [kpiYearId, setKpiYearId] = useState<string | null>(null)
  const [kpiPeriodId, setKpiPeriodId] = useState<string | null>(null)

  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  })

  const effectiveRole = useMemo(
    () => resolvedAppRole(me?.role ?? user?.role),
    [me?.role, user?.role],
  )

  const kpiInstitutionParam = useMemo(() => {
    if (effectiveRole !== 'ADMIN') return null
    return selectedInstitutionId
  }, [effectiveRole, selectedInstitutionId])

  const { data: academicYears = [] } = useAcademicYearsQuery(selectedInstitutionId)

  useEffect(() => {
    if (prevInstitutionId.current !== selectedInstitutionId) {
      prevInstitutionId.current = selectedInstitutionId
      setKpiYearId(null)
      setKpiPeriodId(null)
    }
  }, [selectedInstitutionId])

  const defaultYearId = useMemo(() => {
    const active = academicYears.find((y) => y.is_active)
    return active?.id ?? academicYears[0]?.id ?? null
  }, [academicYears])

  useEffect(() => {
    if (!defaultYearId) return
    setKpiYearId((cur) => {
      if (cur != null && academicYears.some((y) => y.id === cur)) return cur
      return defaultYearId
    })
  }, [academicYears, defaultYearId])

  const { data: kpiPeriods = [] } = useAcademicPeriodsForYear(kpiYearId)

  useEffect(() => {
    if (kpiPeriods.length === 0) {
      setKpiPeriodId(null)
      return
    }
    setKpiPeriodId((cur) => {
      if (cur && kpiPeriods.some((p) => p.id === cur)) return cur
      const sorted = [...kpiPeriods].sort((a, b) => b.number - a.number)
      return sorted[0]?.id ?? null
    })
  }, [kpiPeriods])

  const {
    data: kpis,
    isPending: kpisLoading,
    isError: kpisError,
    error: kpisQueryError,
  } = useQuery({
    queryKey: queryKeys.dashboardKpis(kpiInstitutionParam, kpiPeriodId),
    queryFn: () => fetchDashboardKpis(kpiInstitutionParam, kpiPeriodId),
    staleTime: 30_000,
  })

  const scopeLabel = kpis
    ? t(`dashboard.kpis.scope.${kpis.scope}`)
    : ''

  const kpiErrorText = kpisError ? getErrorMessage(kpisQueryError) : null

  const gp = kpis?.grades_period

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle', { appName: APP_NAME })}
      />

      <Box className="flex flex-col gap-2">
        <Box className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Typography variant="h6" component="h2">
            {t('dashboard.kpis.title')}
          </Typography>
          {kpisLoading ? (
            <Skeleton variant="rounded" width={220} height={32} />
          ) : kpis ? (
            <Chip size="small" label={`${t('dashboard.kpis.scopeLabel')}: ${scopeLabel}`} />
          ) : null}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.kpis.subtitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {t('dashboard.kpis.chartsHint')}
        </Typography>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
          {t('dashboard.kpis.gradesPeriod.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {t('dashboard.kpis.gradesPeriod.hint')}
        </Typography>
        <Box className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end">
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
            <InputLabel id="dashboard-kpi-year-label">
              {t('dashboard.kpis.gradesPeriod.year')}
            </InputLabel>
            <Select
              labelId="dashboard-kpi-year-label"
              label={t('dashboard.kpis.gradesPeriod.year')}
              value={kpiYearId ?? ''}
              onChange={(e) => setKpiYearId(String(e.target.value) || null)}
              disabled={academicYears.length === 0}
            >
              {academicYears.map((y) => (
                <MenuItem key={y.id} value={y.id}>
                  {yearMenuLabel(y, t)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
            <InputLabel id="dashboard-kpi-period-label">
              {t('dashboard.kpis.gradesPeriod.period')}
            </InputLabel>
            <Select
              labelId="dashboard-kpi-period-label"
              label={t('dashboard.kpis.gradesPeriod.period')}
              value={kpiPeriodId ?? ''}
              onChange={(e) => setKpiPeriodId(String(e.target.value) || null)}
              disabled={!kpiYearId || kpiPeriods.length === 0}
            >
              {kpiPeriods.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {periodMenuLabel(p)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {gp ? (
          <Alert
            severity={gp.pending_students > 0 ? 'warning' : 'success'}
            variant="outlined"
          >
            <Typography variant="subtitle2" component="p">
              {gp.pending_students > 0
                ? t('dashboard.kpis.gradesPeriod.pendingStudents', {
                    count: gp.pending_students,
                    period: gp.academic_period_name,
                  })
                : t('dashboard.kpis.gradesPeriod.noPendingStudents', {
                    period: gp.academic_period_name,
                  })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.kpis.gradesPeriod.pendingSlots', { count: gp.pending_slots })}
              {' · '}
              {t('dashboard.kpis.gradesPeriod.filledLine', {
                filled: formatCount(gp.filled_slots),
                expected: formatCount(gp.expected_slots),
              })}
            </Typography>
          </Alert>
        ) : kpiPeriodId && kpis && !kpisError ? (
          <Typography variant="caption" color="text.secondary">
            {t('dashboard.kpis.gradesPeriod.unavailableProfile')}
          </Typography>
        ) : !kpiPeriodId ? (
          <Typography variant="caption" color="text.secondary">
            {t('dashboard.kpis.gradesPeriod.pickPeriod')}
          </Typography>
        ) : null}

        {kpisError ? (
          <Alert severity="error">
            {t('dashboard.kpis.error')}
            {kpiErrorText ? ` ${kpiErrorText}` : ''}
          </Alert>
        ) : null}
      </Box>

      {kpisLoading ? (
        <Box className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={72} />
          ))}
        </Box>
      ) : kpis ? (
        <Box className="flex flex-col gap-6">
          <DashboardKpiCharts
            counts={kpis.counts}
            gradesPeriod={kpis.grades_period}
            t={t}
          />
          <Typography variant="subtitle2" color="text.secondary">
            {t('dashboard.kpis.detailTitle')}
          </Typography>
          {KPI_SECTIONS.map((section) => (
            <Box key={section.titleKey} className="flex flex-col gap-2">
              <Typography variant="subtitle2" color="text.secondary">
                {t(section.titleKey)}
              </Typography>
              <Box className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {section.keys.map((key) => {
                  const value = kpis.counts[key]
                  const label = t(`dashboard.kpis.labels.${key}`)
                  return (
                    <Card key={key} variant="outlined">
                      <CardContent className="py-3">
                        <Typography variant="h6" component="p">
                          {formatCount(value)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="p">
                          {label}
                        </Typography>
                      </CardContent>
                    </Card>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      <Typography variant="subtitle1" component="h2" className="mt-2">
        {t('dashboard.shortcutsTitle')}
      </Typography>
      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shortcuts.map((s) => (
          <Card key={s.path} variant="outlined">
            <CardActionArea component={RouterLink} to={s.path}>
              <CardContent>
                <Typography variant="subtitle1" component="h2">
                  {t(s.titleKey)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(s.bodyKey)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
