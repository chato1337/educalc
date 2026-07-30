import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { useCourseAssignmentsList } from '@/features/operations/operationsQueries'
import {
  fetchRollCallRoster,
  saveRollCall,
  type RollCallSaveResponse,
  type RollCallStatus,
} from '@/features/operations/rollCall/rollCallApi'
import type { Group } from '@/types/schemas'

const GENERAL_SOURCE = 'general'

type Mark = { status: RollCallStatus; notes: string }

type Props = {
  /** Mount only while a group is selected; remounting resets the marks. */
  group: Group
  date: string
  onClose: () => void
  onSaved: (result: RollCallSaveResponse) => void
}

export function RollCallDialog({ group, date, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [source, setSource] = useState<string>(GENERAL_SOURCE)
  const [overrides, setOverrides] = useState<Record<string, Mark>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const courseAssignmentId = source === GENERAL_SOURCE ? undefined : source

  const { data: assignments = [] } = useCourseAssignmentsList({
    group: group.id,
    academic_year: group.academic_year,
  })

  const rosterQuery = useQuery({
    queryKey: queryKeys.rollCallRoster(group.id, date, courseAssignmentId),
    queryFn: () =>
      fetchRollCallRoster({
        group: group.id,
        date,
        ...(courseAssignmentId ? { course_assignment: courseAssignmentId } : {}),
      }),
    enabled: Boolean(date),
  })

  const roster = rosterQuery.data
  const students = useMemo(() => roster?.students ?? [], [roster])

  /** What the roll call already has for this source, overlaid with the current edits. */
  const marks = useMemo(() => {
    const merged: Record<string, Mark> = {}
    for (const student of students) {
      merged[student.student] = overrides[student.student] ?? {
        status: student.status ?? 'PRESENT',
        notes: student.notes ?? '',
      }
    }
    return merged
  }, [students, overrides])

  const saveMutation = useMutation({
    mutationFn: () =>
      saveRollCall({
        group: group.id,
        date,
        ...(courseAssignmentId ? { course_assignment: courseAssignmentId } : {}),
        ...(roster?.academic_period
          ? { academic_period: roster.academic_period }
          : {}),
        entries: students.map((student) => ({
          student: student.student,
          status: marks[student.student]?.status ?? 'PRESENT',
          notes: marks[student.student]?.notes ?? '',
        })),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['daily-attendances'] })
      void queryClient.invalidateQueries({ queryKey: ['attendances'] })
      onSaved(result)
      onClose()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const counters = useMemo(() => {
    const values = Object.values(marks)
    return {
      present: values.filter((m) => m.status === 'PRESENT').length,
      excused: values.filter((m) => m.status === 'EXCUSED').length,
      unexcused: values.filter((m) => m.status === 'UNEXCUSED').length,
    }
  }, [marks])

  const allPresent =
    students.length > 0 &&
    students.every((s) => marks[s.student]?.status === 'PRESENT')

  function setStatus(studentId: string, status: RollCallStatus) {
    setOverrides((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: status === 'PRESENT' ? '' : (marks[studentId]?.notes ?? ''),
      },
    }))
  }

  function setNotes(studentId: string, notes: string) {
    setOverrides((prev) => ({
      ...prev,
      [studentId]: { status: marks[studentId]?.status ?? 'PRESENT', notes },
    }))
  }

  function toggleAll(present: boolean) {
    const next: Record<string, Mark> = {}
    for (const student of students) {
      next[student.student] = {
        status: present ? 'PRESENT' : 'UNEXCUSED',
        notes: present ? '' : (marks[student.student]?.notes ?? ''),
      }
    }
    setOverrides(next)
  }

  const missingPeriod = Boolean(roster) && !roster?.academic_period

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t('rollCall.dialogTitle', { group: group.name, date })}
      </DialogTitle>
      <DialogContent className="flex flex-col gap-3 pt-1">
        {formError ? <Alert severity="error">{formError}</Alert> : null}
        {rosterQuery.error ? (
          <Alert severity="error">{getErrorMessage(rosterQuery.error)}</Alert>
        ) : null}
        {missingPeriod ? (
          <Alert severity="warning">{t('rollCall.missingPeriod')}</Alert>
        ) : null}

        <Box className="flex flex-wrap gap-3 items-center">
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>{t('rollCall.source')}</InputLabel>
            <Select
              label={t('rollCall.source')}
              value={source}
              onChange={(e) => {
                setSource(e.target.value)
                setOverrides({})
                setFormError(null)
              }}
            >
              <MenuItem value={GENERAL_SOURCE}>
                {t('rollCall.sourceGeneral')}
              </MenuItem>
              {assignments.map((assignment) => (
                <MenuItem key={assignment.id} value={assignment.id}>
                  {assignment.subject_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {roster?.academic_period_name ? (
            <Chip
              size="small"
              variant="outlined"
              label={t('rollCall.periodChip', {
                period: roster.academic_period_name,
              })}
            />
          ) : null}
        </Box>

        <Typography variant="body2" color="text.secondary">
          {t('rollCall.consolidationHelp')}
        </Typography>

        <Box className="flex flex-wrap gap-2 items-center justify-between">
          <FormControlLabel
            control={
              <Checkbox
                checked={allPresent}
                indeterminate={!allPresent && counters.present > 0}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={students.length === 0}
              />
            }
            label={t('rollCall.markAllPresent')}
          />
          <Box className="flex gap-1">
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t('rollCall.presentCount', { count: counters.present })}
            />
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('rollCall.excusedCount', { count: counters.excused })}
            />
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label={t('rollCall.unexcusedCount', { count: counters.unexcused })}
            />
          </Box>
        </Box>

        {rosterQuery.isLoading ? (
          <Box className="flex justify-center p-6">
            <CircularProgress size={28} />
          </Box>
        ) : students.length === 0 ? (
          <Alert severity="info">{t('rollCall.emptyRoster')}</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{t('rollCall.student')}</TableCell>
                  <TableCell align="center" width={90}>
                    {t('rollCall.attends')}
                  </TableCell>
                  <TableCell align="center" width={190}>
                    {t('rollCall.absenceType')}
                  </TableCell>
                  <TableCell width={220}>{t('rollCall.notes')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => {
                  const mark = marks[student.student]
                  const isPresent = mark?.status === 'PRESENT'
                  return (
                    <TableRow key={student.student} hover>
                      <TableCell>
                        <Box className="flex flex-col">
                          <span>{student.full_name}</span>
                          <Box className="flex gap-1 items-center">
                            <Typography variant="caption" color="text.secondary">
                              {student.document_number}
                            </Typography>
                            {student.other_sources > 0 ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t('rollCall.otherSources', {
                                  count: student.other_sources,
                                  status: t(
                                    `rollCall.status.${student.consolidated_status ?? 'PRESENT'}`,
                                  ),
                                })}
                              />
                            ) : null}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox
                          checked={isPresent}
                          onChange={(e) =>
                            setStatus(
                              student.student,
                              e.target.checked ? 'PRESENT' : 'UNEXCUSED',
                            )
                          }
                          inputProps={{
                            'aria-label': t('rollCall.attendsFor', {
                              student: student.full_name,
                            }),
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          disabled={isPresent}
                          value={isPresent ? null : (mark?.status ?? null)}
                          onChange={(_, value) => {
                            if (value) setStatus(student.student, value)
                          }}
                        >
                          <ToggleButton value="EXCUSED" color="warning">
                            {t('rollCall.excusedShort')}
                          </ToggleButton>
                          <ToggleButton value="UNEXCUSED" color="error">
                            {t('rollCall.unexcusedShort')}
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          disabled={isPresent}
                          value={mark?.notes ?? ''}
                          onChange={(e) =>
                            setNotes(student.student, e.target.value)
                          }
                          placeholder={t('rollCall.notesPlaceholder')}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => {
            setFormError(null)
            saveMutation.mutate()
          }}
          disabled={
            saveMutation.isPending || students.length === 0 || missingPeriod
          }
        >
          {t('rollCall.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
