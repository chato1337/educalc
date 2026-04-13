import { Box, Card, CardContent, Typography, useTheme } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type { ChartOptions } from 'chart.js'
import { useMemo, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Bar, Doughnut } from 'react-chartjs-2'

import type { DashboardGradesPeriodKpi, DashboardKpiCounts } from './dashboardKpis.types'

import './registerDashboardCharts'

/** Keys considered for the “main volume” horizontal bar (sorted by value, top N). */
const BAR_CANDIDATE_KEYS: (keyof DashboardKpiCounts)[] = [
  'students',
  'enrollments',
  'enrollments_active',
  'grades',
  'attendances',
  'academic_indicators',
  'performance_summaries',
  'course_assignments',
  'groups',
  'teachers',
  'parents',
  'subjects',
  'school_records',
  'academic_indicators_reports',
]

const BAR_TOP_N = 8

function chartTextColor(theme: Theme) {
  return theme.palette.text.secondary
}

function chartGridColor(theme: Theme) {
  return theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
}

function sharedTooltip(theme: Theme) {
  return {
    bodyFont: { family: theme.typography.fontFamily },
    titleFont: { family: theme.typography.fontFamily },
  }
}

function sharedLegend(theme: Theme, display: boolean) {
  return {
    display,
    labels: {
      color: chartTextColor(theme),
      boxWidth: 12,
      font: { family: theme.typography.fontFamily },
    },
  }
}

type Props = {
  counts: DashboardKpiCounts
  /** Period scope: filled vs pending grade slots (student×assignment). */
  gradesPeriod?: DashboardGradesPeriodKpi | null
  t: TFunction
}

