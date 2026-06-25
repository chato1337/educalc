import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import GroupsIcon from '@mui/icons-material/Groups'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { ACTIVITY_GRADING_BASE } from '@/features/operations/activityGrading/activityGradingNav'
import {
  applyGradingSchemeSuggestion,
  applyGradingSchemeSuggestionBulk,
  fetchApplySuggestionBulkPreview,
  fetchGradingActivitiesForScheme,
  fetchGradingSchemeBreakdown,
  fetchStudentActivityScoresForScheme,
  type ApplySuggestionBulkResponse,
  type GradeBreakdown,
  type GradingScheme,
} from '@/features/operations/gradingApi'
import { fetchAllEnrollments } from '@/features/operations/operationsQueries'
import type { Enrollment } from '@/types/schemas'

export type GradingSchemeBreakdownPanelProps = {
  scheme: GradingScheme
}

type BreakdownHelp = {
  severity: 'info' | 'warning' | 'error'
  message: string
  linkTo?: { label: string; to: string }
  pendingActivities?: Array<{ name: string; activity_date: string }>
}

type StudentReadiness = 'weights_invalid' | 'no_activities' | 'no_scores' | 'incomplete' | 'ready'

function schemeDetailPath(schemeId: string, tab: 0 | 1 | 2): string {
  return `${ACTIVITY_GRADING_BASE}/schemes/${schemeId}?tab=${tab}`
}

function schemeWeightsValid(scheme: GradingScheme): boolean {
  return (
    scheme.subject_component_weights_valid === true &&
    scheme.segment_weights_valid === true
  )
}

function getBreakdownHelp(
  breakdown: GradeBreakdown | undefined,
  error: unknown,
  scheme: GradingScheme,
): BreakdownHelp[] {
  const helps: BreakdownHelp[] = []
  const structureLink = {
    label: 'linkGoToStructure',
    to: schemeDetailPath(scheme.id, 0),
  }
  const scoresLink = {
    label: 'linkGoToScores',
    to: schemeDetailPath(scheme.id, 1),
  }

  if (!schemeWeightsValid(scheme)) {
    helps.push({
      severity: 'warning',
      message: 'helpInvalidWeights',
      linkTo: structureLink,
    })
  }

  if (error) {
    helps.push({
      severity: 'error',
      message: getErrorMessage(error),
      linkTo: structureLink,
    })
    return helps
  }

  if (!breakdown) return helps

  const allActivities = breakdown.components.flatMap((component) =>
    component.segments.flatMap((segment) => segment.activities),
  )

  if (allActivities.length === 0) {
    helps.push({
      severity: 'info',
      message: 'helpNoActivities',
      linkTo: structureLink,
    })
    return helps
  }

  const pending = allActivities.filter(
    (activity) => activity.score == null || activity.score === '',
  )

  if (breakdown.suggested_grade == null || breakdown.suggested_grade === '') {
    if (pending.length > 0) {
      helps.push({
        severity: 'warning',
        message: 'helpMissingScores',
        linkTo: scoresLink,
        pendingActivities: pending.slice(0, 8).map((activity) => ({
          name: activity.name,
          activity_date: activity.activity_date,
        })),
      })
    } else {
      helps.push({
        severity: 'warning',
        message: 'helpInsufficientData',
        linkTo: scoresLink,
      })
    }
  }

  return helps
}

function canApplySuggestion(
  breakdown: GradeBreakdown | undefined,
  scheme: GradingScheme,
  error: unknown,
): boolean {
  if (error || !breakdown || !schemeWeightsValid(scheme)) return false
  return (
    breakdown.suggested_grade != null && breakdown.suggested_grade !== ''
  )
}

