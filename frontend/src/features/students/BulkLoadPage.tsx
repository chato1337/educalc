import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import {
  Alert,
  Box,
  Button,
  Paper,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { PageHeader } from '@/components/PageHeader'

export type BulkLoadStats = {
  institutions_created?: number
  campuses_created?: number
  academic_years_created?: number
  grade_levels_created?: number
  groups_created?: number
  students_created?: number
  students_updated?: number
  enrollments_created?: number
  rows_processed?: number
  rows_skipped?: number
  errors?: { row: number; error: string }[]
}

export function BulkLoadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      const { data } = await apiClient.post<BulkLoadStats>(
        '/api/students/bulk-load/',
        body,
      )
      return data
    },
  })

  function onPickClick() {
    inputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setSelectedName(file?.name ?? null)
    if (file) mutation.mutate(file)
    e.target.value = ''
  }

  return (
    <Box className="p-4 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title="Carga masiva de estudiantes"
        subtitle="CSV según columnas documentadas en OpenAPI y docs/bulk_load_students.csv del repositorio."
      />
      <Typography variant="body2">
        <Link to="/students" className="text-blue-600 underline">
          ← Estudiantes
        </Link>
      </Typography>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden
        onChange={onFileChange}
      />

      <Paper className="p-4 flex flex-col gap-3">
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={onPickClick}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Subiendo…' : 'Elegir archivo CSV'}
        </Button>
        {selectedName ? (
          <Typography variant="caption" color="text.secondary">
            Último archivo: {selectedName}
          </Typography>
        ) : null}
      </Paper>

      {mutation.isError ? (
        <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>
      ) : null}

      {mutation.isSuccess && mutation.data ? (
        <Alert severity="success">
          Carga finalizada. Revisa el detalle abajo (conteos y errores por fila).
        </Alert>
      ) : null}

      {mutation.data ? (
        <Paper className="p-4 overflow-auto">
          <pre className="text-sm whitespace-pre-wrap break-words m-0">
            {JSON.stringify(mutation.data, null, 2)}
          </pre>
        </Paper>
      ) : null}
    </Box>
  )
}
