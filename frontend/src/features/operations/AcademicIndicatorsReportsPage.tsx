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
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import {
  useAcademicPeriodsForYear,
  useGradeDirectorsList,
  useGroupsForFilters,
  useStudentsSearch,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type {
  AcademicIndicatorsReport,
  AcademicPeriod,
  AcademicYear,
  GradeDirector,
  Group,
  Student,
} from '@/types/schemas'

const schema = z.object({
  academic_year: z.string().uuid(),
  student: z.string().uuid(),
  group: z.string().uuid(),
  academic_period: z.string().uuid(),
  grade_director: z.string().uuid(),
  general_observations: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function AcademicIndicatorsReportsPage() {
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterYearId, setFilterYearId] = useState<string | null>(null)
  const [filterPeriodId, setFilterPeriodId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')
  const [compSearchInput, setCompSearchInput] = useState('')
  const [compAppliedSearch, setCompAppliedSearch] = useState('')
  const [compStudentId, setCompStudentId] = useState('')
  const [compYearId, setCompYearId] = useState('')
  const [compPeriodId, setCompPeriodId] = useState('')
  const [compRequest, setCompRequest] = useState<{
    student: string
    period: string
  } | null>(null)

  const { data: academicYears = [] } = useAcademicYearsQuery(
    selectedInstitutionId,
  )
  const { data: periodsForFilter = [] } = useAcademicPeriodsForYear(
    filterYearId,
  )
  const { data: compPeriods = [] } = useAcademicPeriodsForYear(
    compYearId || null,
  )

  const listParams = {
    academic_period: filterPeriodId ?? undefined,
    search: appliedSearch || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.academicIndicatorsReports(listParams),
    queryFn: async () => {
      const { data } = await apiClient.get<AcademicIndicatorsReport[]>(
        '/api/academic-indicators-reports/',
        { params: listParams },
      )
      return data
    },
  })

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)
  const { data: compStudentOptions = [] } = useStudentsSearch(compAppliedSearch)

  const {
    data: compositeReport,
    isFetching: compositeLoading,
    error: compositeError,
    isError: compositeIsError,
  } = useQuery({
    queryKey: compRequest
      ? queryKeys.academicIndicatorsReportComposite(
          compRequest.student,
          compRequest.period,
        )
      : ['academic-indicators-reports', 'composite', 'idle'],
    queryFn: async () => {
      if (!compRequest) throw new Error('missing')
      const { data } = await apiClient.get<AcademicIndicatorsReport>(
        `/api/academic-indicators-reports/${compRequest.student}/${compRequest.period}/`,
      )
      return data
    },
    enabled: !!compRequest,
  })

  useEffect(() => {
    if (compositeReport && compRequest) {
      void queryClient.invalidateQueries({
        queryKey: ['academic-indicators-reports'],
      })
    }
  }, [compositeReport, compRequest, queryClient])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      academic_year: '',
      student: '',
      group: '',
      academic_period: '',
      grade_director: '',
      general_observations: '',
    },
  })

  const dialogYearId = useWatch({
    control: form.control,
    name: 'academic_year',
  })

  const dialogGroupId = useWatch({
    control: form.control,
    name: 'group',
  })

  const { data: groupsForDialog = [] } = useGroupsForFilters(
    selectedInstitutionId,
    { academic_year: dialogYearId || null },
    undefined,
    { enabled: dialogOpen && !!dialogYearId },
  )

  const { data: periodsForDialog = [] } = useAcademicPeriodsForYear(
    dialogOpen ? dialogYearId || null : null,
  )

  const { data: directorsForDialog = [] } = useGradeDirectorsList(
    {
      academic_year: dialogYearId ?? undefined,
      group: dialogGroupId ?? undefined,
    },
    { enabled: dialogOpen && !!dialogYearId && !!dialogGroupId },
  )

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<AcademicIndicatorsReport>(
        '/api/academic-indicators-reports/',
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['academic-indicators-reports'],
      })
      closeDialog()
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  function openCreate() {
    setFormError(null)
    setStudentSearchInput('')
    setAppliedStudentSearch('')
    form.reset({
      academic_year: academicYears[0]?.id ?? '',
      student: '',
      group: '',
      academic_period: '',
      grade_director: '',
      general_observations: '',
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
          title="Informes de indicadores"
          subtitle="Documentos por estudiante y período. Coordinador de grado y observaciones."
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={academicYears.length === 0}
        >
          Generar informe
        </Button>
      </Box>

      {!selectedInstitutionId ? (
        <Alert severity="info">
          Selecciona una institución para años lectivos en el formulario.
        </Alert>
      ) : null}

      <Paper className="p-4 flex flex-col gap-3">
        <Box>
          <Typography variant="subtitle1" className="font-medium">
            Consulta o generación por estudiante y período
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Usa{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">
              GET /api/academic-indicators-reports/&lt;student_id&gt;/&lt;period_id&gt;/
            </code>
            : requiere matrícula y coordinador de grado del grupo del estudiante.
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
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Año (períodos)</InputLabel>
            <Select
              label="Año (períodos)"
              value={compYearId}
              onChange={(e) => {
                const v = e.target.value
                setCompYearId(v)
                setCompPeriodId('')
              }}
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
          <FormControl
            size="small"
            sx={{ minWidth: 180 }}
            disabled={!compYearId}
          >
            <InputLabel>Período</InputLabel>
            <Select
              label="Período"
              value={compPeriodId}
              onChange={(e) => setCompPeriodId(e.target.value)}
            >
              <MenuItem value="">
                <em>Selecciona</em>
              </MenuItem>
              {compPeriods.map((p: AcademicPeriod) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={
              !compStudentId || !compPeriodId || compositeLoading
            }
            onClick={() => {
              if (compStudentId && compPeriodId) {
                setCompRequest({
                  student: compStudentId,
                  period: compPeriodId,
                })
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
        {compositeReport && !compositeLoading ? (
          <Alert severity="success" className="[&_.MuiAlert-message]:w-full">
            <Typography variant="body2" className="font-medium mb-1">
              Informe obtenido
            </Typography>
            <Typography variant="body2">
              Estudiante: {compositeReport.student_name} · Grupo:{' '}
              {compositeReport.group_name} · Coordinador:{' '}
              {compositeReport.grade_director_name}
            </Typography>
            {compositeReport.general_observations ? (
              <Typography variant="body2" className="mt-1">
                Observaciones: {compositeReport.general_observations}
              </Typography>
            ) : null}
            <Typography variant="body2">
              Generado:{' '}
              {compositeReport.generated_at
                ? new Date(compositeReport.generated_at).toLocaleString()
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
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Año</InputLabel>
          <Select
            label="Año"
            value={filterYearId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : e.target.value
              setFilterYearId(v)
              setFilterPeriodId(null)
            }}
          >
            <MenuItem value="">(todos)</MenuItem>
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {yearLabel(y)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!filterYearId}>
          <InputLabel>Período</InputLabel>
          <Select
            label="Período"
            value={filterPeriodId ?? ''}
            onChange={(e) =>
              setFilterPeriodId(e.target.value === '' ? null : e.target.value)
            }
          >
            <MenuItem value="">(todos)</MenuItem>
            {periodsForFilter.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
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
              <TableCell>Coordinador</TableCell>
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
                  <TableCell>{row.grade_director_name}</TableCell>
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
        <DialogTitle>Generar informe de indicadores</DialogTitle>
        <form
          onSubmit={form.handleSubmit((v) => {
            setFormError(null)
            const body: Record<string, unknown> = {
              student: v.student,
              group: v.group,
              academic_period: v.academic_period,
              grade_director: v.grade_director,
              generated_at: new Date().toISOString(),
            }
            if (v.general_observations?.trim()) {
              body.general_observations = v.general_observations
            }
            createMutation.mutate(body)
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
                    value={field.value ?? ''}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      form.setValue('group', '')
                      form.setValue('academic_period', '')
                      form.setValue('grade_director', '')
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
                  onChange={(_, v) => {
                    field.onChange(v?.id ?? '')
                    form.setValue('grade_director', '')
                  }}
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
            <Controller
              name="academic_period"
              control={form.control}
              render={({ field }) => (
                <FormControl fullWidth required disabled={!dialogYearId}>
                  <InputLabel>Período</InputLabel>
                  <Select
                    label="Período"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {periodsForDialog.map((p: AcademicPeriod) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="grade_director"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl
                  fullWidth
                  required
                  error={!!fieldState.error}
                  disabled={directorsForDialog.length === 0}
                >
                  <InputLabel>Coordinador de grado</InputLabel>
                  <Select
                    label="Coordinador de grado"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {directorsForDialog.map((d: GradeDirector) => (
                      <MenuItem key={d.id} value={d.teacher}>
                        {d.teacher_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              label="Observaciones generales"
              fullWidth
              multiline
              minRows={3}
              {...form.register('general_observations')}
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
