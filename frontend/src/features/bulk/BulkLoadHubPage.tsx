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
import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { postBulkLoadCsv, type BulkLoadApiPath } from '@/api/bulkLoad'
import { getErrorMessage } from '@/api/errors'
import { PageHeader } from '@/components/PageHeader'

import { BulkLoadResultSummary } from './BulkLoadResultSummary'
import { bulkLoadSections, bulkLoadTargets } from './bulkLoadTargets'

export function BulkLoadHubPage() {
  const { t } = useTranslation()
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
        title={t('bulkLoadHub.title')}
        subtitle={t('bulkLoadHub.subtitle')}
      />
      <Typography variant="body2">
        <Link to="/dashboard" className="text-blue-600 underline">
          {t('bulkLoadHub.backHome')}
        </Link>
        {' · '}
        <Link to="/students" className="text-blue-600 underline">
          {t('bulkLoadHub.students')}
        </Link>
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel id="bulk-target-label">{t('bulkLoadHub.moduleAndType')}</InputLabel>
        <Select
          labelId="bulk-target-label"
          label={t('bulkLoadHub.moduleAndType')}
          value={targetId}
          onChange={onTargetChange}
          renderValue={(id) => {
            const selectedTarget = bulkLoadTargets.find((x) => x.id === id)
            if (!selectedTarget) return ''
            const sec = bulkLoadSections.find((s) => s.targets.some((x) => x.id === id))
            return sec
              ? `${t(sec.titleKey)}: ${t(selectedTarget.labelKey)}`
              : t(selectedTarget.labelKey)
          }}
          MenuProps={{
            autoFocus: false,
            slotProps: { paper: { sx: { maxHeight: 420 } } },
          }}
        >
          {bulkLoadSections.flatMap((section) => [
            <ListSubheader
              key={`h-${section.titleKey}`}
              sx={{ lineHeight: '32px', fontWeight: 600 }}
            >
              {t(section.titleKey)}
            </ListSubheader>,
            ...section.targets.map((targetOption) => (
              <MenuItem key={targetOption.id} value={targetOption.id} sx={{ pl: 3 }}>
                {t(targetOption.labelKey)}
              </MenuItem>
            )),
          ])}
        </Select>
      </FormControl>

      {target ? (
        <Paper variant="outlined" className="p-3">
          <Typography variant="body2" color="text.secondary" component="div" className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{t('bulkLoadHub.endpoint')}:</strong> <code>{target.apiPath}</code>
              <Chip size="small" label={target.requestSchema} variant="outlined" />
              {target.openApiOperationId ? (
                <Chip
                  size="small"
                  label={t('bulkLoadHub.openApiOperationId', {
                    id: target.openApiOperationId,
                  })}
                  variant="outlined"
                />
              ) : null}
            </div>
            <div>
              <strong>{t('bulkLoadHub.openapiContract')}:</strong> {target.openApiDescription}
            </div>
            <div>
              <strong>{t('bulkLoadHub.sampleInRepo')}:</strong> <code>docs/{target.sampleFile}</code>
            </div>
            {target.hintKey ? <div>{t(target.hintKey)}</div> : null}
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
          {mutation.isPending ? t('bulkLoadHub.uploading') : t('bulkLoadHub.chooseCsv')}
        </Button>
        {selectedName ? (
          <Typography variant="caption" color="text.secondary">
            {t('bulkLoadHub.lastFile', { file: selectedName })}
          </Typography>
        ) : null}
      </Paper>

      {mutation.isError ? (
        <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>
      ) : null}

      {mutation.isSuccess && mutation.data ? (
        <Alert severity="success">
          {t('bulkLoadHub.success')}
        </Alert>
      ) : null}

      {mutation.data ? <BulkLoadResultSummary data={mutation.data} /> : null}
    </Box>
  )
}
