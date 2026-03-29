import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import type { Student } from '@/types/schemas'

const schema = z.object({
  document_type: z.string().max(80).optional(),
  document_number: z.string().max(20).optional(),
  first_name: z.string().trim().min(1).max(100),
  second_name: z.string().max(100).optional(),
  first_last_name: z.string().trim().min(1).max(100),
  second_last_name: z.string().max(100).optional(),
  full_name: z.string().trim().min(1).max(400),
  date_of_birth: z.string().optional(),
  gender: z.string().max(30).optional(),
  enrollment_date: z.string().optional(),
  stratum: z.string().max(50).optional(),
  sisben: z.string().max(20).optional(),
  neighborhood: z.string().max(150).optional(),
  health_insurer: z.string().max(150).optional(),
  blood_type: z.string().max(10).optional(),
  disability: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
})

type FormValues = z.infer<typeof schema>

const empty: FormValues = {
  document_type: '',
  document_number: '',
  first_name: '',
  second_name: '',
  first_last_name: '',
  second_last_name: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  enrollment_date: '',
  stratum: '',
  sisben: '',
  neighborhood: '',
  health_insurer: '',
  blood_type: '',
  disability: '',
  phone: '',
}

function toBody(v: FormValues) {
  return {
    document_type: v.document_type || undefined,
    document_number: v.document_number || undefined,
    first_name: v.first_name,
    second_name: v.second_name || undefined,
    first_last_name: v.first_last_name,
    second_last_name: v.second_last_name || undefined,
    full_name: v.full_name,
    date_of_birth: v.date_of_birth?.trim() || undefined,
    gender: v.gender || undefined,
    enrollment_date: v.enrollment_date?.trim() || undefined,
    stratum: v.stratum || undefined,
    sisben: v.sisben || undefined,
    neighborhood: v.neighborhood || undefined,
    health_insurer: v.health_insurer || undefined,
    blood_type: v.blood_type || undefined,
    disability: v.disability || undefined,
    phone: v.phone || undefined,
  }
}

function studentToForm(s: Student): FormValues {
  return {
    document_type: s.document_type ?? '',
    document_number: s.document_number ?? '',
    first_name: s.first_name,
    second_name: s.second_name ?? '',
    first_last_name: s.first_last_name,
    second_last_name: s.second_last_name ?? '',
    full_name: s.full_name,
    date_of_birth: s.date_of_birth?.slice(0, 10) ?? '',
    gender: s.gender ?? '',
    enrollment_date: s.enrollment_date?.slice(0, 10) ?? '',
    stratum: s.stratum ?? '',
    sisben: s.sisben ?? '',
    neighborhood: s.neighborhood ?? '',
    health_insurer: s.health_insurer ?? '',
    blood_type: s.blood_type ?? '',
    disability: s.disability ?? '',
    phone: s.phone ?? '',
  }
}

export function StudentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: existing, isLoading } = useQuery({
    queryKey: queryKeys.student(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<Student>(`/api/students/${id}/`)
      return data
    },
    enabled: isEdit,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: empty,
  })

  useEffect(() => {
    if (existing) {
      form.reset(studentToForm(existing))
    }
  }, [existing, form])

  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toBody>) =>
      apiClient.post<Student>('/api/students/', body),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      navigate(`/students/${response.data.id}`, { replace: true })
    },
    onError: (e) => setErrorMsg(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toBody>) =>
      apiClient.patch<Student>(`/api/students/${id}/`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.student(id!) })
      navigate(`/students/${id}`, { replace: true })
    },
    onError: (e) => setErrorMsg(getErrorMessage(e)),
  })

  function onSubmit(values: FormValues) {
    setErrorMsg(null)
    const body = toBody(values)
    if (isEdit) {
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Box className="p-4 md:p-6 max-w-2xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={isEdit ? 'Editar estudiante' : 'Nuevo estudiante'}
      />
      <Typography variant="body2">
        <Link to="/students" className="text-blue-600 underline">
          ← Volver al listado
        </Link>
        {isEdit && id ? (
          <>
            {' · '}
            <Link to={`/students/${id}`} className="text-blue-600 underline">
              Ver ficha
            </Link>
          </>
        ) : null}
      </Typography>

      {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}

      {isEdit && isLoading ? (
        <Typography>Cargando…</Typography>
      ) : (
        <Paper className="p-4">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-2"
          >
            <TextField
              label="Tipo documento"
              {...form.register('document_type')}
              fullWidth
            />
            <TextField
              label="Número documento"
              {...form.register('document_number')}
              fullWidth
            />
            <TextField
              label="Nombre"
              {...form.register('first_name')}
              required
              fullWidth
            />
            <TextField
              label="Segundo nombre"
              {...form.register('second_name')}
              fullWidth
            />
            <TextField
              label="Primer apellido"
              {...form.register('first_last_name')}
              required
              fullWidth
            />
            <TextField
              label="Segundo apellido"
              {...form.register('second_last_name')}
              fullWidth
            />
            <TextField
              label="Nombre completo"
              {...form.register('full_name')}
              required
              fullWidth
            />
            <TextField
              label="Fecha nacimiento"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('date_of_birth')}
              fullWidth
            />
            <TextField label="Género" {...form.register('gender')} fullWidth />
            <TextField
              label="Fecha matrícula"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.register('enrollment_date')}
              fullWidth
            />
            <TextField label="Estrato" {...form.register('stratum')} fullWidth />
            <TextField label="SISBEN" {...form.register('sisben')} fullWidth />
            <TextField
              label="Barrio"
              {...form.register('neighborhood')}
              fullWidth
            />
            <TextField label="EPS" {...form.register('health_insurer')} fullWidth />
            <TextField
              label="Tipo sangre"
              {...form.register('blood_type')}
              fullWidth
            />
            <TextField
              label="Discapacidad"
              {...form.register('disability')}
              fullWidth
            />
            <TextField label="Teléfono" {...form.register('phone')} fullWidth />
            <Box className="flex gap-2 pt-2">
              <Button
                type="submit"
                variant="contained"
                disabled={pending || (isEdit && isLoading)}
              >
                Guardar
              </Button>
              <Button
                type="button"
                component={Link}
                to={isEdit && id ? `/students/${id}` : '/students'}
              >
                Cancelar
              </Button>
            </Box>
          </form>
        </Paper>
      )}
    </Box>
  )
}
