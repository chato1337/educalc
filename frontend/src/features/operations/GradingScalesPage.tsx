import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { flatInfinitePages, useInfiniteList } from '@/api/useInfiniteList'
import { InfiniteDataGridFooter } from '@/components/InfiniteDataGridFooter'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import { PageHeader } from '@/components/PageHeader'
import {
  createGradingScale,
  deleteGradingScale,
  patchGradingScale,
  type GradingScaleRequest,
  type PatchedGradingScaleRequest,
} from '@/features/operations/gradingScalesApi'
import { useUiStore } from '@/stores/uiStore'
import type { GradingScale } from '@/types/schemas'

const dec = z
  .string()
  .min(1)
  .regex(/^-?\d{0,2}(\.\d{0,2})?$/, 'Formato decimal inválido')

const schema = z.object({
  institution: z.string().uuid(),
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(50),
  min_score: dec,
  max_score: dec,
  description: z.string().max(255).optional(),
})

type FormValues = z.infer<typeof schema>

function toGradingScaleRequest(values: FormValues): GradingScaleRequest {
  return {
    institution: values.institution,
    code: values.code,
    name: values.name,
    min_score: values.min_score,
    max_score: values.max_score,
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
  }
}

function toPatchedGradingScaleRequest(
  values: FormValues,
): PatchedGradingScaleRequest {
  return {
    institution: values.institution,
    code: values.code,
    name: values.name,
    min_score: values.min_score,
    max_score: values.max_score,
    description: values.description?.trim() || undefined,
  }
}

export function GradingScalesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GradingScale | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GradingScale | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const listParams =
    selectedInstitutionId != null
      ? {
          institution: selectedInstitutionId,
          search: appliedSearch.trim() || undefined,
        }
      : { search: appliedSearch.trim() || undefined }

  const listQuery = useInfiniteList<GradingScale>({
    queryKey: [
      ...queryKeys.gradingScales(
        selectedInstitutionId,
        appliedSearch || undefined,
      ),
    ],
    url: '/api/grading-scales/',
    params: listParams,
  })
  const rows = useMemo(() => flatInfinitePages(listQuery.data), [listQuery.data])
  const isLoading = listQuery.isLoading
  const error = listQuery.error

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      institution: '',
      code: '',
      name: '',
      min_score: '',
      max_score: '',
      description: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: FormValues) =>
      createGradingScale(toGradingScaleRequest(body)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grading-scales'] })
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
    }) => patchGradingScale(id, toPatchedGradingScaleRequest(body)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grading-scales'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGradingScale(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grading-scales'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    if (!selectedInstitutionId) return
    setEditing(null)
    setFormError(null)
    form.reset({
      institution: selectedInstitutionId,
      code: '',
      name: '',
      min_score: '',
      max_score: '',
      description: '',
    })
    setDialogOpen(true)
  }

  const dataGridLocaleText = useMuiDataGridLocaleText()

  const openEdit = useCallback(
    (row: GradingScale) => {
      setEditing(row)
      setFormError(null)
      form.reset({
        institution: row.institution,
        code: row.code,
        name: row.name,
        min_score: String(row.min_score),
        max_score: String(row.max_score),
        description: row.description ?? '',
      })
      setDialogOpen(true)
    },
    [form],
  )

  const columns = useMemo<GridColDef<GradingScale>[]>(
    () => [
      {
        field: 'code',
        headerName: t('gradingScales.code'),
        flex: 0.5,
        minWidth: 90,
        sortable: false,
      },
      {
        field: 'name',
        headerName: t('gradingScales.name'),
        flex: 1,
        minWidth: 140,
        sortable: false,
      },
      {
        field: 'min_score',
        headerName: t('gradingScales.min'),
        width: 100,
        sortable: false,
      },
      {
        field: 'max_score',
        headerName: t('gradingScales.max'),
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
        getActions: (params: GridRenderCellParams<GradingScale>) => [
          <IconButton
            key="edit"
            aria-label={t('gradingScales.edit')}
            size="small"
            onClick={() => openEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>,
          <IconButton
            key="delete"
            aria-label={t('gradingScales.delete')}
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

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('gradingScales.title')}
          subtitle={t('gradingScales.subtitle')}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!selectedInstitutionId}
        >
          {t('gradingScales.new')}
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          {t('gradingScales.selectInstitution')}
        </Alert>
      ) : null}

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
          {t('common.search')}
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
          {editing ? t('gradingScales.editDialog') : t('gradingScales.newDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <input type="hidden" {...form.register('institution')} />
            <TextField
              label={t('gradingScales.code')}
              fullWidth
              required
              {...form.register('code')}
              error={!!form.formState.errors.code}
              helperText={form.formState.errors.code?.message}
            />
            <TextField
              label={t('gradingScales.name')}
              fullWidth
              required
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
            />
            <TextField
              label={t('gradingScales.minScore')}
              fullWidth
              required
              {...form.register('min_score')}
              error={!!form.formState.errors.min_score}
              helperText={form.formState.errors.min_score?.message}
            />
            <TextField
              label={t('gradingScales.maxScore')}
              fullWidth
              required
              {...form.register('max_score')}
              error={!!form.formState.errors.max_score}
              helperText={form.formState.errors.max_score?.message}
            />
            <TextField
              label={t('gradingScales.description')}
              fullWidth
              multiline
              minRows={2}
              {...form.register('description')}
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
        <DialogTitle>{t('gradingScales.deleteDialog')}</DialogTitle>
        <DialogContent>
          {t('gradingScales.deletePrompt', {
            name: deleteTarget?.name ?? '',
            code: deleteTarget?.code ?? '',
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
