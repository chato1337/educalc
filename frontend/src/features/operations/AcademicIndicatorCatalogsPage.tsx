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
  TextField,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  flatInfinitePages,
  useInfiniteList,
} from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import {
  useAcademicAreasQuery,
  useGradeLevelsQuery,
} from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicArea, AcademicIndicatorCatalog, GradeLevel } from '@/types/schemas'

const schema = z.object({
  academic_area: z.string().uuid(),
  grade_level: z.string().uuid(),
  achievement_below_basic: z.string().trim().min(1),
  achievement_basic_or_above: z.string().trim().min(1),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  academic_area: '',
  grade_level: '',
  achievement_below_basic: '',
  achievement_basic_or_above: '',
}

function clip(text: string, max: number) {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export type AcademicIndicatorCatalogsPageProps = {
  /** Overrides default `indicatorCatalogs` header copy (e.g. `/academic-indicators` route). */
  pageTitle?: string
  pageSubtitle?: string
  selectInstitutionMessage?: string
}

export function AcademicIndicatorCatalogsPage({
  pageTitle,
  pageSubtitle,
  selectInstitutionMessage,
}: AcademicIndicatorCatalogsPageProps = {}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicIndicatorCatalog | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicIndicatorCatalog | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)

  const { data: academicAreas = [] } = useAcademicAreasQuery(
    selectedInstitutionId,
  )
  const { data: gradeLevels = [] } = useGradeLevelsQuery(selectedInstitutionId)

  const listParams = useMemo(
    () =>
      selectedInstitutionId
        ? {
            academic_area__institution: selectedInstitutionId,
            grade_level__institution: selectedInstitutionId,
            search: appliedSearch || undefined,
          }
        : {},
    [selectedInstitutionId, appliedSearch],
  )

  const listQuery = useInfiniteList<AcademicIndicatorCatalog>({
    queryKey: queryKeys.academicIndicatorCatalogs(
      listParams as Record<string, string>,
    ),
    url: '/api/academic-indicator-catalogs/',
    params: listParams as Record<string, string | undefined>,
    enabled: !!selectedInstitutionId,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['academic-indicator-catalogs'] })
  }

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicIndicatorCatalog>(
        '/api/academic-indicator-catalogs/',
        body,
      ),
    onSuccess: () => {
      invalidate()
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
    }) =>
      apiClient.patch<AcademicIndicatorCatalog>(
        `/api/academic-indicator-catalogs/${id}/`,
        body,
      ),
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/academic-indicator-catalogs/${id}/`),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      ...defaults,
      academic_area: academicAreas[0]?.id ?? '',
      grade_level: gradeLevels[0]?.id ?? '',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: AcademicIndicatorCatalog) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        academic_area: row.academic_area,
        grade_level: row.grade_level,
        achievement_below_basic: row.achievement_below_basic,
        achievement_basic_or_above: row.achievement_basic_or_above,
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<AcademicIndicatorCatalog>[]>(
    () => [
      {
        field: 'academic_area_name',
        headerName: t('indicatorCatalogs.area'),
        flex: 1,
        minWidth: 160,
        sortable: false,
      },
      {
        field: 'grade_level_name',
        headerName: t('indicatorCatalogs.grade'),
        width: 120,
        sortable: false,
      },
      {
        field: 'achievement_below_basic',
        headerName: t('indicatorCatalogs.belowBasic'),
        flex: 1,
        minWidth: 160,
        sortable: false,
        valueFormatter: (v: string | null | undefined) =>
          clip(String(v ?? ''), 80),
      },
      {
        field: 'achievement_basic_or_above',
        headerName: t('indicatorCatalogs.basicOrAbove'),
        flex: 1,
        minWidth: 160,
        sortable: false,
        valueFormatter: (v: string | null | undefined) =>
          clip(String(v ?? ''), 80),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: t('common.actions'),
        width: 108,
        align: 'right',
        headerAlign: 'right',
        getActions: (params: GridRenderCellParams<AcademicIndicatorCatalog>) => [
          <IconButton
            key="edit"
            size="small"
            aria-label={t('indicatorCatalogs.edit')}
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            size="small"
            color="error"
            aria-label={t('indicatorCatalogs.delete')}
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
    form.reset(defaults)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const body: Record<string, unknown> = {
      academic_area: values.academic_area,
      grade_level: values.grade_level,
      achievement_below_basic: values.achievement_below_basic,
      achievement_basic_or_above: values.achievement_basic_or_above,
    }
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
      <PageHeader
        title={pageTitle ?? t('indicatorCatalogs.title')}
        subtitle={pageSubtitle ?? t('indicatorCatalogs.subtitle')}
      />

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {selectInstitutionMessage ?? t('indicatorCatalogs.selectInstitution')}
        </Alert>
      ) : null}

      <Box className="flex flex-wrap justify-between items-center gap-2">
        <Paper className="p-3 flex flex-wrap gap-2 items-center flex-1 min-w-0">
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId || academicAreas.length === 0}
        >
          {t('indicatorCatalogs.new')}
        </Button>
      </Box>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}
      {formError && !dialogOpen ? (
        <Alert severity="error" onClose={() => setFormError(null)}>
          {formError}
        </Alert>
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
          {editing ? t('indicatorCatalogs.editDialog') : t('indicatorCatalogs.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Controller
              name="academic_area"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={academicAreas}
                  getOptionLabel={(o: AcademicArea) => o.name}
                  value={academicAreas.find((a) => a.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('indicatorCatalogs.area')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="grade_level"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={gradeLevels}
                  getOptionLabel={(o: GradeLevel) => o.name}
                  value={gradeLevels.find((g) => g.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!!editing}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label={t('indicatorCatalogs.grade')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            <TextField
              label={t('indicatorCatalogs.belowBasic')}
              {...form.register('achievement_below_basic')}
              error={!!form.formState.errors.achievement_below_basic}
              helperText={form.formState.errors.achievement_below_basic?.message}
              required
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label={t('indicatorCatalogs.basicOrAbove')}
              {...form.register('achievement_basic_or_above')}
              error={!!form.formState.errors.achievement_basic_or_above}
              helperText={
                form.formState.errors.achievement_basic_or_above?.message
              }
              required
              fullWidth
              multiline
              minRows={2}
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
        <DialogTitle>{t('indicatorCatalogs.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('indicatorCatalogs.deletePrompt', {
            label: deleteTarget
              ? `${deleteTarget.academic_area_name} / ${deleteTarget.grade_level_name}`
              : '',
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
