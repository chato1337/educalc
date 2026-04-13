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
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicYear,
  Enrollment,
  Group,
  StatusEnum,
  Student,
} from '@/types/schemas'

const statusOptions: StatusEnum[] = ['active', 'withdrawn', 'graduated']

function groupOptionLabel(g: Group): string {
  return g.campus_name ? `${g.name} — ${g.campus_name}` : g.name
}

const schema = z.object({
  student: z.string().uuid('Selecciona estudiante'),
  group: z.string().uuid('Selecciona grupo'),
  academic_year: z.string().uuid('Selecciona año lectivo'),
  enrollment_date: z.string().optional(),
  status: z.enum(['active', 'withdrawn', 'graduated']),
})

type FormValues = z.infer<typeof schema>

export function EnrollmentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Enrollment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)

  const listParams = {
    academic_year: filterYearId ?? undefined,
    status: filterStatus || undefined,
    search: appliedSearch || undefined,
  }

  const listQuery = useInfiniteList<Enrollment>({
    queryKey: queryKeys.enrollments(listParams),
    url: '/api/enrollments/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      student: '',
      group: '',
      academic_year: '',
      enrollment_date: '',
      status: 'active',
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
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<Enrollment>('/api/enrollments/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
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
      body: Record<string, unknown>
    }) => apiClient.patch<Enrollment>(`/api/enrollments/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/enrollments/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    form.reset({
      student: '',
      group: '',
      academic_year: academicYears[0]?.id ?? '',
      enrollment_date: '',
      status: 'active',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: Enrollment) => {
      setEditing(row)
      setFormError(null)
      setAppliedStudentSearch('')
      setStudentSearchInput('')
      form.reset({
        student: row.student,
        group: row.group,
        academic_year: row.academic_year,
        enrollment_date: row.enrollment_date ?? '',
        status: row.status,
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<Enrollment>[]>(
    () => [
      {
        field: 'student_name',
        headerName: t('enrollments.student'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'group_name',
        headerName: t('enrollments.group'),
        flex: 1,
        minWidth: 120,
        sortable: false,
      },
      {
        field: 'academic_year_year',
        headerName: t('enrollments.year'),
        width: 100,
        sortable: false,
      },
      {
        field: 'status',
        headerName: t('enrollments.status'),
        flex: 0.6,
        minWidth: 120,
        sortable: false,
        valueFormatter: (value: StatusEnum) =>
          t(`enrollments.statusValues.${value}`),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<Enrollment>) => [
          <IconButton
            key="edit"
            aria-label={t('enrollments.edit')}
            size="small"
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            aria-label={t('enrollments.delete')}
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
    const body: Record<string, unknown> = {
      student: values.student,
      group: values.group,
      academic_year: values.academic_year,
      status: values.status,
    }
    if (values.enrollment_date) body.enrollment_date = values.enrollment_date
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    form.formState.isSubmitting

  const yearLabel = (y: AcademicYear) => String(y.year)

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('enrollments.title')}
          subtitle={t('enrollments.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId || academicYears.length === 0}
        >
          {t('enrollments.new')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('enrollments.selectInstitution')}
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
          <InputLabel>{t('enrollments.academicYear')}</InputLabel>
          <Select
            label={t('enrollments.academicYear')}
            value={filterYearId ?? ''}
            onChange={(e) =>
              setFilterYearId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">{t('enrollments.all')}</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('enrollments.status')}</InputLabel>
          <Select
            label={t('enrollments.status')}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="">{t('enrollments.all')}</MenuItem>
            {statusOptions.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`enrollments.statusValues.${s}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

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
          {editing ? t('enrollments.editDialog') : t('enrollments.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            {!editing ? (
              <Box className="flex flex-col gap-1">
                <Box className="flex gap-2 items-end">
                  <TextField
                    size="small"
                    label={t('enrollments.searchStudent')}
                    fullWidth
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
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
                      getOptionLabel={(o: Student) => o.full_name}
                      value={
                        studentOptions.find((s) => s.id === field.value) ?? null
                      }
                      onChange={(_, v) => field.onChange(v?.id ?? '')}
                      renderInput={(params: AutocompleteRenderInputParams) => (
                        <TextField
                          {...params}
                          label={t('enrollments.student')}
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                  )}
                />
              </Box>
            ) : (
              <TextField
                label={t('enrollments.student')}
                value={editing.student_name}
                disabled
                fullWidth
              />
            )}
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error} required>
                  <InputLabel>{t('enrollments.academicYear')}</InputLabel>
                  <Select
                    label={t('enrollments.academicYear')}
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
                  getOptionLabel={(g: Group) => groupOptionLabel(g)}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  value={groupsForFormYear.find((g) => g.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!watchedFormYear}
                  renderOption={(props, option) => {
                    // Quitar `key` de MUI (índice); usar id del grupo para listas estables.
                    const { key, ...rest } = props
                    void key
                    return (
                      <li key={option.id} {...rest}>
                        {groupOptionLabel(option)}
                      </li>
                    )
                  }}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('enrollments.group')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <FormControl fullWidth required>
                  <InputLabel>{t('enrollments.status')}</InputLabel>
                  <Select
                    label={t('enrollments.status')}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {statusOptions.map((s) => (
                      <MenuItem key={s} value={s}>
                        {t(`enrollments.statusValues.${s}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              label={t('enrollments.enrollmentDate')}
              type="date"
              InputLabelProps={{ shrink: true }}
              fullWidth
              {...form.register('enrollment_date')}
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
        <DialogTitle>{t('enrollments.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('enrollments.deletePrompt', {
            student: deleteTarget?.student_name ?? '',
            group: deleteTarget?.group_name ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