export function DashboardKpiCharts({ counts, gradesPeriod = null, t }: Props) {
  const theme = useTheme()

  const barConfig = useMemo(() => {
    const pairs = BAR_CANDIDATE_KEYS.map((key) => ({
      key,
      value: Math.max(0, Number(counts[key]) || 0),
    }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, BAR_TOP_N)

    if (pairs.length === 0) {
      return null
    }

    const labels = pairs.map((p) => t(`dashboard.kpis.labels.${p.key}`))
    const data = pairs.map((p) => p.value)

    return {
      labels,
      datasets: [
        {
          label: t('dashboard.kpis.charts.barDataset'),
          data,
          backgroundColor: theme.palette.primary.main,
          borderColor: theme.palette.primary.dark,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    }
  }, [counts, t, theme.palette.primary.dark, theme.palette.primary.main])

  const enrollmentConfig = useMemo(() => {
    const total = Math.max(0, counts.enrollments)
    const active = Math.max(0, counts.enrollments_active)
    const other = Math.max(0, total - active)
    if (total <= 0) return null
    return {
      labels: [
        t('dashboard.kpis.charts.enrollmentActive'),
        t('dashboard.kpis.charts.enrollmentOther'),
      ],
      datasets: [
        {
          data: [active, other],
          backgroundColor: [
            theme.palette.success.main,
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          ],
          borderColor: theme.palette.background.paper,
          borderWidth: 2,
        },
      ],
    }
  }, [counts.enrollments, counts.enrollments_active, t, theme.palette])

  const peopleConfig = useMemo(() => {
    const s = Math.max(0, counts.students)
    const te = Math.max(0, counts.teachers)
    const p = Math.max(0, counts.parents)
    const sum = s + te + p
    if (sum <= 0) return null
    return {
      labels: [
        t('dashboard.kpis.labels.students'),
        t('dashboard.kpis.labels.teachers'),
        t('dashboard.kpis.labels.parents'),
      ],
      datasets: [
        {
          data: [s, te, p],
          backgroundColor: [
            theme.palette.primary.main,
            theme.palette.secondary.main,
            theme.palette.warning.main,
          ],
          borderColor: theme.palette.background.paper,
          borderWidth: 2,
        },
      ],
    }
  }, [counts.parents, counts.students, counts.teachers, t, theme.palette])

  const barOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: chartTextColor(theme), font: { family: theme.typography.fontFamily } },
          grid: { color: chartGridColor(theme) },
        },
        y: {
          ticks: { color: chartTextColor(theme), font: { family: theme.typography.fontFamily } },
          grid: { display: false },
        },
      },
      plugins: {
        legend: sharedLegend(theme, false),
        tooltip: sharedTooltip(theme),
        title: {
          display: true,
          text: t('dashboard.kpis.charts.barTitle'),
          color: theme.palette.text.primary,
          font: { family: theme.typography.fontFamily, size: 14, weight: 600 },
        },
      },
    }),
    [t, theme],
  )

  const doughnutOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: sharedLegend(theme, true),
        tooltip: sharedTooltip(theme),
        title: {
          display: true,
          text: t('dashboard.kpis.charts.enrollmentTitle'),
          color: theme.palette.text.primary,
          font: { family: theme.typography.fontFamily, size: 13, weight: 600 },
        },
      },
    }),
    [t, theme],
  )

  const peopleDoughnutOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: sharedLegend(theme, true),
        tooltip: sharedTooltip(theme),
        title: {
          display: true,
          text: t('dashboard.kpis.charts.peopleTitle'),
          color: theme.palette.text.primary,
          font: { family: theme.typography.fontFamily, size: 13, weight: 600 },
        },
      },
    }),
    [t, theme],
  )

  const gradesPeriodConfig = useMemo(() => {
    if (!gradesPeriod) return null
    const filled = Math.max(0, gradesPeriod.filled_slots)
    const pending = Math.max(0, gradesPeriod.pending_slots)
    const expected = filled + pending
    if (expected <= 0) return null
    return {
      labels: [
        t('dashboard.kpis.charts.gradesFilledSlots'),
        t('dashboard.kpis.charts.gradesPendingSlots'),
      ],
      datasets: [
        {
          data: [filled, pending],
          backgroundColor: [
            theme.palette.success.main,
            theme.palette.warning.main,
          ],
          borderColor: theme.palette.background.paper,
          borderWidth: 2,
        },
      ],
    }
  }, [gradesPeriod, t, theme.palette])

  const gradesPeriodOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: sharedLegend(theme, true),
        tooltip: sharedTooltip(theme),
        title: {
          display: true,
          text: t('dashboard.kpis.charts.gradesPeriodTitle'),
          color: theme.palette.text.primary,
          font: { family: theme.typography.fontFamily, size: 14, weight: 600 },
        },
      },
    }),
    [t, theme],
  )

  const hasSideCharts = Boolean(enrollmentConfig || peopleConfig)
  const barWithSide = Boolean(barConfig && hasSideCharts)
  const hasGradesPeriodChart = Boolean(gradesPeriodConfig)

  const enrollmentCard = enrollmentConfig ? (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ height: 220, width: '100%' }}>
          <Doughnut data={enrollmentConfig} options={doughnutOptions} />
        </Box>
      </CardContent>
    </Card>
  ) : null

  const peopleCard = peopleConfig ? (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ height: 220, width: '100%' }}>
          <Doughnut data={peopleConfig} options={peopleDoughnutOptions} />
        </Box>
      </CardContent>
    </Card>
  ) : null

  const barCard = barConfig ? (
    <Card variant="outlined" className={barWithSide ? 'lg:col-span-2' : ''}>
      <CardContent>
        <Box sx={{ height: 280, width: '100%' }}>
          <Bar data={barConfig} options={barOptions} />
        </Box>
      </CardContent>
    </Card>
  ) : null

  let volumeSection: ReactNode = null
  if (barWithSide) {
    volumeSection = (
      <Box className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {barCard}
        <Box className="flex flex-col gap-3">
          {enrollmentCard}
          {peopleCard}
        </Box>
      </Box>
    )
  } else if (barConfig) {
    volumeSection = <Box className="grid grid-cols-1 gap-3">{barCard}</Box>
  } else if (enrollmentConfig || peopleConfig) {
    volumeSection = (
      <Box
        className={
          enrollmentConfig && peopleConfig
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
            : 'grid grid-cols-1 gap-3'
        }
      >
        {enrollmentCard}
        {peopleCard}
      </Box>
    )
  }

  if (!volumeSection && !hasGradesPeriodChart) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('dashboard.kpis.charts.noData')}
      </Typography>
    )
  }

  const gradesPeriodCard =
    gradesPeriodConfig && gradesPeriod ? (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            {gradesPeriod.academic_period_name}
          </Typography>
          <Box
            sx={{
              height: 240,
              width: '100%',
              maxWidth: 420,
              mx: 'auto',
            }}
          >
            <Doughnut data={gradesPeriodConfig} options={gradesPeriodOptions} />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, textAlign: 'center' }}
          >
            {t('dashboard.kpis.charts.gradesPeriodStudentsLine', {
              count: gradesPeriod.pending_students,
            })}
          </Typography>
        </CardContent>
      </Card>
    ) : null

  return (
    <Box className="flex flex-col gap-3">
      {volumeSection}
      {gradesPeriodCard}
    </Box>
  )
}
