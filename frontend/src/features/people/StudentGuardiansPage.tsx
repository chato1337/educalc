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
  Checkbox,
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
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import { getErrorMessage } from '@/api/errors'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteScrollSentinel } from '@/components/InfiniteScrollSentinel'
import { PageHeader } from '@/components/PageHeader'
import type { Parent, Student, StudentGuardian } from '@/types/schemas'

const schema = z.object({
  student: z.string().uuid('Selecciona estudiante'),
  parent: z.string().uuid('Selecciona acudiente'),
  is_primary: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function StudentGuardiansPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [studentDocFilter, setStudentDocFilter] = useState('')
  const [parentDocFilter, setParentDocFilter] = useState('')
  const [isPrimaryFilter, setIsPrimaryFilter] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StudentGuardian | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentGuardian | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const listParams = {
    search: appliedSearch || undefined,
    student__document_number: studentDocFilter.trim() || undefined,
    parent__document_number: parentDocFilter.trim() || undefined,
    is_primary: isPrimaryFilter || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<StudentGuardian>({
    queryKey: ['student-guardians', 'list', listParams],
    url: '/api/student-guardians/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const { data: students = [] } = useQuery({
    queryKey: ['students', 'pick-guardian'],
    queryFn: async () => fetchReferenceListResults<Student>('/api/students/'),
    enabled: dialogOpen,
  })
  const { data: parents = [] } = useQuery({
    queryKey: ['parents', 'pick-guardian'],
    queryFn: async () => fetchReferenceListResults<Parent>('/api/parents/'),
    enabled: dialogOpen,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      student: '',
      parent: '',
      is_primary: false,
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: FormValues) =>
      apiClient.post<StudentGuardian>('/api/student-guardians/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-guardians'] })
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
    }) => apiClient.patch<StudentGuardian>(`/api/student-guardians/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-guardians'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/student-guardians/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-guardians'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({ student: '', parent: '', is_primary: false })
    setDialogOpen(true)
  }

  function openEdit(row: StudentGuardian) {
    setEditing(row)
    setFormError(null)
    form.reset({
      student: row.student,
      parent: row.parent,
      is_primary: row.is_primary ?? false,
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setFormError(null)
    form.reset({ student: '', parent: '', is_primary: false })
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

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader title={t('studentGuardians.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('studentGuardians.newRelation')}
        </Button>
      </Box>

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
          {t('common.apply')}
        </Button>
        <TextField
          size="small"
          label={t('studentGuardians.studentDocExact')}
          value={studentDocFilter}
          onChange={(e) => setStudentDocFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('studentGuardians.parentDocExact')}
          value={parentDocFilter}
          onChange={(e) => setParentDocFilter(e.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel>{t('studentGuardians.isPrimary')}</InputLabel>
          <Select
            label={t('studentGuardians.isPrimary')}
            value={isPrimaryFilter}
            onChange={(e) => setIsPrimaryFilter(String(e.target.value))}
          >
            <MenuItem value="">{t('studentGuardians.all')}</MenuItem>
            <MenuItem value="true">{t('studentGuardians.yes')}</MenuItem>
            <MenuItem value="false">{t('studentGuardians.no')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('studentGuardians.order')}</InputLabel>
          <Select
            label={t('studentGuardians.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('studentGuardians.defaultOrder')}</MenuItem>
            <MenuItem value="student__full_name">{t('studentGuardians.studentAsc')}</MenuItem>
            <MenuItem value="-student__full_name">{t('studentGuardians.studentDesc')}</MenuItem>
            <MenuItem value="parent__full_name">{t('studentGuardians.parentAsc')}</MenuItem>
            <MenuItem value="-parent__full_name">{t('studentGuardians.parentDesc')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setStudentDocFilter('')
            setParentDocFilter('')
            setIsPrimaryFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('studentGuardians.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('studentGuardians.student')}</TableCell>
              <TableCell>{t('studentGuardians.parent')}</TableCell>
              <TableCell>{t('studentGuardians.primary')}</TableCell>
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
                <TableCell>{row.student_name}</TableCell>
                <TableCell>{row.parent_name}</TableCell>
                <TableCell>{row.is_primary ? t('studentGuardians.yes') : t('studentGuardians.no')}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('studentGuardians.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('studentGuardians.delete')}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length > 0 ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ border: 0, p: 0 }}>
                  <InfiniteScrollSentinel
                    onLoadMore={() => void listQuery.fetchNextPage()}
                    hasMore={listQuery.hasNextPage ?? false}
                    isLoadingMore={listQuery.isFetchingNextPage}
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('studentGuardians.editRelation') : t('studentGuardians.newRelation')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="student"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={students}
                  getOptionLabel={(s: Student) => s.full_name}
                  value={students.find((s) => s.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('studentGuardians.student')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="parent"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={parents}
                  getOptionLabel={(p: Parent) => p.full_name}
                  value={parents.find((p) => p.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('studentGuardians.parent')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="is_primary"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(_, c) => field.onChange(c)}
                    />
                  }
                  label={t('studentGuardians.primaryGuardian')}
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
        <DialogTitle>{t('studentGuardians.deleteRelation')}</DialogTitle>
        <DialogContent>
          {t('studentGuardians.deleteRelationPrompt', {
            student: deleteTarget?.student_name ?? '',
            parent: deleteTarget?.parent_name ?? '',
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
