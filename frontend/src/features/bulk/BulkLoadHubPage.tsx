import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { postBulkLoadCsv, type BulkLoadApiPath } from '@/api/bulkLoad'
import { getErrorMessage } from '@/api/errors'
import { PageHeader } from '@/components/PageHeader'

import { BulkLoadResultSummary } from './BulkLoadResultSummary'
import { bulkLoadSections, bulkLoadTargets } from './bulkLoadTargets'

export function BulkLoadHubPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [targetId, setTargetId] = useState(
    () => bulkLoadTargets.find((t) => t.id === 'students')?.id ?? bulkLoadTargets[0]?.id ?? 'students',
  )
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const target = bulkLoadTargets.find((t) => t.id === targetId) ?? bulkLoadTargets[0]

  const mutation = useMutation({
    mutationFn: async ({ file, path }: { file: File; path: BulkLoadApiPath }) =>
      postBulkLoadCsv(path, file),
  })

  function onPickClick() {
    inputRef.current?.click()
  }

  function onTargetChange(e: SelectChangeEvent<string>) {
    setTargetId(e.target.value)
    mutation.reset()
    setSelectedName(null)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setSelectedName(file?.name ?? null)
    if (file && target) {
      mutation.mutate({ file, path: target.apiPath })
    }
    e.target.value = ''
  }

  return (
    <Box className="p-4 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title="Carga masiva CSV"
        subtitle="Operaciones POST multipart del OpenAPI (`file`). Elige módulo y tipo; las columnas coinciden con la descripción de cada endpoint en el schema."
      />
      <Typography variant="body2">
        <Link to="/dashboard" className="text-blue-600 underline">
          ← Inicio
        </Link>
        {' · '}
        <Link to="/students" className="text-blue-600 underline">
          Estudiantes
        </Link>
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel id="bulk-target-label">Módulo y tipo de carga</InputLabel>
        <Select
          labelId="bulk-target-label"
          label="Módulo y tipo de carga"
          value={targetId}
          onChange={onTargetChange}
          renderValue={(id) => {
            const t = bulkLoadTargets.find((x) => x.id === id)
            if (!t) return ''
            const sec = bulkLoadSections.find((s) => s.targets.some((x) => x.id === id))
            return sec ? `${sec.title}: ${t.label}` : t.label
          }}
          MenuProps={{
            autoFocus: false,
            slotProps: { paper: { sx: { maxHeight: 420 } } },
          }}
        >
          {bulkLoadSections.flatMap((section) => [
            <ListSubheader
              key={`h-${section.title}`}
              sx={{ lineHeight: '32px', fontWeight: 600 }}
            >
              {section.title}
            </ListSubheader>,
            ...section.targets.map((t) => (
              <MenuItem key={t.id} value={t.id} sx={{ pl: 3 }}>
                {t.label}
              </MenuItem>
            )),
          ])}
        </Select>
      </FormControl>

      {target ? (
        <Paper variant="outlined" className="p-3">
          <Typography variant="body2" color="text.secondary" component="div" className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>Endpoint:</strong> <code>{target.apiPath}</code>
              <Chip size="small" label={target.requestSchema} variant="outlined" />
            </div>
            <div>
              <strong>Contrato OpenAPI (columnas):</strong> {target.openApiDescription}
            </div>
            <div>
              <strong>Ejemplo en repo:</strong> <code>docs/{target.sampleFile}</code>
            </div>
            {target.hint ? <div>{target.hint}</div> : null}
          </Typography>
        </Paper>
      ) : null}

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
          disabled={mutation.isPending || !target}
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
          Carga finalizada. Revisa el resumen, los errores por fila (si los hay) y el JSON
          completo.
        </Alert>
      ) : null}

      {mutation.data ? <BulkLoadResultSummary data={mutation.data} /> : null}
    </Box>
  )
}
