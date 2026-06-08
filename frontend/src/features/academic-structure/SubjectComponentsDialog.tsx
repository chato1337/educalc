import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import TuneIcon from '@mui/icons-material/Tune'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import {
  createSubjectComponent,
  deleteSubjectComponent,
  fetchSubjectComponentsForSubject,
  patchSubjectComponent,
  type SubjectComponent,
} from '@/features/operations/gradingApi'
import type { Subject } from '@/types/schemas'

const weightDec = z
  .string()
  .min(1)
  .regex(/^-?\d{0,3}(\.\d{0,2})?$/, 'Formato inválido')

const formSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().optional(),
  weight_percent: weightDec,
  sort_order: z.coerce.number().int().min(0).max(32767).optional(),
})

type FormValues = z.infer<typeof formSchema>

const emptyFormValues: FormValues = {
  name: '',
  description: '',
  weight_percent: '',
  sort_order: 0,
}

function componentWeightsValid(components: SubjectComponent[]): boolean {
  if (components.length === 0) return false
  const total = components.reduce(
    (sum, c) => sum + Number(c.weight_percent),
    0,
  )
  return Math.abs(total - 100) <= 0.01
}

export type SubjectComponentsDialogProps = {
  subject: Subject | null
  open: boolean
  onClose: () => void
}

export function SubjectComponentsDialog({
  subject,
  open,
  onClose,
}: SubjectComponentsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<SubjectComponent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubjectComponent | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const queryKey = ['subject-components', subject?.id ?? 'none']

  const { data: components = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSubjectComponentsForSubject(subject!.id),
    enabled: open && !!subject?.id,
  })

  const sorted = useMemo(
    () =>
      [...components].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    [components],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: emptyFormValues,
  })

  useEffect(() => {
    if (!open) return
    setEditing(null)
    setFormError(null)
    form.reset(emptyFormValues)
    setFormKey((k) => k + 1)
  }, [open, subject?.id])

  function showToast(message: string, severity: 'success' | 'error' = 'success') {
    setToast({ open: true, message, severity })
  }

  function clearForm() {
    setEditing(null)
    setFormError(null)
    form.reset(emptyFormValues)
    setFormKey((k) => k + 1)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!subject) return
      const body = {
        subject: subject.id,
        name: values.name,
        description: values.description?.trim() || undefined,
        weight_percent: values.weight_percent,
        sort_order: values.sort_order ?? 0,
      }
      if (editing) return patchSubjectComponent(editing.id, body)
      return createSubjectComponent(body)
    },
    onSuccess: (_data, _variables, _context) => {
      void queryClient.invalidateQueries({ queryKey })
      const wasEditing = !!editing
      clearForm()
      showToast(
        wasEditing
          ? t('gradingSchemes.componentUpdated')
          : t('gradingSchemes.componentCreated'),
      )
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubjectComponent(id),
    onSuccess: (_data, deletedId) => {
      void queryClient.invalidateQueries({ queryKey })
      setDeleteTarget(null)
      if (editing?.id === deletedId) {
        clearForm()
      }
      showToast(t('gradingSchemes.componentDeleted'))
    },
  })

  function startEdit(component: SubjectComponent) {
    setFormError(null)
    setEditing(component)
    form.reset({
      name: component.name,
      description: component.description ?? '',
      weight_percent: component.weight_percent,
      sort_order: component.sort_order ?? 0,
    })
  }

  function cancelEdit() {
    clearForm()
  }

  const weightsOk = componentWeightsValid(sorted)

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>
          {t('gradingSchemes.subjectComponentsTitle', {
            name: subject?.name ?? '',
          })}
        </DialogTitle>
        <DialogContent className="flex flex-col gap-3 pt-1">
          <Typography variant="body2" color="text.secondary">
            {t('gradingSchemes.subjectComponentsHint')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={
                weightsOk
                  ? t('gradingSchemes.weightsOk')
                  : t('gradingSchemes.weightsInvalid')
              }
              color={weightsOk ? 'success' : 'warning'}
              variant="outlined"
            />
          </Stack>

          {isLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('common.loading')}
            </Typography>
          ) : sorted.length === 0 ? (
            <Alert severity="info">{t('gradingSchemes.noComponents')}</Alert>
          ) : (
            <Stack spacing={1}>
              {sorted.map((component) => (
                <Stack
                  key={component.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={500}>
                      {component.name} ({component.weight_percent}%)
                    </Typography>
                    {component.description ? (
                      <Typography variant="body2" color="text.secondary">
                        {component.description}
                      </Typography>
                    ) : null}
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={t('common.edit')}
                    onClick={() => startEdit(component)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleteTarget(component)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            {editing
              ? t('gradingSchemes.editComponent')
              : t('gradingSchemes.newComponent')}
          </Typography>
          <form
            key={editing ? `edit-${editing.id}` : `new-${formKey}`}
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          >
            <Stack spacing={2}>
              {formError ? <Alert severity="error">{formError}</Alert> : null}
              <TextField
                label={t('gradingSchemes.name')}
                required
                fullWidth
                {...form.register('name')}
                error={!!form.formState.errors.name}
                helperText={form.formState.errors.name?.message}
              />
              <TextField
                label={t('gradingSchemes.description')}
                fullWidth
                multiline
                minRows={2}
                {...form.register('description')}
              />
              <TextField
                label={t('gradingSchemes.weightPercent')}
                required
                fullWidth
                {...form.register('weight_percent')}
              />
              <TextField
                label={t('gradingSchemes.sortOrder')}
                type="number"
                fullWidth
                {...form.register('sort_order')}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={editing ? undefined : <AddIcon />}
                  disabled={saveMutation.isPending}
                >
                  {editing ? t('common.save') : t('gradingSchemes.addComponent')}
                </Button>
                {editing ? (
                  <Button type="button" onClick={cancelEdit}>
                    {t('common.cancel')}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('gradingSchemes.deleteEntity')}</DialogTitle>
        <DialogContent>
          {t('gradingSchemes.deleteEntityPrompt', {
            name: deleteTarget?.name ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
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
    </>
  )
}

export type SubjectComponentsActionProps = {
  subject: Subject
  onOpen: () => void
}

export function SubjectComponentsAction({
  onOpen,
}: SubjectComponentsActionProps) {
  const { t } = useTranslation()
  return (
    <IconButton
      size="small"
      aria-label={t('gradingSchemes.manageSubjectComponents')}
      title={t('gradingSchemes.manageSubjectComponents')}
      onClick={onOpen}
    >
      <TuneIcon fontSize="small" />
    </IconButton>
  )
}
