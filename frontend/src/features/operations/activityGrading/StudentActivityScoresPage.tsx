import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
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
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import {
  createStudentActivityScore,
  deleteStudentActivityScore,
  fetchGradingActivitiesForScheme,
  patchStudentActivityScore,
  type GradingActivity,
  type GradingScheme,
  type StudentActivityScore,
} from '@/features/operations/gradingApi'
import {
  useAcademicPeriodsForYear,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import type { Student } from '@/types/schemas'

const dec = z
  .string()
  .min(1)
  .regex(/^-?\d{0,2}(\.\d{0,2})?$/, 'Formato inválido')

const formSchema = z.object({
  activity: z.string().uuid('Selecciona actividad'),
  student: z.string().uuid('Selecciona estudiante'),
  score: dec,
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

type ScoreRow = StudentActivityScore

export function StudentActivityScoresPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterSchemeId, setFilterSchemeId] = useState<string | null>(null)
  const [filterStudentDoc, setFilterStudentDoc] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScoreRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScoreRow | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dialogSchemeId, setDialogSchemeId] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )

  const schemeListParams = {
    search: appliedSearch.trim() || undefined,
  }
  const schemesQuery = useInfiniteList<GradingScheme>({
    queryKey: queryKeys.gradingSchemes(schemeListParams),
    url: '/api/grading-schemes/',
    params: schemeListParams,
  })
  const allSchemes = useMemo(
    () => flatInfinitePages(schemesQuery.data),
    [schemesQuery.data],
  )

  const schemesForFilter = useMemo(() => {
    if (!filterYearId) return allSchemes
    return allSchemes.filter((s) => {
      const period = periodsForFilter.find((p) => p.id === s.academic_period)
      return period?.academic_year === filterYearId
    })
  }, [allSchemes, filterYearId, periodsForFilter])

  const listParams = {
    activity__segment__grading_scheme: filterSchemeId ?? undefined,
    student__document_number: filterStudentDoc.trim() || undefined,
    search: appliedSearch.trim() || undefined,
  }

  const listQuery = useInfiniteList<ScoreRow>({
    queryKey: queryKeys.studentActivityScores(listParams),
    url: '/api/student-activity-scores/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const dataGridLocaleText = useMuiDataGridLocaleText()

  const { data: dialogActivities = [] } = useQuery({
    queryKey: [
      ...queryKeys.gradingSchemeStructure(dialogSchemeId ?? ''),
      'activities',
    ],
    queryFn: () => fetchGradingActivitiesForScheme(dialogSchemeId!),
    enabled: dialogOpen && !!dialogSchemeId,
  })

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      activity: '',
      student: '',
      score: '',
      notes: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: createStudentActivityScore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-activity-scores'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormValues }) =>
      patchStudentActivityScore(id, {
        activity: body.activity,
        student: body.student,
        score: body.score,
        notes: body.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-activity-scores'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStudentActivityScore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-activity-scores'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setDialogSchemeId(filterSchemeId)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    form.reset({ activity: '', student: '', score: '', notes: '' })
    setDialogOpen(true)
  }

  const openEdit = useCallback(
    (row: ScoreRow) => {
      setEditing(row)
      setFormError(null)
      setDialogSchemeId(filterSchemeId)
      form.reset({
        activity: row.activity,
        student: row.student,
        score: String(row.score),
        notes: row.notes ?? '',
      })
      setDialogOpen(true)
    },
    [filterSchemeId, form],
  )

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setDialogSchemeId(null)
    setFormError(null)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const body = {
      ...values,
      notes: values.notes?.trim() || undefined,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: values })
    } else {
      createMutation.mutate(body)
    }
  }

  const columns = useMemo<GridColDef<ScoreRow>[]>(
    () => [
      {
        field: 'student_name',
        headerName: t('gradingSchemes.student'),
        flex: 1,
        minWidth: 140,
      },
      {
        field: 'student_document_number',
        headerName: t('gradingSchemes.document'),
        width: 120,
      },
      {
        field: 'activity_name',
        headerName: t('activityGrading.activity'),
        flex: 1,
        minWidth: 160,
      },
      {
        field: 'activity_date',
        headerName: t('gradingSchemes.activityDate'),
        width: 110,
      },
      {
        field: 'score',
        headerName: t('gradingSchemes.score'),
        width: 80,
      },
      {
        field: 'max_score',
        headerName: t('gradingSchemes.maxScore'),
        width: 90,
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 96,
        getActions: (params: GridRenderCellParams<ScoreRow>) => [
          <IconButton
            key="edit"
            aria-label={t('common.edit')}
            size="small"
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            aria-label={t('common.delete')}
            size="small"
            onClick={() => setDeleteTarget(params.row)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>,
        ],
      },
    ],
    [openEdit, t],
  )

  function activityLabel(a: GradingActivity): string {
    return `${a.component_name} › ${a.segment_name} › ${a.name}`
  }

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <Typography variant="h6">{t('activityGrading.activityScoresTitle')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId}
        >
          {t('activityGrading.newScore')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">{t('gradingSchemes.selectInstitution')}</Alert>
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
          sx={{ minWidth: 160, flex: '1 1 160px', maxWidth: 280 }}
        />
        <Button
          variant="outlined"
          startIcon={<SearchIcon />}
          onClick={() => setAppliedSearch(searchInput)}
        >
          {t('common.search')}
        </Button>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t('gradingSchemes.yearFilter')}</InputLabel>
          <Select
            label={t('gradingSchemes.yearFilter')}
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterSchemeId(null)
            }}
          >
            <MenuItem value="">{t('gradingSchemes.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>{t('activityGrading.schemeFilter')}</InputLabel>
          <Select
            label={t('activityGrading.schemeFilter')}
            value={filterSchemeId ?? ''}
            onChange={(e) =>
              setFilterSchemeId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('gradingSchemes.all')}</MenuItem>
            {schemesForFilter.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.course_assignment_subject_name} — {s.course_assignment_group_name}{' '}
                · {s.academic_period_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label={t('gradingSchemes.studentDocExact')}
          value={filterStudentDoc}
          onChange={(e) => setFilterStudentDoc(e.target.value)}
        />
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setFilterYearId(null)
            setFilterSchemeId(null)
            setFilterStudentDoc('')
          }}
        >
          {t('common.clear')}
        </Button>
      </Paper>

      {listQuery.error ? (
        <Alert severity="error">{getErrorMessage(listQuery.error)}</Alert>
      ) : null}

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={listQuery.isLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !listQuery.isLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('activityGrading.editScore') : t('activityGrading.newScore')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <FormControl fullWidth required={!editing}>
              <InputLabel>{t('activityGrading.schemeFilter')}</InputLabel>
              <Select
                label={t('activityGrading.schemeFilter')}
                value={dialogSchemeId ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : e.target.value
                  setDialogSchemeId(v)
                  if (!editing) form.setValue('activity', '')
                }}
                disabled={!!editing}
              >
                {allSchemes.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.course_assignment_subject_name} — {s.course_assignment_group_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Controller
              name="activity"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={dialogActivities}
                  getOptionKey={(a: GradingActivity) => a.id}
                  getOptionLabel={activityLabel}
                  value={
                    dialogActivities.find((a) => a.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!dialogSchemeId || !!editing}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('activityGrading.activity')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            {!editing ? (
              <>
                <Box className="flex gap-2 items-end">
                  <TextField
                    size="small"
                    label={t('gradingSchemes.searchStudent')}
                    fullWidth
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
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
                      getOptionKey={(o: Student) => o.id}
                      getOptionLabel={(o: Student) => o.full_name}
                      value={
                        studentOptions.find((s) => s.id === field.value) ?? null
                      }
                      onChange={(_, v) => field.onChange(v?.id ?? '')}
                      renderInput={(params: AutocompleteRenderInputParams) => (
                        <TextField
                          {...params}
                          label={t('gradingSchemes.student')}
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                  )}
                />
              </>
            ) : (
              <TextField
                label={t('gradingSchemes.student')}
                value={editing.student_name}
                disabled
                fullWidth
              />
            )}
            <TextField
              label={t('gradingSchemes.score')}
              fullWidth
              required
              {...form.register('score')}
              error={!!form.formState.errors.score}
              helperText={form.formState.errors.score?.message}
            />
            <TextField
              label={t('gradingSchemes.notes')}
              fullWidth
              multiline
              minRows={2}
              {...form.register('notes')}
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('activityGrading.deleteScore')}</DialogTitle>
        <DialogContent>
          {t('activityGrading.deleteScorePrompt', {
            student: deleteTarget?.student_name ?? '',
            activity: deleteTarget?.activity_name ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
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
