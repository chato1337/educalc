import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type { BulkLoadRowError, BulkLoadStats } from '@/api/bulkLoad'

function formatStatKey(key: string): string {
  return key.replace(/_/g, ' ')
}

function isRowError(x: unknown): x is BulkLoadRowError {
  return (
    typeof x === 'object' &&
    x !== null &&
    'row' in x &&
    'error' in x &&
    typeof (x as BulkLoadRowError).row === 'number' &&
    typeof (x as BulkLoadRowError).error === 'string'
  )
}

export function BulkLoadResultSummary({ data }: { data: BulkLoadStats }) {
  const rawErrors = data.errors
  const errors: BulkLoadRowError[] = Array.isArray(rawErrors)
    ? rawErrors.filter(isRowError)
    : []

  const statEntries = Object.entries(data).filter(([key, value]) => {
    if (key === 'errors') return false
    if (typeof value === 'number' && Number.isFinite(value)) return true
    if (typeof value === 'boolean') return true
    return false
  })

  return (
    <div className="flex flex-col gap-3">
      {statEntries.length > 0 ? (
        <Paper variant="outlined" className="p-3">
          <Typography variant="subtitle2" className="mb-2">
            Resumen (respuesta API)
          </Typography>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 m-0 text-sm">
            {statEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-gray-600 capitalize">{formatStatKey(key)}</dt>
                <dd className="m-0 font-medium tabular-nums">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Paper>
      ) : null}

      {errors.length > 0 ? (
        <Paper variant="outlined" className="p-0 overflow-hidden">
          <Typography variant="subtitle2" className="px-3 pt-3 pb-1">
            Errores por fila ({errors.length})
          </Typography>
          <TableContainer sx={{ maxHeight: 280 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Fila</TableCell>
                  <TableCell>Mensaje</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errors.slice(0, 100).map((e, i) => (
                  <TableRow key={`${e.row}-${i}`}>
                    <TableCell width={72}>{e.row}</TableCell>
                    <TableCell>{e.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {errors.length > 100 ? (
            <Typography variant="caption" color="text.secondary" className="px-3 pb-2 block">
              Mostrando 100 de {errors.length} errores. El JSON completo está abajo.
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      <Paper variant="outlined" className="p-4 overflow-auto">
        <Typography variant="caption" color="text.secondary" className="block mb-2">
          JSON completo
        </Typography>
        <pre className="text-sm whitespace-pre-wrap break-words m-0">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Paper>
    </div>
  )
}
