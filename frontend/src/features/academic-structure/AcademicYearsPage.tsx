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
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Resolver } from 'react-hook-form'
import { Controller, useForm } from 'react-hook-form'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import {
  flatInfinitePages,
  useInfiniteList,
} from '@/api/useInfiniteList'
import { InfiniteScrollSentinel } from '@/components/InfiniteScrollSentinel'
import { PageHeader } from '@/components/PageHeader'
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicYear, Institution } from '@/types/schemas'

const schema = z.object({
  institution: z.string().uuid('Selecciona una institución'),
  year: z.coerce.number().int().min(1900).max(2100),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  institution: '',
  year: new Date().getFullYear(),
  start_date: '',
  end_date: '',
  is_active: true,
}

export function AcademicYearsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId, search: appliedSearch || undefined }
      : { search: appliedSearch || undefined }

  const listQuery = useInfiniteList<AcademicYear>({
    queryKey: [
      'academic-years',
      'list',
      { institution: selectedInstitutionId, search: appliedSearch },
    ],
    url: '/api/academic-years/',
    params: listParams,
  })
  const rows = useMemo(
    () => flatInfinitePages(listQuery.data),
    [listQuery.data],
  )
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicYear>('/api/academic-years/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
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
    }) => apiClient.patch<AcademicYear>(`/api/academic-years/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/academic-years/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    return {
      institution: values.institution,
      year: values.year,
      start_date: values.start_date?.trim() || undefined,
      end_date: values.end_date?.trim() || undefined,
      is_active: values.is_active,
    }
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      ...defaults,
      institution: selectedInstitutionId ?? '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: AcademicYear) {
    setEditing(row)
    setFormError(null)
    form.reset({
      institution: row.institution,
      year: row.year,
      start_date: row.start_date?.slice(0, 10) ?? '',
      end_date: row.end_date?.slice(0, 10) ?? '',
      is_active: row.is_active ?? true,
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
    const body = toPayload(values)
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
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('academicYears.title')}
          subtitle={t('academicYears.subtitle')}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('academicYears.new')}
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-center">
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
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('academicYears.year')}</TableCell>
              <TableCell>{t('academicYears.institution')}</TableCell>
              <TableCell>{t('academicYears.active')}</TableCell>
              <TableCell>{t('academicYears.dateRange')}</TableCell>
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
                <TableCell>{row.year}</TableCell>
                <TableCell>{row.institution_name}</TableCell>
                <TableCell>{row.is_active ? t('academicYears.yes') : t('academicYears.no')}</TableCell>
                <TableCell>
                  {[row.start_date, row.end_date].filter(Boolean).join(' → ') ||
                    '-'}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('academicYears.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('academicYears.delete')}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length > 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ border: 0, p: 0 }}>
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
          {editing ? t('academicYears.editDialog') : t('academicYears.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="institution"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={institutions}
                  getOptionLabel={(o: Institution) => o.name}
                  value={
                    institutions.find((i) => i.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('academicYears.institution')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('academicYears.yearNumber')}
              type="number"
              {...form.register('year', { valueAsNumber: true })}
              error={!!form.formState.errors.year}
              helperText={form.formState.errors.year?.message}
              required
              fullWidth
              disabled={!!editing}
            />
            <TextField
              label={t('academicYears.start')}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('start_date')}
              fullWidth
            />
            <TextField
              label={t('academicYears.end')}
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('end_date')}
              fullWidth
            />
            <Controller
              name="is_active"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(_, c) => field.onChange(c)}
                    />
                  }
                  label={t('academicYears.activeYear')}
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

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>{t('academicYears.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('academicYears.deletePrompt', {
            year: deleteTarget?.year ?? '',
            institution: deleteTarget?.institution_name ?? '',
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
