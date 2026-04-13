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
  type GridSortModel,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Controller,
  useForm,
  useWatch,
  type Resolver,
} from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import { getErrorMessage } from '@/api/errors'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import {
  useAcademicYearsQuery,
} from '@/features/academic-structure/academicQueries'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { createServerSortHandlers } from '@/lib/dataGridServerSort'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicYear,
  GradeDirector,
  Group,
  Teacher,
} from '@/types/schemas'

const schema = z.object({
  teacher: z.string().uuid('Selecciona docente'),
  group: z.string().uuid('Selecciona grupo'),
  academic_year: z.string().uuid('Selecciona año lectivo'),
})

type FormValues = z.infer<typeof schema>

const gradeDirectorSortHandlers = createServerSortHandlers({
  teacher_name: 'teacher__full_name',
  group_name: 'group__name',
  academic_year_year: 'academic_year__year',
})

export function GradeDirectorsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null)
  const [filterTeacherId, setFilterTeacherId] = useState<string | null>(null)
  const [filterYearNumber, setFilterYearNumber] = useState('')
  const [filterGroupName, setFilterGroupName] = useState('')
  const [filterTeacherDocument, setFilterTeacherDocument] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GradeDirector | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GradeDirector | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', 'for-grade-directors'],
    queryFn: async () => fetchReferenceListResults<Teacher>('/api/teachers/'),
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', 'for-gd', filterYearId],
    queryFn: async () =>
      fetchReferenceListResults<Group>('/api/groups/', {
        params: filterYearId ? { academic_year: filterYearId } : undefined,
      }),
    enabled: !!filterYearId,
  })

  const { data: groupsForForm = [] } = useQuery({
    queryKey: ['groups', 'form-gd', dialogOpen],
    queryFn: async () => fetchReferenceListResults<Group>('/api/groups/'),
    enabled: dialogOpen,
  })

  const listParams = {
    academic_year: filterYearId ?? undefined,
    group: filterGroupId ?? undefined,
    teacher: filterTeacherId ?? undefined,
    search: appliedSearch || undefined,
    academic_year__year: filterYearNumber.trim() || undefined,
    group__name: filterGroupName.trim() || undefined,
    teacher__document_number: filterTeacherDocument.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<GradeDirector>({
    queryKey: ['grade-directors', 'list', listParams],
    url: '/api/grade-directors/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const sortModel = useMemo(
    () => gradeDirectorSortHandlers.orderingToSortModel(ordering),
    [ordering],
  )
  const dataGridLocaleText = useMuiDataGridLocaleText()
  const handleSortModelChange = useCallback((model: GridSortModel) => {
    setOrdering(gradeDirectorSortHandlers.sortModelToOrdering(model))
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      teacher: '',
      group: '',
      academic_year: '',
    },
  })

  const watchedYear = useWatch({
    control: form.control,
    name: 'academic_year',
  })

  const createMutation = useMutation({
    mutationFn: (body: FormValues) =>
      apiClient.post<GradeDirector>('/api/grade-directors/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-directors'] })
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
      apiClient.patch<GradeDirector>(`/api/grade-directors/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-directors'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/grade-directors/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-directors'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      teacher: '',
      group: '',
      academic_year: academicYears[0]?.id ?? '',
    })
    setDialogOpen(true)
  }

  const openEdit = useCallback(
    (row: GradeDirector) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        teacher: row.teacher,
        group: row.group,
        academic_year: row.academic_year,
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<GradeDirector>[]>(
    () => [
      {
        field: 'teacher_name',
        headerName: t('gradeDirectors.teacher'),
        flex: 1,
        minWidth: 180,
        sortable: true,
      },
      {
        field: 'group_name',
        headerName: t('gradeDirectors.group'),
        flex: 1,
        minWidth: 140,
        sortable: true,
      },
      {
        field: 'academic_year_year',
        headerName: t('gradeDirectors.year'),
        width: 120,
        sortable: true,
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<GradeDirector>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('gradeDirectors.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('gradeDirectors.delete')}
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
    form.reset({ teacher: '', group: '', academic_year: '' })
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

  const filterYear =
    academicYears.find((y) => y.id === filterYearId) ?? null
  const filterGroup = groups.find((g) => g.id === filterGroupId) ?? null
  const filterTeacher =
    teachers.find((t) => t.id === filterTeacherId) ?? null

  const groupsFiltered = groupsForForm.filter(
    (g) => !watchedYear || g.academic_year === watchedYear,
  )

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('gradeDirectors.title')}
          subtitle={t('gradeDirectors.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={academicYears.length === 0}
        >
          {t('gradeDirectors.new')}
        </Button>
      </Box>

      <Paper className="p-3 flex flex-col gap-3">
        <Box className="flex flex-wrap gap-2 items-end">
          <Autocomplete
            className="min-w-[200px] flex-1"
            size="small"
            options={academicYears}
            getOptionLabel={(y: AcademicYear) =>
              `${y.year} (${y.institution_name})`
            }
            value={filterYear}
            onChange={(_, v) => {
              setFilterYearId(v?.id ?? null)
              setFilterGroupId(null)
            }}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('gradeDirectors.academicYear')} />
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
          <Autocomplete
            className="min-w-[200px] flex-1"
            size="small"
            options={groups}
            getOptionKey={(g: Group) => g.id}
            getOptionLabel={(g: Group) => g.name}
            value={filterGroup}
            onChange={(_, v) => setFilterGroupId(v?.id ?? null)}
            disabled={!filterYearId}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('gradeDirectors.group')} />
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
          <Autocomplete
            className="min-w-[200px] flex-1"
            size="small"
            options={teachers}
            getOptionLabel={(t: Teacher) => t.full_name}
            value={filterTeacher}
            onChange={(_, v) => setFilterTeacherId(v?.id ?? null)}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label={t('gradeDirectors.teacherFilter')} />
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
        </Box>
        <Box className="flex flex-wrap gap-2 items-center">
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
            {t('common.apply')}
          </Button>
          <TextField
            size="small"
            label={t('gradeDirectors.yearExact')}
            value={filterYearNumber}
            onChange={(e) => setFilterYearNumber(e.target.value)}
            sx={{ maxWidth: 140 }}
          />
          <TextField
            size="small"
            label={t('gradeDirectors.groupExact')}
            value={filterGroupName}
            onChange={(e) => setFilterGroupName(e.target.value)}
          />
          <TextField
            size="small"
            label={t('gradeDirectors.teacherDocExact')}
            value={filterTeacherDocument}
            onChange={(e) => setFilterTeacherDocument(e.target.value)}
          />
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>{t('gradeDirectors.order')}</InputLabel>
            <Select
              label={t('gradeDirectors.order')}
              value={ordering}
              onChange={(e) => setOrdering(String(e.target.value))}
            >
              <MenuItem value="">{t('gradeDirectors.defaultOrder')}</MenuItem>
              <MenuItem value="teacher__full_name">{t('gradeDirectors.teacherAsc')}</MenuItem>
              <MenuItem value="-teacher__full_name">{t('gradeDirectors.teacherDesc')}</MenuItem>
              <MenuItem value="group__name">{t('gradeDirectors.groupAsc')}</MenuItem>
              <MenuItem value="-group__name">{t('gradeDirectors.groupDesc')}</MenuItem>
              <MenuItem value="-academic_year__year">{t('gradeDirectors.yearDesc')}</MenuItem>
              <MenuItem value="academic_year__year">{t('gradeDirectors.yearAsc')}</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="text"
            startIcon={<FilterAltOffIcon />}
            onClick={() => {
              setSearchInput('')
              setAppliedSearch('')
              setFilterYearId(null)
              setFilterGroupId(null)
              setFilterTeacherId(null)
              setFilterYearNumber('')
              setFilterGroupName('')
              setFilterTeacherDocument('')
              setOrdering('')
            }}
          >
            {t('common.clear')}
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ width: '100%' }}
          >
            {t('gradeDirectors.globalSearchHint')}
          </Typography>
        </Box>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <Paper sx={{ width: '100%', p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          autoHeight
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          sortingOrder={['asc', 'desc', null]}
          localeText={dataGridLocaleText}
          sx={dataGridDefaultSx}
        />
      </Paper>
      <InfiniteDataGridFooter
        show={rows.length > 0 && !isLoading}
        isFetchingNextPage={listQuery.isFetchingNextPage}
        hasNextPage={listQuery.hasNextPage ?? false}
        onLoadMore={() => void listQuery.fetchNextPage()}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('gradeDirectors.editDirector') : t('gradeDirectors.newDirector')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="teacher"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={teachers}
                  getOptionLabel={(t: Teacher) => t.full_name}
                  value={teachers.find((t) => t.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('gradeDirectors.teacher')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={academicYears}
                  getOptionLabel={(y: AcademicYear) =>
                    `${y.year} (${y.institution_name})`
                  }
                  value={
                    academicYears.find((y) => y.id === field.value) ?? null
                  }
                  onChange={(_, v) => {
                    field.onChange(v?.id ?? '')
                    form.setValue('group', '')
                  }}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('gradeDirectors.academicYear')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="group"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={groupsFiltered}
                  getOptionKey={(g: Group) => g.id}
                  getOptionLabel={(g: Group) =>
                    `${g.name} (${g.campus_name})`
                  }
                  value={
                    groupsFiltered.find((g) => g.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing || !watchedYear}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('gradeDirectors.group')}
                      required
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ||
                        (!watchedYear ? t('gradeDirectors.pickYearFirst') : undefined)
                      }
                    />
                  )}
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {t('common.save')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('gradeDirectors.deleteDirector')}</DialogTitle>
        <DialogContent>
          {t('gradeDirectors.deletePrompt', {
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
