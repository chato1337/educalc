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
import { InfiniteScrollSentinel } from '@/components/InfiniteScrollSentinel'
import { PageHeader } from '@/components/PageHeader'
import type { Parent } from '@/types/schemas'

const schema = z.object({
  document_type: z.string().max(80).optional(),
  document_number: z.string().max(20).optional(),
  first_name: z.string().trim().min(1).max(100),
  second_name: z.string().max(100).optional(),
  first_last_name: z.string().trim().min(1).max(100),
  second_last_name: z.string().max(100).optional(),
  full_name: z.string().trim().min(1).max(400),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  kinship: z.string().max(50).optional(),
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
  kinship: '',
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
    email: v.email,
    phone: v.phone || undefined,
    kinship: v.kinship || undefined,
  }
}

export function ParentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('')
  const [documentNumberFilter, setDocumentNumberFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')
  const [kinshipFilter, setKinshipFilter] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Parent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const listParams = {
    search: appliedSearch || undefined,
    document_type: documentTypeFilter.trim() || undefined,
    document_number: documentNumberFilter.trim() || undefined,
    email: emailFilter.trim() || undefined,
    kinship: kinshipFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const listQuery = useInfiniteList<Parent>({
    queryKey: ['parents', 'list', listParams],
    url: '/api/parents/',
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
      apiClient.post<Parent>('/api/parents/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parents'] })
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
    }) => apiClient.patch<Parent>(`/api/parents/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parents'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/parents/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parents'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset(defaults)
    setDialogOpen(true)
  }

  function openEdit(row: Parent) {
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
      kinship: row.kinship ?? '',
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
        <PageHeader title={t('parents.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('parents.new')}
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
          label={t('parents.documentTypeExact')}
          value={documentTypeFilter}
          onChange={(e) => setDocumentTypeFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('parents.documentNumberExact')}
          value={documentNumberFilter}
          onChange={(e) => setDocumentNumberFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('parents.emailExact')}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('parents.kinshipExact')}
          value={kinshipFilter}
          onChange={(e) => setKinshipFilter(e.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('parents.order')}</InputLabel>
          <Select
            label={t('parents.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('parents.defaultOrder')}</MenuItem>
            <MenuItem value="full_name">{t('parents.nameAsc')}</MenuItem>
            <MenuItem value="-full_name">{t('parents.nameDesc')}</MenuItem>
            <MenuItem value="document_number">{t('parents.documentAsc')}</MenuItem>
            <MenuItem value="-document_number">{t('parents.documentDesc')}</MenuItem>
            <MenuItem value="email">{t('parents.emailAsc')}</MenuItem>
            <MenuItem value="-email">{t('parents.emailDesc')}</MenuItem>
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
            setKinshipFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('parents.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('parents.name')}</TableCell>
              <TableCell>{t('parents.email')}</TableCell>
              <TableCell>{t('parents.kinship')}</TableCell>
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
                <TableCell>{row.full_name}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.kinship ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('parents.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('parents.delete')}
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
          {editing ? t('parents.editParent') : t('parents.newParent')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1 max-h-[70vh] overflow-auto">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <DocumentTypeSelect
              registerProps={form.register('document_type')}
              currentValue={documentTypeValue}
            />
            <TextField label={t('parents.documentNumber')} {...form.register('document_number')} fullWidth />
            <TextField
              label={t('parents.firstName')}
              {...form.register('first_name')}
              required
              fullWidth
            />
            <TextField label={t('parents.secondName')} {...form.register('second_name')} fullWidth />
            <TextField
              label={t('parents.firstLastName')}
              {...form.register('first_last_name')}
              required
              fullWidth
            />
            <TextField label={t('parents.secondLastName')} {...form.register('second_last_name')} fullWidth />
            <TextField
              label={t('parents.fullName')}
              {...form.register('full_name')}
              required
              fullWidth
            />
            <TextField
              label={t('parents.email')}
              type="email"
              {...form.register('email')}
              required
              error={!!form.formState.errors.email}
              helperText={form.formState.errors.email?.message}
              fullWidth
            />
            <TextField label={t('parents.phone')} {...form.register('phone')} fullWidth />
            <TextField label={t('parents.kinship')} {...form.register('kinship')} fullWidth />
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
        <DialogTitle>{t('parents.deleteParent')}</DialogTitle>
        <DialogContent>{t('parents.deleteParentPrompt', { name: deleteTarget?.full_name ?? '' })}</DialogContent>
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
