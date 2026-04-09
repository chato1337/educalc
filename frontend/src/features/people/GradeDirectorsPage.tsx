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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Controller,
  useForm,
  useWatch,
  type Resolver,
} from 'react-hook-form'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import {
  useAcademicYearsQuery,
} from '@/features/academic-structure/academicQueries'
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
    queryFn: async () => {
      const { data } = await apiClient.get<Teacher[]>('/api/teachers/')
      return data
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', 'for-gd', filterYearId],
    queryFn: async () => {
      const { data } = await apiClient.get<Group[]>('/api/groups/', {
        params: filterYearId ? { academic_year: filterYearId } : undefined,
      })
      return data
    },
    enabled: !!filterYearId,
  })

  const { data: groupsForForm = [] } = useQuery({
    queryKey: ['groups', 'form-gd', dialogOpen],
    queryFn: async () => {
      const { data } = await apiClient.get<Group[]>('/api/groups/')
      return data
    },
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

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['grade-directors', 'list', listParams],
    queryFn: async () => {
      const { data } = await apiClient.get<GradeDirector[]>(
        '/api/grade-directors/',
        { params: listParams },
      )
      return data
    },
  })

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

  function openEdit(row: GradeDirector) {
    setEditing(row)
    setFormError(null)
    form.reset({
      teacher: row.teacher,
      group: row.group,
      academic_year: row.academic_year,
    })
    setDialogOpen(true)
  }

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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('gradeDirectors.teacher')}</TableCell>
              <TableCell>{t('gradeDirectors.group')}</TableCell>
              <TableCell>{t('gradeDirectors.year')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.none')}</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.teacher_name}</TableCell>
                <TableCell>{row.group_name}</TableCell>
                <TableCell>{row.academic_year_year}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('gradeDirectors.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('gradeDirectors.delete')}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
