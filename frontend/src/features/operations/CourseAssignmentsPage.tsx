import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
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
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { PageHeader } from '@/components/PageHeader'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import {
  useGroupsForFilters,
  useSubjectsForInstitution,
  useTeachersSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicYear,
  CourseAssignment,
  Group,
  Subject,
  Teacher,
} from '@/types/schemas'

const schema = z.object({
  subject: z.string().uuid('Selecciona materia'),
  teacher: z.string().uuid('Selecciona docente'),
  group: z.string().uuid('Selecciona grupo'),
  academic_year: z.string().uuid('Selecciona año lectivo'),
})

type FormValues = z.infer<typeof schema>

export function CourseAssignmentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [teacherSearchInput, setTeacherSearchInput] = useState('')
  const [appliedTeacherSearch, setAppliedTeacherSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CourseAssignment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourseAssignment | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formTeacherSearch, setFormTeacherSearch] = useState('')
  const [appliedFormTeacherSearch, setAppliedFormTeacherSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: subjects = [] } = useSubjectsForInstitution(
    selectedInstitutionId,
  )
  const teachersForFilterQuery = useTeachersSearch(appliedTeacherSearch)
  const teachersForFilter = teachersForFilterQuery.data ?? []
  const { data: teachersForForm = [] } = useTeachersSearch(
    appliedFormTeacherSearch,
  )

  const teacherSearchApplied = appliedTeacherSearch.trim() !== ''
  const teacherIdsCsv = useMemo(
    () =>
      teacherSearchApplied
        ? teachersForFilter.map((x) => x.id).join(',')
        : '',
    [teacherSearchApplied, teachersForFilter],
  )
  const teacherFilterReady =
    !teacherSearchApplied ||
    (teachersForFilterQuery.status === 'success' && teacherIdsCsv.length > 0)
  const teacherFilterEmpty =
    teacherSearchApplied &&
    teachersForFilterQuery.status === 'success' &&
    teacherIdsCsv.length === 0

  const listParams = useMemo(
    () => ({
      academic_year: filterYearId ?? undefined,
      search: appliedSearch || undefined,
      ...(teacherIdsCsv ? { teacher__in: teacherIdsCsv } : {}),
    }),
    [filterYearId, appliedSearch, teacherIdsCsv],
  )

  const listQuery = useInfiniteList<CourseAssignment>({
    queryKey: queryKeys.courseAssignments(listParams),
    url: '/api/course-assignments/',
    params: listParams,
    enabled: teacherFilterReady,
  })
  const rows = useMemo(() => {
    if (teacherFilterEmpty) return []
    return flatInfinitePages(listQuery.data)
  }, [listQuery.data, teacherFilterEmpty])
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      subject: '',
      teacher: '',
      group: '',
      academic_year: '',
    },
  })

  const watchedFormYear = useWatch({
    control: form.control,
    name: 'academic_year',
  })
  const { data: groupsForFormYear = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: watchedFormYear || null },
    undefined,
    { enabled: !!watchedFormYear },
  )

  const createMutation = useMutation({
    mutationFn: (body: FormValues) =>
      apiClient.post<CourseAssignment>('/api/course-assignments/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['course-assignments'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: FormValues
    }) =>
      apiClient.patch<CourseAssignment>(`/api/course-assignments/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['course-assignments'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/course-assignments/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['course-assignments'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setFormTeacherSearch('')
    setAppliedFormTeacherSearch('')
    form.reset({
      subject: subjects[0]?.id ?? '',
      teacher: '',
      group: '',
      academic_year: academicYears[0]?.id ?? '',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: CourseAssignment) => {
      setEditing(row)
      setFormError(null)
      setAppliedFormTeacherSearch('')
      setFormTeacherSearch('')
      form.reset({
        subject: row.subject,
        teacher: row.teacher,
        group: row.group,
        academic_year: row.academic_year,
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<CourseAssignment>[]>(
    () => [
      {
        field: 'subject_name',
        headerName: t('courseAssignments.subject'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'teacher_name',
        headerName: t('courseAssignments.teacher'),
        flex: 1,
        minWidth: 140,
        sortable: false,
      },
      {
        field: 'group_name',
        headerName: t('courseAssignments.group'),
        flex: 0.8,
        minWidth: 120,
        sortable: false,
      },
      {
        field: 'academic_year_year',
        headerName: t('courseAssignments.year'),
        width: 100,
        sortable: false,
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<CourseAssignment>) => [
          <IconButton
            key="edit"
            aria-label={t('courseAssignments.edit')}
            size="small"
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            aria-label={t('courseAssignments.delete')}
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

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
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

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  const yearLabel = (y: AcademicYear) => String(y.year)

  const listLoading =
    listQuery.isLoading ||
    (teacherSearchApplied &&
      teachersForFilterQuery.isFetching &&
      !teacherFilterReady)

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('courseAssignments.title')}
          subtitle={t('courseAssignments.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={
            !selectedInstitutionId ||
            academicYears.length === 0 ||
            subjects.length === 0
          }
        >
          {t('courseAssignments.new')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('courseAssignments.selectInstitution')}
        </Alert>
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
          <InputLabel>{t('courseAssignments.academicYear')}</InputLabel>
          <Select
            label={t('courseAssignments.academicYear')}
            value={filterYearId ?? ''}
            onChange={(e) =>
              setFilterYearId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('courseAssignments.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label={t('courseAssignments.filterTeacher')}
          value={teacherSearchInput}
          onChange={(e) => setTeacherSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              setAppliedTeacherSearch(teacherSearchInput)
          }}
        />
        <Button
          variant="outlined"
          onClick={() => setAppliedTeacherSearch(teacherSearchInput)}
        >
          {t('courseAssignments.applyTeacher')}
        </Button>
      </Paper>

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

      <Paper sx={{ width: '100%', p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={listLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !listLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('courseAssignments.editDialog') : t('courseAssignments.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error} required>
                  <InputLabel>{t('courseAssignments.academicYear')}</InputLabel>
                  <Select
                    label={t('courseAssignments.academicYear')}
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
                  options={groupsForFormYear}
                  getOptionKey={(g: Group) => g.id}
                  getOptionLabel={(g: Group) =>
                    g.campus_name
                      ? `${g.name} (${g.campus_name})`
                      : g.name
                  }
                  value={
                    groupsForFormYear.find((g) => g.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!watchedFormYear}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('courseAssignments.groupWithCampus')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <Controller
              name="subject"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={subjects}
                  getOptionLabel={(s: Subject) => s.name}
                  value={subjects.find((s) => s.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('courseAssignments.subject')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <Box className="flex gap-2 items-end">
              <TextField
                size="small"
                label={t('courseAssignments.searchTeacher')}
                fullWidth
                value={formTeacherSearch}
                onChange={(e) => setFormTeacherSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setAppliedFormTeacherSearch(formTeacherSearch)
                  }
                }}
              />
              <Button
                variant="outlined"
                onClick={() =>
                  setAppliedFormTeacherSearch(formTeacherSearch)
                }
              >
                {t('common.search')}
              </Button>
            </Box>
            <Controller
              name="teacher"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={teachersForForm}
                  getOptionLabel={(t: Teacher) => t.full_name}
                  value={
                    teachersForForm.find((t) => t.id === field.value) ??
                    null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('courseAssignments.teacher')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
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
        <DialogTitle>{t('courseAssignments.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('courseAssignments.deletePrompt', {
            subject: deleteTarget?.subject_name ?? '',
            teacher: deleteTarget?.teacher_name ?? '',
            group: deleteTarget?.group_name ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
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
