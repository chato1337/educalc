import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SearchIcon from '@mui/icons-material/Search'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
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
import { Link as RouterLink } from 'react-router-dom'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { resolvedAppRole } from '@/app/roleMatrix'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import { fetchMe } from '@/features/auth/meApi'
import {
  createGradingScheme,
  deleteGradingScheme,
  patchGradingScheme,
  type GradingScheme,
} from '@/features/operations/gradingApi'
import {
  useAcademicPeriodsForYear,
  useCourseAssignmentsList,
  useGroupsForFilters,
  useTeacherCourseAssignments,
} from '@/features/operations/operationsQueries'
import { useTeacherScopeListDefaults } from '@/features/operations/useTeacherScopeListDefaults'
import { useUiStore } from '@/stores/uiStore'
import type { CourseAssignment } from '@/types/schemas'

const schemeFormSchema = z.object({
  course_assignment: z.string().uuid('Selecciona asignación'),
  academic_period: z.string().uuid('Selecciona período'),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schemeFormSchema>

export function GradingSchemesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null)
  const [filterAssignmentId, setFilterAssignmentId] = useState<string | null>(
    null,
  )
  const [filterActive, setFilterActive] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogYearId, setDialogYearId] = useState<string | null>(null)
  const [editing, setEditing] = useState<GradingScheme | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GradingScheme | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  })
  const effectiveRole = useMemo(
    () => resolvedAppRole(me?.role ?? null),
    [me?.role],
  )
  const { data: teacherAssignments } = useTeacherCourseAssignments(
    me?.teacher_id,
    {
      enabled:
        effectiveRole === 'TEACHER' &&
        Boolean(me?.teacher_id) &&
        Boolean(selectedInstitutionId),
    },
  )

  useTeacherScopeListDefaults(
    effectiveRole,
    me?.teacher_id,
    selectedInstitutionId,
    academicYears,
    teacherAssignments,
    setFilterYearId,
    () => {},
    () => {},
    setFilterGroupId,
  )

  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )
  const { data: assignmentsForFilter = [] } = useCourseAssignmentsList(
    { academic_year: filterYearId ?? undefined },
    { enabled: !!filterYearId },
  )
  const { data: groupsForFilter = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: filterYearId ?? undefined },
    undefined,
    { enabled: !!selectedInstitutionId },
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    course_assignment: filterAssignmentId ?? undefined,
    course_assignment__group: filterGroupId ?? undefined,
    is_active: filterActive || undefined,
    search: appliedSearch.trim() || undefined,
  }

  const listQuery = useInfiniteList<GradingScheme>({
    queryKey: queryKeys.gradingSchemes(listParams),
    url: '/api/grading-schemes/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const dataGridLocaleText = useMuiDataGridLocaleText()

  const { data: periodsForDialog = [] } = useAcademicPeriodsForYear(
    dialogOpen ? dialogYearId : null,
  )
  const { data: assignmentsForDialog = [] } = useCourseAssignmentsList(
    { academic_year: dialogYearId ?? undefined },
    { enabled: dialogOpen && !!dialogYearId },
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schemeFormSchema) as Resolver<FormValues>,
    defaultValues: {
      course_assignment: '',
      academic_period: '',
      is_active: true,
    },
  })

  const createMutation = useMutation({
    mutationFn: createGradingScheme,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grading-schemes'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormValues }) =>
      patchGradingScheme(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grading-schemes'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGradingScheme,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grading-schemes'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setDialogYearId(filterYearId ?? academicYears[0]?.id ?? null)
    form.reset({
      course_assignment: filterAssignmentId ?? '',
      academic_period: filterPeriodId ?? '',
      is_active: true,
    })
    setDialogOpen(true)
  }

  const openEdit = useCallback(
    (row: GradingScheme) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        course_assignment: row.course_assignment,
        academic_period: row.academic_period,
        is_active: row.is_active ?? true,
      })
      setDialogOpen(true)
    },
    [form],
  )

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setDialogYearId(null)
    setFormError(null)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = useMemo<GridColDef<GradingScheme>[]>(
    () => [
      {
        field: 'course_assignment_subject_name',
        headerName: t('gradingSchemes.subject'),
        flex: 1,
        minWidth: 140,
      },
      {
        field: 'course_assignment_group_name',
        headerName: t('gradingSchemes.group'),
        flex: 0.7,
        minWidth: 100,
      },
      {
        field: 'course_assignment_teacher_name',
        headerName: t('gradingSchemes.teacher'),
        flex: 0.8,
        minWidth: 120,
      },
      {
        field: 'academic_period_name',
        headerName: t('gradingSchemes.period'),
        flex: 0.8,
        minWidth: 120,
        valueGetter: (_v, row) =>
          `${row.academic_period_name} (${row.academic_period_number})`,
      },
      {
        field: 'weights_valid',
        headerName: t('gradingSchemes.weightsValid'),
        width: 120,
        valueGetter: (_v, row) =>
          row.subject_component_weights_valid && row.segment_weights_valid,
        renderCell: (params) => (
          <Chip
            size="small"
            label={
              params.value
                ? t('gradingSchemes.weightsOk')
                : t('gradingSchemes.weightsInvalid')
            }
            color={params.value ? 'success' : 'warning'}
            variant="outlined"
          />
        ),
      },
      {
        field: 'is_active',
        headerName: t('gradingSchemes.active'),
        width: 90,
        valueFormatter: (value: boolean | undefined) =>
          value ? t('common.yes') : t('common.no'),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 140,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<GradingScheme>) => [
          <IconButton
            key="open"
            aria-label={t('gradingSchemes.manage')}
            size="small"
            component={RouterLink}
            to={`/activity-grading/schemes/${params.row.id}`}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>,
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

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <Typography variant="h6">{t('activityGrading.schemesTitle')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId || academicYears.length === 0}
        >
          {t('gradingSchemes.new')}
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
              setFilterPeriodId(null)
              setFilterAssignmentId(null)
              setFilterGroupId(null)
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
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>{t('gradingSchemes.period')}</InputLabel>
          <Select
            label={t('gradingSchemes.period')}
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('gradingSchemes.all')}</MenuItem>
            {periodsForFilter.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>{t('gradingSchemes.group')}</InputLabel>
          <Select
            label={t('gradingSchemes.group')}
            value={filterGroupId ?? ''}
            onChange={(e) =>
              setFilterGroupId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('gradingSchemes.all')}</MenuItem>
            {groupsForFilter.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.grade_level_name} — {g.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }} disabled={!filterYearId}>
          <InputLabel>{t('gradingSchemes.assignment')}</InputLabel>
          <Select
            label={t('gradingSchemes.assignment')}
            value={filterAssignmentId ?? ''}
            onChange={(e) =>
              setFilterAssignmentId(
                e.target.value === '' ? null : e.target.value,
              )
            }
          >
            <MenuItem value="">{t('gradingSchemes.allFem')}</MenuItem>
            {assignmentsForFilter.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.subject_name} — {a.group_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>{t('gradingSchemes.active')}</InputLabel>
          <Select
            label={t('gradingSchemes.active')}
            value={filterActive}
            onChange={(e) => setFilterActive(String(e.target.value))}
          >
            <MenuItem value="">{t('gradingSchemes.all')}</MenuItem>
            <MenuItem value="true">{t('common.yes')}</MenuItem>
            <MenuItem value="false">{t('common.no')}</MenuItem>
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
            setFilterGroupId(null)
            setFilterAssignmentId(null)
            setFilterActive('')
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
          {editing
            ? t('gradingSchemes.editScheme')
            : t('gradingSchemes.newScheme')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {!editing ? (
              <FormControl fullWidth required>
                <InputLabel>{t('gradingSchemes.yearForm')}</InputLabel>
                <Select
                  label={t('gradingSchemes.yearForm')}
                  value={dialogYearId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : e.target.value
                    setDialogYearId(v)
                    form.setValue('course_assignment', '')
                    form.setValue('academic_period', '')
                  }}
                >
                  {academicYears.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {y.year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <Controller
              name="course_assignment"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={assignmentsForDialog}
                  getOptionKey={(a: CourseAssignment) => a.id}
                  getOptionLabel={(a: CourseAssignment) =>
                    `${a.subject_name} — ${a.group_name}`
                  }
                  value={
                    assignmentsForDialog.find((a) => a.id === field.value) ??
                    null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing || !dialogYearId}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('gradingSchemes.assignment')}
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
              render={({ field, fieldState }) => (
                <FormControl
                  fullWidth
                  error={!!fieldState.error}
                  required
                  disabled={!dialogYearId && !editing}
                >
                  <InputLabel>{t('gradingSchemes.period')}</InputLabel>
                  <Select
                    label={t('gradingSchemes.period')}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {periodsForDialog.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="is_active"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                    />
                  }
                  label={t('gradingSchemes.activeScheme')}
                />
              )}
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

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>{t('gradingSchemes.deleteScheme')}</DialogTitle>
        <DialogContent>
          {t('gradingSchemes.deletePrompt', {
            subject: deleteTarget?.course_assignment_subject_name ?? '',
            group: deleteTarget?.course_assignment_group_name ?? '',
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
