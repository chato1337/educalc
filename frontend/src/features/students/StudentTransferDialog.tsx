import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
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
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import {
  useCampusesForInstitution,
  useGradeLevelsQuery,
  useGroupsForFilters,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type { Campus, Enrollment, GradeLevel, Group } from '@/types/schemas'

import {
  transferStudent,
  useActiveEnrollmentsForStudent,
  type StudentTransferErrorCode,
  type StudentTransferResponse,
} from './studentTransferApi'

const schema = z.object({
  campus: z.string().optional(),
  grade_level: z.string().optional(),
  target_group_id: z.string().uuid('Selecciona el grupo destino'),
  transfer_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function groupOptionLabel(g: Group): string {
  const parts = [g.name]
  if (g.campus_name) parts.push(g.campus_name)
  if (g.grade_level_name) parts.push(g.grade_level_name)
  return parts.join(' — ')
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

type Props = {
  open: boolean
  onClose: () => void
  studentId: string
  studentName?: string
  /** Matrícula origen cuando se abre desde el listado de matrículas. */
  sourceEnrollment?: Enrollment | null
  onSuccess?: () => void
}

export function StudentTransferDialog({
  open,
  onClose,
  studentId,
  studentName,
  sourceEnrollment,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<StudentTransferResponse | null>(null)
  const [pickedEnrollmentId, setPickedEnrollmentId] = useState<string>('')

  const { data: activeEnrollments = [], isLoading: enrollmentsLoading } =
    useActiveEnrollmentsForStudent(studentId, {
      enabled: open && !sourceEnrollment,
    })

  const enrollmentOptions = sourceEnrollment
    ? [sourceEnrollment]
    : activeEnrollments

  const sourceEnrollmentResolved = useMemo(() => {
    if (sourceEnrollment) return sourceEnrollment
    if (enrollmentOptions.length === 1) return enrollmentOptions[0]
    return (
      enrollmentOptions.find((e) => e.id === pickedEnrollmentId) ?? null
    )
  }, [sourceEnrollment, enrollmentOptions, pickedEnrollmentId])

  useEffect(() => {
    if (!open) return
    if (sourceEnrollment) {
      setPickedEnrollmentId(sourceEnrollment.id)
      return
    }
    if (enrollmentOptions.length === 1) {
      setPickedEnrollmentId(enrollmentOptions[0].id)
    }
  }, [open, sourceEnrollment, enrollmentOptions])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      campus: '',
      grade_level: '',
      target_group_id: '',
      transfer_date: todayIsoDate(),
    },
  })

  const watchedCampus = useWatch({ control: form.control, name: 'campus' })
  const watchedGradeLevel = useWatch({
    control: form.control,
    name: 'grade_level',
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      campus: '',
      grade_level: '',
      target_group_id: '',
      transfer_date: todayIsoDate(),
    })
    setFormError(null)
    setConfirming(false)
    setResult(null)
  }, [open, studentId, form])

  useEffect(() => {
    form.setValue('target_group_id', '')
  }, [watchedCampus, watchedGradeLevel, sourceEnrollmentResolved?.id, form])

  const { data: campuses = [] } = useCampusesForInstitution(
    selectedInstitutionId,
  )
  const { data: gradeLevels = [] } = useGradeLevelsQuery(selectedInstitutionId)

  const { data: targetGroups = [], isLoading: groupsLoading } =
    useGroupsForFilters(
      selectedInstitutionId,
      {
        academic_year: sourceEnrollmentResolved?.academic_year ?? null,
        campus: watchedCampus || null,
        grade_level: watchedGradeLevel || null,
      },
      undefined,
      {
        enabled:
          open &&
          !!selectedInstitutionId &&
          !!sourceEnrollmentResolved?.academic_year,
      },
    )

  const availableTargetGroups = useMemo(
    () =>
      targetGroups.filter(
        (g) => g.id !== sourceEnrollmentResolved?.group,
      ),
    [targetGroups, sourceEnrollmentResolved?.group],
  )

  const watchedTargetGroupId = useWatch({
    control: form.control,
    name: 'target_group_id',
  })

  const selectedTargetGroup = useMemo(
    () =>
      availableTargetGroups.find((g) => g.id === watchedTargetGroupId) ?? null,
    [availableTargetGroups, watchedTargetGroupId],
  )

  const transferMutation = useMutation({
    mutationFn: (values: FormValues) =>
      transferStudent(studentId, {
        target_group_id: values.target_group_id,
        transfer_date: values.transfer_date || null,
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      void queryClient.invalidateQueries({ queryKey: ['attendances'] })
      void queryClient.invalidateQueries({ queryKey: ['performance-summaries'] })
      void queryClient.invalidateQueries({ queryKey: ['school-records'] })
      void queryClient.invalidateQueries({
        queryKey: ['academic-indicators-reports'],
      })
      setResult(data)
      setConfirming(false)
      onSuccess?.()
    },
    onError: (e) => {
      setConfirming(false)
      if (isAxiosError(e)) {
        const data = e.response?.data as
          | { detail?: string; code?: StudentTransferErrorCode }
          | undefined
        if (data?.code) {
          setFormError(
            t(`studentTransfer.errors.${data.code}`, {
              defaultValue: data.detail ?? getErrorMessage(e),
            }),
          )
          return
        }
      }
      setFormError(getErrorMessage(e))
    },
  })

  function handleClose() {
    if (transferMutation.isPending) return
    onClose()
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    if (!confirming) {
      setConfirming(true)
      return
    }
    transferMutation.mutate(values)
  }

  const pending = transferMutation.isPending || form.formState.isSubmitting
  const displayName =
    studentName ?? sourceEnrollmentResolved?.student_name ?? studentId

  const noActiveEnrollment =
    !enrollmentsLoading &&
    !sourceEnrollment &&
    activeEnrollments.length === 0

  const needsEnrollmentPick =
    !sourceEnrollment && activeEnrollments.length > 1 && !pickedEnrollmentId

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center gap-2">
        <SwapHorizIcon fontSize="small" />
        {result
          ? t('studentTransfer.resultTitle')
          : t('studentTransfer.title')}
      </DialogTitle>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogContent className="flex flex-col gap-3">
          {!selectedInstitutionId ? (
            <Alert severity="info">{t('studentTransfer.selectInstitution')}</Alert>
          ) : null}

          {result ? (
            <TransferResultSummary result={result} />
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {t('studentTransfer.studentLabel', { name: displayName })}
              </Typography>

              {enrollmentsLoading ? (
                <Typography variant="body2">{t('common.loading')}</Typography>
              ) : null}

              {noActiveEnrollment ? (
                <Alert severity="warning">
                  {t('studentTransfer.noActiveEnrollment')}
                </Alert>
              ) : null}

              {sourceEnrollmentResolved ? (
                <Alert severity="info" icon={false}>
                  <Typography variant="subtitle2" className="font-medium">
                    {t('studentTransfer.sourceTitle')}
                  </Typography>
                  <Typography variant="body2">
                    {t('studentTransfer.sourceSummary', {
                      group: sourceEnrollmentResolved.group_name,
                      campus: sourceEnrollmentResolved.campus_name,
                      year: sourceEnrollmentResolved.academic_year_year,
                    })}
                  </Typography>
                </Alert>
              ) : needsEnrollmentPick ? (
                <FormControl fullWidth size="small">
                  <InputLabel>{t('studentTransfer.pickEnrollment')}</InputLabel>
                  <Select
                    label={t('studentTransfer.pickEnrollment')}
                    value={pickedEnrollmentId}
                    onChange={(e) => setPickedEnrollmentId(e.target.value)}
                  >
                    {enrollmentOptions.map((e) => (
                      <MenuItem key={e.id} value={e.id}>
                        {t('studentTransfer.enrollmentOption', {
                          group: e.group_name,
                          campus: e.campus_name,
                          year: e.academic_year_year,
                        })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}

              {sourceEnrollmentResolved && selectedInstitutionId ? (
                <>
                  <Typography variant="subtitle2" className="font-medium">
                    {t('studentTransfer.destinationTitle')}
                  </Typography>

                  <Controller
                    name="campus"
                    control={form.control}
                    render={({ field }) => (
                      <FormControl fullWidth size="small">
                        <InputLabel>{t('studentTransfer.campus')}</InputLabel>
                        <Select
                          label={t('studentTransfer.campus')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        >
                          <MenuItem value="">
                            {t('studentTransfer.anyCampus')}
                          </MenuItem>
                          {campuses.map((c: Campus) => (
                            <MenuItem key={c.id} value={c.id}>
                              {c.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="grade_level"
                    control={form.control}
                    render={({ field }) => (
                      <FormControl fullWidth size="small">
                        <InputLabel>{t('studentTransfer.gradeLevel')}</InputLabel>
                        <Select
                          label={t('studentTransfer.gradeLevel')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        >
                          <MenuItem value="">
                            {t('studentTransfer.anyGradeLevel')}
                          </MenuItem>
                          {gradeLevels.map((gl: GradeLevel) => (
                            <MenuItem key={gl.id} value={gl.id}>
                              {gl.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="target_group_id"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        options={availableTargetGroups}
                        loading={groupsLoading}
                        getOptionLabel={groupOptionLabel}
                        value={
                          availableTargetGroups.find(
                            (g) => g.id === field.value,
                          ) ?? null
                        }
                        onChange={(_, v) => field.onChange(v?.id ?? '')}
                        renderInput={(params: AutocompleteRenderInputParams) => (
                          <TextField
                            {...params}
                            label={t('studentTransfer.targetGroup')}
                            required
                            error={!!fieldState.error}
                            helperText={
                              fieldState.error?.message ??
                              (availableTargetGroups.length === 0 &&
                              !groupsLoading
                                ? t('studentTransfer.noTargetGroups')
                                : undefined)
                            }
                          />
                        )}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                      />
                    )}
                  />

                  <Controller
                    name="transfer_date"
                    control={form.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="date"
                        label={t('studentTransfer.transferDate')}
                        size="small"
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                        helperText={t('studentTransfer.transferDateHint')}
                      />
                    )}
                  />

                  <Alert severity="warning" icon={false}>
                    {t('studentTransfer.disclaimer')}
                  </Alert>

                  {confirming && selectedTargetGroup ? (
                    <Alert severity="warning">
                      {t('studentTransfer.confirmPrompt', {
                        student: displayName,
                        source: sourceEnrollmentResolved.group_name,
                        target: selectedTargetGroup.name,
                      })}
                    </Alert>
                  ) : null}
                </>
              ) : null}

              {formError ? (
                <Alert severity="error">{formError}</Alert>
              ) : null}
            </>
          )}
        </DialogContent>

        <DialogActions>
          {result ? (
            <Button onClick={handleClose}>{t('studentTransfer.close')}</Button>
          ) : (
            <>
              <Button onClick={handleClose} disabled={pending}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                color={confirming ? 'warning' : 'primary'}
                disabled={
                  pending ||
                  !selectedInstitutionId ||
                  !sourceEnrollmentResolved ||
                  noActiveEnrollment ||
                  needsEnrollmentPick
                }
              >
                {confirming
                  ? t('studentTransfer.confirmAction')
                  : t('studentTransfer.submit')}
              </Button>
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  )
}

function TransferResultSummary({
  result,
}: {
  result: StudentTransferResponse
}) {
  const { t } = useTranslation()

  const stats = [
    {
      label: t('studentTransfer.stats.grades'),
      value: `${result.grades_migrated} / ${result.grades_skipped}`,
    },
    {
      label: t('studentTransfer.stats.attendances'),
      value: `${result.attendances_migrated} / ${result.attendances_skipped}`,
    },
    {
      label: t('studentTransfer.stats.indicators'),
      value: `${result.academic_indicators_migrated} / ${result.academic_indicators_skipped}`,
    },
    {
      label: t('studentTransfer.stats.performance'),
      value: String(result.performance_pairs_synced),
    },
    {
      label: t('studentTransfer.stats.schoolRecord'),
      value: result.school_record_regenerated
        ? t('studentTransfer.stats.yes')
        : t('studentTransfer.stats.no'),
    },
    {
      label: t('studentTransfer.stats.indicatorReports'),
      value: String(result.academic_indicators_reports_regenerated),
    },
  ]

  return (
    <Box className="flex flex-col gap-3">
      <Alert severity="success">
        {t('studentTransfer.successSummary', {
          source: result.source_group_name,
          target: result.target_group_name,
        })}
      </Alert>

      <List dense disablePadding>
        {stats.map((s) => (
          <ListItem key={s.label} disableGutters>
            <ListItemText
              primary={s.label}
              secondary={s.value}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        ))}
      </List>

      {result.warnings.length > 0 ? (
        <Alert severity="warning">
          <Typography variant="subtitle2" className="font-medium mb-1">
            {t('studentTransfer.warningsTitle')}
          </Typography>
          <List dense disablePadding>
            {result.warnings.map((w) => (
              <ListItem key={w} disableGutters sx={{ py: 0 }}>
                <ListItemText primary={w} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItem>
            ))}
          </List>
        </Alert>
      ) : null}
    </Box>
  )
}
