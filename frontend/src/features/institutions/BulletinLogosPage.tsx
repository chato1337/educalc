import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import { useUiStore } from '@/stores/uiStore'

import {
  fetchInstitution,
  isAcceptedBulletinLogo,
  uploadBulletinLogo,
  type BulletinLogoSlot,
  type Institution,
} from './bulletinLogosApi'

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/gif,image/webp'

type SlotCardProps = {
  slot: BulletinLogoSlot
  institutionId: string
  imageUrl: string
  onUploaded: (institution: Institution) => void
}

function LogoSlotCard({
  slot,
  institutionId,
  imageUrl,
  onUploaded,
}: SlotCardProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const upload = useMutation({
    mutationFn: (file: File) => uploadBulletinLogo(institutionId, slot, file),
    onSuccess: (institution) => {
      setLocalError(null)
      setSaved(true)
      onUploaded(institution)
      if (inputRef.current) inputRef.current.value = ''
    },
    onError: (err) => {
      setSaved(false)
      setLocalError(getErrorMessage(err, t('bulletinLogos.uploadFailed')))
    },
  })

  function onFile(file: File | undefined) {
    setSaved(false)
    if (!file) return
    if (!isAcceptedBulletinLogo(file)) {
      setLocalError(t('bulletinLogos.unsupportedType'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setLocalError(null)
    upload.mutate(file)
  }

  const title = t(
    slot === 'left' ? 'bulletinLogos.leftTitle' : 'bulletinLogos.rightTitle',
  )
  const help = t(
    slot === 'left' ? 'bulletinLogos.leftHelp' : 'bulletinLogos.rightHelp',
  )

  return (
    <Paper variant="outlined" className="p-4 flex flex-col gap-3">
      <Box>
        <Typography variant="subtitle1" component="h2">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {help}
        </Typography>
      </Box>
      <Box
        className="flex items-center justify-center rounded border border-dashed"
        sx={{ minHeight: 160, bgcolor: 'action.hover' }}
      >
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={title}
            sx={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Box className="flex flex-col items-center gap-1 px-3 text-center">
            <ImageOutlinedIcon color="disabled" />
            <Typography variant="body2" color="text.secondary">
              {t('bulletinLogos.empty')}
            </Typography>
          </Box>
        )}
      </Box>
      {localError ? <Alert severity="error">{localError}</Alert> : null}
      {saved ? <Alert severity="success">{t('bulletinLogos.saved')}</Alert> : null}
      <Button
        variant="contained"
        component="label"
        disabled={upload.isPending}
        startIcon={
          upload.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
        }
      >
        {upload.isPending
          ? t('bulletinLogos.uploading')
          : imageUrl
            ? t('bulletinLogos.replace')
            : t('bulletinLogos.upload')}
        <input
          ref={inputRef}
          hidden
          type="file"
          accept={ACCEPT}
          aria-label={title}
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </Button>
    </Paper>
  )
}

export function BulletinLogosPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const institutionId = useUiStore((s) => s.selectedInstitutionId)

  const institutionQuery = useQuery({
    queryKey: queryKeys.institution(institutionId ?? 'none'),
    queryFn: () => fetchInstitution(institutionId as string),
    enabled: Boolean(institutionId),
  })

  function onUploaded(institution: Institution) {
    if (!institutionId) return
    queryClient.setQueryData(queryKeys.institution(institutionId), institution)
    void queryClient.invalidateQueries({ queryKey: ['institutions'] })
  }

  return (
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('bulletinLogos.title')}
        subtitle={t('bulletinLogos.subtitle')}
      />
      {!institutionId ? (
        <Alert severity="info">{t('bulletinLogos.selectInstitution')}</Alert>
      ) : null}
      {institutionQuery.isError ? (
        <Alert severity="error">{getErrorMessage(institutionQuery.error)}</Alert>
      ) : null}
      {institutionId && institutionQuery.isLoading ? (
        <Box className="flex justify-center py-8">
          <CircularProgress />
        </Box>
      ) : null}
      {institutionQuery.data ? (
        <>
          <Typography variant="body2" color="text.secondary">
            {t('bulletinLogos.institutionLine', {
              name: institutionQuery.data.name,
            })}
          </Typography>
          <Box
            key={institutionQuery.data.id}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <LogoSlotCard
              slot="left"
              institutionId={institutionQuery.data.id}
              imageUrl={institutionQuery.data.bulletin_logo_left_url}
              onUploaded={onUploaded}
            />
            <LogoSlotCard
              slot="right"
              institutionId={institutionQuery.data.id}
              imageUrl={institutionQuery.data.bulletin_logo_right_url}
              onUploaded={onUploaded}
            />
          </Box>
        </>
      ) : null}
    </Box>
  )
}
