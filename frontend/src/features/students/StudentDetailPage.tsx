import { Alert, Box, Paper, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import type { Student } from '@/types/schemas'

const fields: (keyof Student)[] = [
  'full_name',
  'document_type',
  'document_number',
  'first_name',
  'second_name',
  'first_last_name',
  'second_last_name',
  'date_of_birth',
  'gender',
  'enrollment_date',
  'stratum',
  'sisben',
  'neighborhood',
  'health_insurer',
  'blood_type',
  'disability',
  'phone',
  'created_at',
  'updated_at',
]

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.student(id ?? ''),
    queryFn: async () => {
      const { data: s } = await apiClient.get<Student>(`/api/students/${id}/`)
      return s
    },
    enabled: !!id,
  })

  if (!id) {
    return <Alert severity="warning">ID no válido.</Alert>
  }

  return (
    <Box className="p-4 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-4">
      <PageHeader title="Estudiante" />
      <Typography variant="body2">
        <Link to="/students" className="text-blue-600 underline">
          ← Volver al listado
        </Link>
        {' · '}
        <Link
          to={`/students/${id}/edit`}
          className="text-blue-600 underline"
        >
          Editar
        </Link>
        {' · '}
        <Link
          to={`/students/${id}/grades-summary`}
          className="text-blue-600 underline"
        >
          Resumen de calificaciones
        </Link>
      </Typography>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}
      {isLoading ? <Typography>Cargando…</Typography> : null}

      {data ? (
        <Paper className="p-4 flex flex-col gap-2">
          {fields.map((key) => (
            <Box key={key} className="flex flex-wrap gap-2 border-b border-gray-100 py-1">
              <Typography
                component="span"
                variant="body2"
                className="font-medium min-w-[160px]"
              >
                {key}
              </Typography>
              <Typography component="span" variant="body2" color="text.secondary">
                {formatVal(data[key])}
              </Typography>
            </Box>
          ))}
        </Paper>
      ) : null}
    </Box>
  )
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}
