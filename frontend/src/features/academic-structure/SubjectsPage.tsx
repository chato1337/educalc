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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Resolver } from 'react-hook-form'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useMemo, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import { getErrorMessage } from '@/api/errors'
import {
  flatInfinitePages,
  useInfiniteList,
} from '@/api/useInfiniteList'
import { InfiniteScrollSentinel } from '@/components/InfiniteScrollSentinel'
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicArea, Institution, Subject } from '@/types/schemas'

const schema = z.object({
  institution: z.string().uuid('Selecciona una institución'),
  academic_area: z.string().uuid('Selecciona un área'),
  name: z.string().trim().min(1).max(255),
  emphasis: z.string().max(255).optional(),
  hours: z.preprocess(
    (v) =>
      v === '' || v === undefined || Number.isNaN(Number(v))
        ? undefined
        : Number(v),
    z.number().int().min(0).optional(),
  ),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  institution: '',
  academic_area: '',
  name: '',
  emphasis: '',
  hours: undefined,
}

export function SubjectsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()

  const listParams =
    selectedInstitutionId != null
      ? { institution: selectedInstitutionId, search: appliedSearch || undefined }
      : { search: appliedSearch || undefined }

  const listQuery = useInfiniteList<Subject>({
    queryKey: [
      'subjects',
      'list',
      { institution: selectedInstitutionId, search: appliedSearch },
    ],
    url: '/api/subjects/',
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

  const watchedInstitution = useWatch({
    control: form.control,
    name: 'institution',
  })

  const { data: areasForForm = [] } = useQuery({
    queryKey: ['academic-areas', 'for-subject-dialog', watchedInstitution],
    queryFn: async () =>
      fetchReferenceListResults<AcademicArea>('/api/academic-areas/', {
        params: { institution: watchedInstitution },
      }),
    enabled: dialogOpen && !!watchedInstitution,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<Subject>('/api/subjects/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] })
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
    }) => apiClient.patch<Subject>(`/api/subjects/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/subjects/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] })
      setDeleteTarget(null)
    },
  })

  function toPayload(values: FormValues) {
    const body: Record<string, unknown> = {
      institution: values.institution,
      academic_area: values.academic_area,
      name: values.name,
      emphasis: values.emphasis?.trim() || undefined,
    }
    if (values.hours !== undefined) body.hours = values.hours
    return body
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    const inst = selectedInstitutionId ?? ''
    form.reset({
      ...defaults,
      institution: inst,
    })
    setDialogOpen(true)
  }

  function openEdit(row: Subject) {
    setEditing(row)
    setFormError(null)
    form.reset({
      institution: row.institution,
      academic_area: row.academic_area,
      name: row.name,
      emphasis: row.emphasis ?? '',
      hours: row.hours ?? undefined,
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
        <PageHeader title={t('subjects.title')} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('subjects.new')}
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
              <TableCell>{t('subjects.name')}</TableCell>
              <TableCell>{t('subjects.area')}</TableCell>
              <TableCell>{t('subjects.institution')}</TableCell>
              <TableCell>{t('subjects.hours')}</TableCell>
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
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.academic_area_name}</TableCell>
                <TableCell>{row.institution_name}</TableCell>
                <TableCell>{row.hours ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('subjects.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('subjects.delete')}
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
          {editing ? t('subjects.editDialog') : t('subjects.newDialog')}
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
                  onChange={(_, v) => {
                    field.onChange(v?.id ?? '')
                    form.setValue('academic_area', '')
                  }}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('subjects.institution')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_area"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={areasForForm}
                  getOptionLabel={(o: AcademicArea) => o.name}
                  value={
                    areasForForm.find((a) => a.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing || !watchedInstitution}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('subjects.academicArea')}
                      required
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ||
                        (!watchedInstitution
                          ? t('subjects.pickInstitutionFirst')
                          : undefined)
                      }
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('subjects.name')}
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              required
              fullWidth
            />
            <TextField
              label={t('subjects.emphasis')}
              {...form.register('emphasis')}
              fullWidth
            />
            <TextField
              label={t('subjects.hoursOptional')}
              type="number"
              {...form.register('hours')}
              error={!!form.formState.errors.hours}
              helperText={form.formState.errors.hours?.message}
              fullWidth
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
        <DialogTitle>{t('subjects.deleteDialog')}</DialogTitle>
        <DialogContent>{t('subjects.deletePrompt', { name: deleteTarget?.name ?? '' })}</DialogContent>
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
