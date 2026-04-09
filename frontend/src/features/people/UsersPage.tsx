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
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { useInstitutionsReference } from '@/features/academic-structure/academicQueries'
import { PageHeader } from '@/components/PageHeader'
import type { Parent, RoleEnum, Teacher, UserProfile } from '@/types/schemas'
import type { Institution } from '@/types/schemas'

const roleOptions: RoleEnum[] = [
  'ADMIN',
  'COORDINATOR',
  'TEACHER',
  'PARENT',
]

const schema = z.object({
  user: z.coerce.number().int().positive(),
  role: z.enum(['ADMIN', 'COORDINATOR', 'TEACHER', 'PARENT']).optional(),
  institution: z.string().optional(),
  teacher: z.string().optional(),
  parent: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function toPatchBody(v: FormValues) {
  return {
    role: v.role,
    institution: v.institution || undefined,
    teacher: v.teacher || undefined,
    parent: v.parent || undefined,
  }
}

function toCreateBody(v: FormValues) {
  return {
    user: v.user,
    role: v.role,
    institution: v.institution || undefined,
    teacher: v.teacher || undefined,
    parent: v.parent || undefined,
  }
}

export function UsersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleEnum | ''>('')
  const [institutionFilter, setInstitutionFilter] = useState<string>('')
  const [institutionDaneFilter, setInstitutionDaneFilter] = useState('')
  const [usernameFilter, setUsernameFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')
  const [ordering, setOrdering] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: institutions = [] } = useInstitutionsReference()
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', 'pick'],
    queryFn: async () => {
      const { data } = await apiClient.get<Teacher[]>('/api/teachers/')
      return data
    },
    enabled: dialogOpen,
  })
  const { data: parents = [] } = useQuery({
    queryKey: ['parents', 'pick'],
    queryFn: async () => {
      const { data } = await apiClient.get<Parent[]>('/api/parents/')
      return data
    },
    enabled: dialogOpen,
  })

  const listParams = {
    role: roleFilter || undefined,
    search: appliedSearch || undefined,
    institution: institutionFilter || undefined,
    institution__dane_code: institutionDaneFilter.trim() || undefined,
    user__username: usernameFilter.trim() || undefined,
    user__email: emailFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['users', 'list', listParams],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile[]>('/api/users/', {
        params: listParams,
      })
      return data
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      user: 0,
      role: undefined,
      institution: '',
      teacher: '',
      parent: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toCreateBody>) =>
      apiClient.post<UserProfile>('/api/users/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
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
      body: ReturnType<typeof toPatchBody>
    }) => apiClient.patch<UserProfile>(`/api/users/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/users/${id}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    form.reset({
      user: 0,
      role: undefined,
      institution: '',
      teacher: '',
      parent: '',
    })
    setDialogOpen(true)
  }

  function openEdit(row: UserProfile) {
    setEditing(row)
    setFormError(null)
    form.reset({
      user: row.user,
      role: row.role ?? undefined,
      institution: row.institution ?? '',
      teacher: row.teacher ?? '',
      parent: row.parent ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: toPatchBody(values) })
    } else {
      if (!values.user || values.user <= 0) {
        setFormError(t('users.idRequired'))
        return
      }
      createMutation.mutate(toCreateBody(values))
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
          title={t('users.title')}
          subtitle={t('users.subtitle')}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('users.newProfile')}
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-end">
        <FormControl size="small" className="min-w-[160px]">
          <InputLabel>{t('users.role')}</InputLabel>
          <Select
            label={t('users.role')}
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as RoleEnum | '')
            }
          >
            <MenuItem value="">{t('users.all')}</MenuItem>
            {roleOptions.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
        <Autocomplete
          size="small"
          options={institutions}
          sx={{ minWidth: 220 }}
          getOptionLabel={(o: Institution) => o.name}
          value={institutions.find((i) => i.id === institutionFilter) ?? null}
          onChange={(_, v) => setInstitutionFilter(v?.id ?? '')}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params: AutocompleteRenderInputParams) => (
            <TextField {...params} label={t('users.institution')} />
          )}
        />
        <TextField
          size="small"
          label={t('users.usernameExact')}
          value={usernameFilter}
          onChange={(e) => setUsernameFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('users.emailExact')}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('users.institutionDane')}
          value={institutionDaneFilter}
          onChange={(e) => setInstitutionDaneFilter(e.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('users.order')}</InputLabel>
          <Select
            label={t('users.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('users.defaultOrder')}</MenuItem>
            <MenuItem value="user__username">{t('users.usernameAsc')}</MenuItem>
            <MenuItem value="-user__username">{t('users.usernameDesc')}</MenuItem>
            <MenuItem value="user__email">{t('users.emailAsc')}</MenuItem>
            <MenuItem value="-user__email">{t('users.emailDesc')}</MenuItem>
            <MenuItem value="role">{t('users.roleAsc')}</MenuItem>
            <MenuItem value="-role">{t('users.roleDesc')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setRoleFilter('')
            setInstitutionFilter('')
            setInstitutionDaneFilter('')
            setUsernameFilter('')
            setEmailFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('users.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('users.username')}</TableCell>
              <TableCell>{t('users.email')}</TableCell>
              <TableCell>{t('users.role')}</TableCell>
              <TableCell>{t('users.institutionId')}</TableCell>
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
                <TableCell>
                  #{row.user} — {row.username}
                </TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.role ?? '-'}</TableCell>
                <TableCell>{row.institution ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('users.edit')}
                    onClick={() => openEdit(row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t('users.delete')}
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
          {editing ? t('users.editProfile') : t('users.newProfileDialog')}
        </DialogTitle>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label={t('users.djangoPk')}
              type="number"
              {...form.register('user', { valueAsNumber: true })}
              disabled={!!editing}
              required={!editing}
              fullWidth
              helperText={t('users.djangoPkHelp')}
            />
            <FormControl fullWidth>
              <InputLabel>{t('users.role')}</InputLabel>
              <Controller
                name="role"
                control={form.control}
                render={({ field }) => (
                  <Select
                    label={t('users.role')}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const v = String(e.target.value)
                      field.onChange(
                        v === '' ? undefined : (v as RoleEnum),
                      )
                    }}
                  >
                    <MenuItem value="">{t('users.noRole')}</MenuItem>
                    {roleOptions.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
            <Controller
              name="institution"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={institutions}
                  getOptionLabel={(o: Institution) => o.name}
                  value={
                    institutions.find((i) => i.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField {...params} label={t('users.institution')} />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                />
              )}
            />
            <Controller
              name="teacher"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={teachers}
                  getOptionLabel={(t: Teacher) => t.full_name}
                  value={teachers.find((t) => t.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField {...params} label={t('users.teacherOptional')} />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                />
              )}
            />
            <Controller
              name="parent"
              control={form.control}
              render={({ field }) => (
                <Autocomplete
                  options={parents}
                  getOptionLabel={(p: Parent) => p.full_name}
                  value={parents.find((p) => p.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField {...params} label={t('users.parentOptional')} />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
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
        <DialogTitle>{t('users.deleteProfile')}</DialogTitle>
        <DialogContent>
          {t('users.deleteProfilePrompt', { username: deleteTarget?.username ?? '' })}
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
