import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import type { Student } from '@/types/schemas'

export function StudentsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const params = useMemo(() => {
    return appliedSearch.trim() ? { search: appliedSearch.trim() } : undefined
  }, [appliedSearch])

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.students(appliedSearch),
    queryFn: async () => {
      const { data } = await apiClient.get<Student[]>('/api/students/', {
        params,
      })
      return data
    },
  })

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title="Estudiantes"
          subtitle={
            <>
              Detalle en{' '}
              <Link
                to="/students/bulk-load"
                className="text-blue-600 underline"
              >
                Carga masiva CSV
              </Link>
              .
            </>
          }
        />
        <Button
          variant="contained"
          component={Link}
          to="/students/new"
          startIcon={<AddIcon />}
        >
          Nuevo estudiante
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-center">
        <TextField
          size="small"
          label="Buscar"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setAppliedSearch(searchInput)
          }}
          slotProps={{
            input: { 'aria-label': 'Buscar estudiantes' },
          }}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={() => setAppliedSearch(searchInput)}
        >
          Aplicar
        </Button>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Tipo doc.</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Cargando…</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>Sin registros.</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.full_name}</TableCell>
                <TableCell>{row.document_number}</TableCell>
                <TableCell>{row.document_type}</TableCell>
                <TableCell>
                  <Link
                    to={`/students/${row.id}`}
                    className="text-blue-600 underline"
                  >
                    Ver
                  </Link>
                  {' · '}
                  <Link
                    to={`/students/${row.id}/grades-summary`}
                    className="text-blue-600 underline"
                  >
                    Resumen calificaciones
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