function BreakdownTree({ breakdown }: { breakdown: GradeBreakdown }) {
  const { t } = useTranslation()
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">
        {t('gradingSchemes.suggestedGrade')}:{' '}
        <strong>
          {breakdown.suggested_grade != null && breakdown.suggested_grade !== ''
            ? breakdown.suggested_grade
            : '—'}
        </strong>
      </Typography>
      {breakdown.components.map((component) => (
        <Paper key={component.component_id} variant="outlined" sx={{ p: 2 }}>
          <Typography fontWeight={600}>
            {component.name} ({component.weight_percent}%)
            {component.component_score != null
              ? ` → ${component.component_score}`
              : ''}
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1, pl: 1 }}>
            {component.segments.map((segment) => (
              <Box key={segment.segment_id}>
                <Typography variant="body2" fontWeight={500}>
                  {segment.name} ({segment.weight_percent}%)
                  {segment.segment_average != null
                    ? ` · prom. ${segment.segment_average}`
                    : ''}
                </Typography>
                <Stack spacing={0.25} sx={{ pl: 2, mt: 0.5 }}>
                  {segment.activities.map((activity) => (
                    <Typography key={activity.activity_id} variant="caption">
                      {activity.name} ({activity.activity_date}):{' '}
                      {activity.score != null && activity.score !== ''
                        ? activity.score
                        : '—'}{' '}
                      / {activity.max_score}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

function BreakdownHelpAlerts({
  helps,
  missingScoreCount,
}: {
  helps: BreakdownHelp[]
  missingScoreCount?: number
}) {
  const { t } = useTranslation()

  if (helps.length === 0) return null

  return (
    <Stack spacing={1}>
      {helps.map((help, index) => (
        <Alert key={index} severity={help.severity}>
          <Stack spacing={0.75}>
            <Typography variant="body2">
              {help.message.startsWith('help')
                ? t(`gradingSchemes.${help.message}`, {
                    count: missingScoreCount ?? 0,
                  })
                : help.message}
            </Typography>
            {help.pendingActivities && help.pendingActivities.length > 0 ? (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {help.pendingActivities.map((activity) => (
                  <Typography
                    key={`${activity.name}-${activity.activity_date}`}
                    component="li"
                    variant="caption"
                  >
                    {activity.name} ({activity.activity_date})
                  </Typography>
                ))}
              </Box>
            ) : null}
            {help.linkTo ? (
              <Link component={RouterLink} to={help.linkTo.to} underline="hover">
                {t(`gradingSchemes.${help.linkTo.label}`)}
              </Link>
            ) : null}
          </Stack>
        </Alert>
      ))}
    </Stack>
  )
}

type StudentAccordionItemProps = {
  enrollment: Enrollment
  scheme: GradingScheme
  expanded: boolean
  onToggle: (studentId: string, expanded: boolean) => void
  readiness: StudentReadiness
  scoredActivities: number
  totalActivities: number
}

function StudentAccordionItem({
  enrollment,
  scheme,
  expanded,
  onToggle,
  readiness,
  scoredActivities,
  totalActivities,
}: StudentAccordionItemProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  const breakdownQuery = useQuery({
    queryKey: queryKeys.gradingSchemeBreakdown(scheme.id, enrollment.student),
    queryFn: () =>
      fetchGradingSchemeBreakdown(scheme.id, enrollment.student),
    enabled: expanded && schemeWeightsValid(scheme),
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      applyGradingSchemeSuggestion(scheme.id, enrollment.student),
    onSuccess: (data) => {
      setApplyError(null)
      setApplyMessage(
        t('gradingSchemes.applySuccess', {
          grade: data.numerical_grade,
          level: data.performance_level_name ?? '—',
          created: data.created
            ? t('gradingSchemes.gradeCreated')
            : t('gradingSchemes.gradeUpdated'),
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
    },
    onError: (error) => {
      setApplyMessage(null)
      setApplyError(getErrorMessage(error))
    },
  })

  const helps = getBreakdownHelp(
    breakdownQuery.data,
    breakdownQuery.error,
    scheme,
  )
  const missingScoreCount = breakdownQuery.data
    ? breakdownQuery.data.components
        .flatMap((component) => component.segments)
        .flatMap((segment) => segment.activities)
        .filter(
          (activity) => activity.score == null || activity.score === '',
        ).length
    : undefined

  const readinessChip = (() => {
    switch (readiness) {
      case 'weights_invalid':
        return (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={t('gradingSchemes.readinessWeightsInvalid')}
          />
        )
      case 'no_activities':
        return (
          <Chip
            size="small"
            color="default"
            variant="outlined"
            label={t('gradingSchemes.readinessNoActivities')}
          />
        )
      case 'no_scores':
        return (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={t('gradingSchemes.readinessNoScores')}
          />
        )
      case 'incomplete':
        return (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={t('gradingSchemes.readinessIncomplete', {
              scored: scoredActivities,
              total: totalActivities,
            })}
          />
        )
      default:
        if (breakdownQuery.data?.suggested_grade) {
          return (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={`${t('gradingSchemes.suggestedGrade')}: ${breakdownQuery.data.suggested_grade}`}
            />
          )
        }
        return (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={t('gradingSchemes.readinessReady')}
          />
        )
    }
  })()

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(enrollment.student, isExpanded)}
      disableGutters
      variant="outlined"
      sx={{ '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ width: '100%', pr: 1 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={600}>{enrollment.student_name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {enrollment.student_document_number}
            </Typography>
          </Box>
          {readinessChip}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {!schemeWeightsValid(scheme) ? (
            <BreakdownHelpAlerts
              helps={getBreakdownHelp(undefined, undefined, scheme)}
            />
          ) : null}

          {expanded && breakdownQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('common.loading')}
            </Typography>
          ) : null}

          {breakdownQuery.data ? (
            <>
              <BreakdownHelpAlerts
                helps={helps}
                missingScoreCount={missingScoreCount}
              />
              <BreakdownTree breakdown={breakdownQuery.data} />
              <Button
                variant="contained"
                startIcon={<CheckCircleOutlineIcon />}
                disabled={
                  applyMutation.isPending ||
                  !canApplySuggestion(
                    breakdownQuery.data,
                    scheme,
                    breakdownQuery.error,
                  )
                }
                onClick={() => {
                  setApplyMessage(null)
                  setApplyError(null)
                  applyMutation.mutate()
                }}
              >
                {t('gradingSchemes.applySuggestion')}
              </Button>
            </>
          ) : null}

          {breakdownQuery.error && !breakdownQuery.data ? (
            <BreakdownHelpAlerts
              helps={getBreakdownHelp(undefined, breakdownQuery.error, scheme)}
            />
          ) : null}

          {applyMessage ? <Alert severity="success">{applyMessage}</Alert> : null}
          {applyError ? <Alert severity="error">{applyError}</Alert> : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

type BulkApplySuggestionDialogProps = {
  open: boolean
  onClose: () => void
  scheme: GradingScheme
  groupId: string | undefined
  onApplied: (result: ApplySuggestionBulkResponse) => void
}

function BulkApplySuggestionDialog({
  open,
  onClose,
  scheme,
  groupId,
  onApplied,
}: BulkApplySuggestionDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const previewQuery = useQuery({
    queryKey: queryKeys.gradingSchemeBulkPreview(scheme.id),
    queryFn: () => fetchApplySuggestionBulkPreview(scheme.id),
    enabled: open,
  })

  const applyMutation = useMutation({
    mutationFn: () => applyGradingSchemeSuggestionBulk(scheme.id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      if (groupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.groupRankings(groupId),
        })
      }
      void queryClient.invalidateQueries({
        queryKey: ['grading-schemes', scheme.id, 'breakdown'],
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gradingSchemeBulkPreview(scheme.id),
      })
      onApplied(result)
      onClose()
    },
  })

  const preview = previewQuery.data
  const previewError = previewQuery.error
    ? getErrorMessage(previewQuery.error)
    : null
  const canConfirm =
    !!preview &&
    preview.eligible_count > 0 &&
    !previewQuery.isLoading &&
    !applyMutation.isPending

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('gradingSchemes.bulkApplyDialogTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Alert severity="warning">
            {t('gradingSchemes.bulkApplyDialogWarning')}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            {t('gradingSchemes.bulkApplyDialogScope')}
          </Typography>

          {previewQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('gradingSchemes.bulkApplyPreviewLoading')}
            </Typography>
          ) : null}

          {previewError ? (
            <Alert severity="error">{previewError}</Alert>
          ) : null}

          {preview ? (
            <>
              {preview.eligible_count === 0 ? (
                <Alert severity="info">
                  {t('gradingSchemes.bulkApplyNoEligible')}
                </Alert>
              ) : (
                <Alert severity="info">
                  {t('gradingSchemes.bulkApplyPreviewSummary', {
                    eligible: preview.eligible_count,
                    enrolled: preview.enrolled_count,
                    skipped: preview.skipped_count,
                  })}
                </Alert>
              )}

              {preview.skipped.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('gradingSchemes.bulkApplySkippedTitle', {
                      count: preview.skipped_count,
                    })}
                  </Typography>
                  <Stack spacing={0.5}>
                    {preview.skipped.slice(0, 12).map((item) => (
                      <Typography
                        key={item.student_id}
                        variant="caption"
                        color="text.secondary"
                      >
                        {item.reason === 'incomplete_scores'
                          ? t('gradingSchemes.bulkApplySkippedIncomplete', {
                              name: item.student_name,
                              scored: item.scored_activities,
                              total: item.total_activities,
                            })
                          : t('gradingSchemes.bulkApplySkippedUnavailable', {
                              name: item.student_name,
                            })}
                      </Typography>
                    ))}
                    {preview.skipped.length > 12 ? (
                      <Typography variant="caption" color="text.secondary">
                        …
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}
            </>
          ) : null}

          {applyMutation.error ? (
            <Alert severity="error">
              {getErrorMessage(applyMutation.error)}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={applyMutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!canConfirm}
          onClick={() => applyMutation.mutate()}
        >
          {preview && preview.eligible_count > 0
            ? t('gradingSchemes.bulkApplyConfirm', {
                count: preview.eligible_count,
              })
            : t('gradingSchemes.applySuggestionBulk')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function GradingSchemeBreakdownPanel({
  scheme,
}: GradingSchemeBreakdownPanelProps) {
  const { t } = useTranslation()
  const [filterText, setFilterText] = useState('')
  const [expandedStudentId, setExpandedStudentId] = useState<string | false>(
    false,
  )
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkApplyMessage, setBulkApplyMessage] = useState<string | null>(null)

  const { data: courseAssignment, isLoading: courseAssignmentLoading } =
    useQuery({
      queryKey: ['course-assignments', 'detail', scheme.course_assignment],
      queryFn: async () => {
        const { data } = await apiClient.get<{
          group: string
          academic_year: string
        }>(`/api/course-assignments/${scheme.course_assignment}/`)
        return data
      },
    })

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: queryKeys.enrollments({
      academic_year: courseAssignment?.academic_year,
      group: courseAssignment?.group,
      status: 'active',
    }),
    queryFn: () =>
      fetchAllEnrollments({
        academic_year: courseAssignment!.academic_year,
        group: courseAssignment!.group,
        status: 'active',
      }),
    enabled: !!courseAssignment?.academic_year && !!courseAssignment?.group,
  })

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: [...queryKeys.gradingSchemeStructure(scheme.id), 'activities'],
    queryFn: () => fetchGradingActivitiesForScheme(scheme.id),
  })

  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: [...queryKeys.gradingSchemeStructure(scheme.id), 'scores'],
    queryFn: () => fetchStudentActivityScoresForScheme(scheme.id),
  })

  const scoredByStudent = useMemo(() => {
    const map = new Map<string, number>()
    for (const score of scores) {
      if (score.score == null || score.score === '') continue
      map.set(score.student, (map.get(score.student) ?? 0) + 1)
    }
    return map
  }, [scores])

  const sortedEnrollments = useMemo(
    () =>
      [...enrollments].sort((a, b) =>
        a.student_name.localeCompare(b.student_name, 'es'),
      ),
    [enrollments],
  )

  const filteredEnrollments = useMemo(() => {
    const query = filterText.trim().toLowerCase()
    if (!query) return sortedEnrollments
    return sortedEnrollments.filter(
      (enrollment) =>
        enrollment.student_name.toLowerCase().includes(query) ||
        enrollment.student_document_number.toLowerCase().includes(query),
    )
  }, [filterText, sortedEnrollments])

  const totalActivities = activities.length
  const weightsValid = schemeWeightsValid(scheme)

  const eligibleCount = useMemo(() => {
    if (!weightsValid || totalActivities === 0) return 0
    return sortedEnrollments.filter(
      (enrollment) =>
        (scoredByStudent.get(enrollment.student) ?? 0) >= totalActivities,
    ).length
  }, [sortedEnrollments, scoredByStudent, totalActivities, weightsValid])

  function getStudentReadiness(studentId: string): StudentReadiness {
    if (!weightsValid) return 'weights_invalid'
    if (totalActivities === 0) return 'no_activities'
    const scored = scoredByStudent.get(studentId) ?? 0
    if (scored === 0) return 'no_scores'
    if (scored < totalActivities) return 'incomplete'
    return 'ready'
  }

  const loading =
    courseAssignmentLoading ||
    enrollmentsLoading ||
    activitiesLoading ||
    scoresLoading

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="body2" color="text.secondary">
        {t('gradingSchemes.breakdownHint')}
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        flexWrap="wrap"
      >
        <TextField
          size="small"
          label={t('gradingSchemes.filterStudents')}
          placeholder={t('gradingSchemes.filterStudentsPlaceholder')}
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          sx={{ flex: { sm: 1 }, minWidth: 200, maxWidth: { sm: 480 } }}
        />
        <Button
          variant="contained"
          color="secondary"
          startIcon={<GroupsIcon />}
          disabled={loading || eligibleCount === 0}
          onClick={() => {
            setBulkApplyMessage(null)
            setBulkDialogOpen(true)
          }}
          sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          {t('gradingSchemes.applySuggestionBulk')}
        </Button>
        {!loading && eligibleCount === 0 && weightsValid && totalActivities > 0 ? (
          <Typography variant="caption" color="text.secondary">
            {t('gradingSchemes.applySuggestionBulkDisabled')}
          </Typography>
        ) : null}
      </Stack>

      {bulkApplyMessage ? (
        <Alert severity="success">{bulkApplyMessage}</Alert>
      ) : null}

      <BulkApplySuggestionDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        scheme={scheme}
        groupId={courseAssignment?.group}
        onApplied={(result) => {
          setBulkApplyMessage(
            [
              t('gradingSchemes.bulkApplySuccess', {
                applied: result.applied_count,
                created: result.created_count,
                updated: result.updated_count,
                skipped: result.skipped_count,
              }),
              result.ranking_recalculated
                ? t('gradingSchemes.bulkApplyRankingRecalculated')
                : null,
            ]
              .filter(Boolean)
              .join(' '),
          )
        }}
      />

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      ) : null}

      {!loading && filteredEnrollments.length === 0 ? (
        <Alert severity="info">{t('gradingSchemes.studentsBreakdownEmpty')}</Alert>
      ) : null}

      {!loading && filteredEnrollments.length > 0 ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            {t('gradingSchemes.studentsBreakdownTitle', {
              count: filteredEnrollments.length,
            })}
          </Typography>
          {filteredEnrollments.map((enrollment) => (
            <StudentAccordionItem
              key={enrollment.id}
              enrollment={enrollment}
              scheme={scheme}
              expanded={expandedStudentId === enrollment.student}
              onToggle={(studentId, isExpanded) =>
                setExpandedStudentId(isExpanded ? studentId : false)
              }
              readiness={getStudentReadiness(enrollment.student)}
              scoredActivities={scoredByStudent.get(enrollment.student) ?? 0}
              totalActivities={totalActivities}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  )
}
