import AddIcon from '@mui/icons-material/Add'
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
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import {
  useCampusesForInstitution,
  useGroupsForFilters,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicYear,
  Campus,
  Group,
  SchoolRecord,
  Student,
} from '@/types/schemas'

const schema = z.object({
  student: z.string().uuid(),
  group: z.string().uuid(),
  academic_year: z.string().uuid(),
  institution: z.string().uuid(),
  campus: z.string().uuid(),
})

type FormValues = z.infer<typeof schema>

export function SchoolRecordsPage() {
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')
  const [compSearchInput, setCompSearchInput] = useState('')
  const [compAppliedSearch, setCompAppliedSearch] = useState('')
  const [compStudentId, setCompStudentId] = useState('')
  const [compYearId, setCompYearId] = useState('')
  const [compRequest, setCompRequest] = useState<{
    student: string
    year: string
  } | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: campuses = [] } = useCampusesForInstitution(
    selectedInstitutionId,
  )

  const listParams = {
    academic_year: filterYearId ?? undefined,
    institution: selectedInstitutionId ?? undefined,
    search: appliedSearch || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.schoolRecords(listParams),
    queryFn: async () => {
      const { data } = await apiClient.get<SchoolRecord[]>(
        '/api/school-records/',
        { params: listParams },
      )
      return data
    },
    enabled: !!selectedInstitutionId,
  })

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)
  const { data: compStudentOptions = [] } = useStudentsSearch(compAppliedSearch)

  const {
    data: compositeRecord,
    isFetching: compositeLoading,
    error: compositeError,
    isError: compositeIsError,
  } = useQuery({
    queryKey: compRequest
      ? queryKeys.schoolRecordComposite(compRequest.student, compRequest.year)
      : ['school-records', 'composite', 'idle'],
    queryFn: async () => {
      if (!compRequest) throw new Error('missing')
      const { data } = await apiClient.get<SchoolRecord>(
        `/api/school-records/${compRequest.student}/${compRequest.year}/`,
      )
      return data
    },
    enabled: !!compRequest,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      student: '',
      group: '',
      academic_year: '',
      institution: '',
      campus: '',
    },
  })

  const dialogYearId = useWatch({
    control: form.control,
    name: 'academic_year',
  })

  const { data: groupsForDialog = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: dialogYearId || null },
    undefined,
    { enabled: dialogOpen && !!dialogYearId },
  )

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<SchoolRecord>('/api/school-records/', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['school-records'] })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  function openCreate() {
    if (!selectedInstitutionId) return
    setFormError(null)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    form.reset({
      student: '',
      group: '',
      academic_year: academicYears[0]?.id ?? '',
      institution: selectedInstitutionId,
      campus: campuses[0]?.id ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setFormError(null)
  }

  const pending = createMutation.isPending || form.formState.isSubmitting

  const yearLabel = (y: AcademicYear) => String(y.year)

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title="Libro final de calificaciones"
          subtitle="Documentos generados por estudiante y año. Solo creación vía API (sin edición)."
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={
            !selectedInstitutionId ||
            academicYears.length === 0 ||
            campuses.length === 0
          }
        >
          Generar registro
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          Selecciona una institución para listar y generar registros.
        </Alert>
      ) : null}

      <Paper className="p-4 flex flex-col gap-3">
        <Box>
          <Typography variant="subtitle1" className="font-medium">
            Consulta o generación por estudiante y año
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Usa el endpoint{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">
              GET /api/school-records/&lt;student_id&gt;/&lt;academic_year_id&gt;/
            </code>
            : obtiene el registro existente o lo genera si hay matrícula activa en
            ese año.
          </Typography>
        </Box>
        <Box className="flex flex-wrap gap-2 items-end">
          <TextField
            size="small"
            label="Buscar estudiante"
            value={compSearchInput}
            onChange={(e) => setCompSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setCompAppliedSearch(compSearchInput)
              }
            }}
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => setCompAppliedSearch(compSearchInput)}
          >
            Buscar
          </Button>
          <Autocomplete
            sx={{ minWidth: 260, flex: 1 }}
            options={compStudentOptions}
            getOptionLabel={(o: Student) => o.full_name}
            value={
              compStudentOptions.find((s) => s.id === compStudentId) ?? null
            }
            onChange={(_, v) => setCompStudentId(v?.id ?? '')}
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Estudiante" size="small" />
            )}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Año lectivo</InputLabel>
            <Select
              label="Año lectivo"
              value={compYearId}
              onChange={(e) => setCompYearId(e.target.value)}
            >
              <MenuItem value="">
                <em>Selecciona</em>
              </MenuItem>
              {academicYears.map((y) => (
                <MenuItem key={y.id} value={y.id}>
                  {yearLabel(y)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={!compStudentId || !compYearId || compositeLoading}
            onClick={() => {
              if (compStudentId && compYearId) {
                setCompRequest({ student: compStudentId, year: compYearId })
              }
            }}
          >
            {compositeLoading ? 'Consultando…' : 'Consultar'}
          </Button>
        </Box>
        {compositeIsError ? (
          <Alert severity="error">
            {getErrorMessage(compositeError)}
          </Alert>
        ) : null}
        {compositeRecord && !compositeLoading ? (
          <Alert severity="success" className="[&_.MuiAlert-message]:w-full">
            <Typography variant="body2" className="font-medium mb-1">
              Registro obtenido
            </Typography>
            <Typography variant="body2">
              Estudiante: {compositeRecord.student_name} · Grupo:{' '}
              {compositeRecord.group_name} · Sede: {compositeRecord.campus_name}
            </Typography>
            <Typography variant="body2">
              Generado:{' '}
              {compositeRecord.generated_at
                ? new Date(compositeRecord.generated_at).toLocaleString()
                : '—'}
            </Typography>
          </Alert>
        ) : null}
      </Paper>

      <Paper className="p-3 flex flex-wrap gap-2 items-end">
        <TextField
          size="small"
          label="Buscar"
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
          Buscar
        </Button>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Año</InputLabel>
          <Select
            label="Año"
            value={filterYearId ?? ''}
            onChange={(e) =>
              setFilterYearId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">(todos)</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {error ? (
        <Alert severity="error">{getErrorMessage(error)}</Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Estudiante</TableCell>
              <TableCell>Grupo</TableCell>
              <TableCell>Sede</TableCell>
              <TableCell>Generado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>Sin registros.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.student_name}</TableCell>
                  <TableCell>{row.group_name}</TableCell>
                  <TableCell>{row.campus_name}</TableCell>
                  <TableCell>
                    {row.generated_at
                      ? new Date(row.generated_at).toLocaleString()
                      : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Generar libro final</DialogTitle>
        <form
          onSubmit={form.handleSubmit((v) => {
            setFormError(null)
            createMutation.mutate({
              ...v,
              generated_at: new Date().toISOString(),
            })
          })}
        >
          <DialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Box className="flex gap-2 items-end">
              <TextField
                size="small"
                label="Buscar estudiante"
                fullWidth
                value={studentSearchInput}
                onChange={(e) => setStudentSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setAppliedStudentSearch(studentSearchInput)
                  }
                }}
              />
              <Button
                variant="outlined"
                onClick={() => setAppliedStudentSearch(studentSearchInput)}
              >
                Buscar
              </Button>
            </Box>
            <Controller
              name="student"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={studentOptions}
                  getOptionLabel={(o: Student) => o.full_name}
                  value={
                    studentOptions.find((s) => s.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Estudiante"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <Controller
              name="academic_year"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>Año lectivo</InputLabel>
                  <Select
                    label="Año lectivo"
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      form.setValue('group', '')
                    }}
                  >
                    {academicYears.map((y) => (
                      <MenuItem key={y.id} value={y.id}>
                        {yearLabel(y)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="group"
              control={form.control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={groupsForDialog}
                  getOptionLabel={(g: Group) => g.name}
                  value={
                    groupsForDialog.find((g) => g.id === field.value) ?? null
                  }
                  onChange={(_, v) => field.onChange(v?.id ?? '')}
                  disabled={!dialogYearId}
                  renderInput={(params: AutocompleteRenderInputParams) => (
                    <TextField
                      {...params}
                      label="Grupo"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      required
                    />
                  )}
                />
              )}
            />
            <input type="hidden" {...form.register('institution')} />
            <Controller
              name="campus"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>Sede</InputLabel>
                  <Select
                    label="Sede"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {campuses.map((c: Campus) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={pending}>
              Generar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
