import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { DocumentTypeSelect } from '@/components/DocumentTypeSelect'
import { InfiniteTableBodyFooter } from '@/components/InfiniteTableBodyFooter'
import { PageHeader } from '@/components/PageHeader'
import type { Teacher } from '@/types/schemas'

const schema = z.object({
  document_type: z.string().max(80).optional(),
  document_number: z.string().max(20).optional(),
  first_name: z.string().trim().min(1).max(100),
  second_name: z.string().max(100).optional(),
  first_last_name: z.string().trim().min(1).max(100),
  second_last_name: z.string().max(100).optional(),
  full_name: z.string().trim().min(1).max(400),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().max(30).optional(),
  specialty: z.string().max(100).optional(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  document_type: '',
  document_number: '',
  first_name: '',
  second_name: '',
  first_last_name: '',
  second_last_name: '',
  full_name: '',
  email: '',
  phone: '',
  specialty: '',
}

function toApiBody(v: FormValues) {
  return {
    document_type: v.document_type || undefined,
    document_number: v.document_number || undefined,
    first_name: v.first_name,
    second_name: v.second_name || undefined,
    first_last_name: v.first_last_name,
    second_last_name: v.second_last_name || undefined,
    full_name: v.full_name,
    email: v.email || undefined,
    phone: v.phone || undefined,
    specialty: v.specialty || undefined,
  }
}

export function TeachersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('')
  const [documentNumberFilter, setDocumentNumberFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const listParams = {
    search: appliedSearch || undefined,
    document_type: documentTypeFilter.trim() || undefined,
    document_number: documentNumberFilter.trim() || undefined,
    email: emailFilter.trim() || undefined,
    specialty: specialtyFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<Teacher>({
    queryKey: ['teachers', 'list', listParams],
    url: '/api/teachers/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })
  const documentTypeValue = form.watch('document_type')

  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toApiBody>) =>
      apiClient.post<Teacher>('/api/teachers/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
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
      body: ReturnType<typeof toApiBody>
    }) => apiClient.patch<Teacher>(`/api/teachers/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/teachers/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset(defaults)
    setDialogOpen(true)
  }

  function openEdit(row: Teacher) {
    setEditing(row)
    setFormError(null)
    form.reset({
      document_type: row.document_type ?? '',
      document_number: row.document_number ?? '',
      first_name: row.first_name,
      second_name: row.second_name ?? '',
      first_last_name: row.first_last_name,
      second_last_name: row.second_last_name ?? '',
      full_name: row.full_name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      specialty: row.specialty ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setFormError(null)
    form.reset(defaults)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const body = toApiBody(values)
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

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader title={t('teachers.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('teachers.new')}
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
          label={t('teachers.documentTypeExact')}
          value={documentTypeFilter}
          onChange={(e) => setDocumentTypeFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('teachers.documentNumberExact')}
          value={documentNumberFilter}
          onChange={(e) => setDocumentNumberFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('teachers.emailExact')}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('teachers.specialtyExact')}
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('teachers.order')}</InputLabel>
          <Select
            label={t('teachers.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('teachers.defaultOrder')}</MenuItem>
            <MenuItem value="full_name">{t('teachers.nameAsc')}</MenuItem>
            <MenuItem value="-full_name">{t('teachers.nameDesc')}</MenuItem>
            <MenuItem value="document_number">{t('teachers.documentAsc')}</MenuItem>
            <MenuItem value="-document_number">{t('teachers.documentDesc')}</MenuItem>
            <MenuItem value="email">{t('teachers.emailAsc')}</MenuItem>
            <MenuItem value="-email">{t('teachers.emailDesc')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setDocumentTypeFilter('')
            setDocumentNumberFilter('')
            setEmailFilter('')
            setSpecialtyFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('teachers.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('teachers.name')}</TableCell>
              <TableCell>{t('teachers.document')}</TableCell>
              <TableCell>{t('teachers.email')}</TableCell>
              <TableCell>{t('teachers.specialty')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>{t('common.none')}</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.full_name}</TableCell>
                <TableCell>
                  {row.document_type} {row.document_number}
                </TableCell>
                <TableCell>{row.email ?? '-'}</TableCell>
                <TableCell>{row.specialty ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('teachers.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('teachers.delete')}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <InfiniteTableBodyFooter
              columnCount={5}
              hasRows={rows.length > 0}
              isLoading={isLoading}
              isFetchingNextPage={listQuery.isFetchingNextPage}
              hasNextPage={listQuery.hasNextPage ?? false}
              onLoadMore={() => void listQuery.fetchNextPage()}
            />
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('teachers.editTeacher') : t('teachers.newTeacher')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1 max-h-[70vh] overflow-auto">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <DocumentTypeSelect
              registerProps={form.register('document_type')}
              currentValue={documentTypeValue}
            />
            <TextField label={t('teachers.documentNumber')} {...form.register('document_number')} fullWidth />
            <TextField
              label={t('teachers.firstName')}
              {...form.register('first_name')}
              required
              error={!!form.formState.errors.first_name}
              helperText={form.formState.errors.first_name?.message}
              fullWidth
            />
            <TextField label={t('teachers.secondName')} {...form.register('second_name')} fullWidth />
            <TextField
              label={t('teachers.firstLastName')}
              {...form.register('first_last_name')}
              required
              error={!!form.formState.errors.first_last_name}
              helperText={form.formState.errors.first_last_name?.message}
              fullWidth
            />
            <TextField label={t('teachers.secondLastName')} {...form.register('second_last_name')} fullWidth />
            <TextField
              label={t('teachers.fullName')}
              {...form.register('full_name')}
              required
              error={!!form.formState.errors.full_name}
              helperText={form.formState.errors.full_name?.message}
              fullWidth
            />
            <TextField
              label={t('teachers.email')}
              type="email"
              {...form.register('email')}
              error={!!form.formState.errors.email}
              helperText={form.formState.errors.email?.message}
              fullWidth
            />
            <TextField label={t('teachers.phone')} {...form.register('phone')} fullWidth />
            <TextField label={t('teachers.specialty')} {...form.register('specialty')} fullWidth />
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
        <DialogTitle>{t('teachers.deleteTeacher')}</DialogTitle>
        <DialogContent>{t('teachers.deleteTeacherPrompt', { name: deleteTarget?.full_name ?? '' })}</DialogContent>
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
