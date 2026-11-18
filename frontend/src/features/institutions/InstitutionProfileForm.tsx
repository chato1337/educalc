import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'

import {
  updateInstitution,
  type Institution,
  type InstitutionProfileInput,
} from './bulletinLogosApi'

const profileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  dane_code: z.string().trim().min(1).max(20),
  legal_reference: z.string().max(255),
  nit: z.string().max(20),
  certificate_subtitle: z.string().max(255),
  certificate_authorization: z.string(),
  rector_name: z.string().max(255),
  rector_document_number: z.string().max(40),
  secretary_name: z.string().max(255),
  secretary_document_number: z.string().max(40),
})

type ProfileForm = z.infer<typeof profileSchema>

function valuesFrom(institution: Institution): ProfileForm {
  return {
    name: institution.name ?? '',
    dane_code: institution.dane_code ?? '',
    legal_reference: institution.legal_reference ?? '',
    nit: institution.nit ?? '',
    certificate_subtitle: institution.certificate_subtitle ?? '',
    certificate_authorization: institution.certificate_authorization ?? '',
    rector_name: institution.rector_name ?? '',
    rector_document_number: institution.rector_document_number ?? '',
    secretary_name: institution.secretary_name ?? '',
    secretary_document_number: institution.secretary_document_number ?? '',
  }
}

type InstitutionProfileFormProps = {
  institution: Institution
  onSaved: (institution: Institution) => void
}

export function InstitutionProfileForm({
  institution,
  onSaved,
}: InstitutionProfileFormProps) {
  const { t } = useTranslation()
  const loadedId = useRef<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: valuesFrom(institution),
  })

  useEffect(() => {
    if (loadedId.current === institution.id) return
    loadedId.current = institution.id
    form.reset(valuesFrom(institution))
    setFormError(null)
    setSaved(false)
  }, [institution, form])

  const save = useMutation({
    mutationFn: (body: InstitutionProfileInput) =>
      updateInstitution(institution.id, body),
    onSuccess: (updated) => {
      form.reset(valuesFrom(updated))
      setFormError(null)
      setSaved(true)
      onSaved(updated)
    },
    onError: (error) => {
      setSaved(false)
      setFormError(getErrorMessage(error, t('bulletinLogos.profileFailed')))
    },
  })

  function onSubmit(values: ProfileForm) {
    setSaved(false)
    setFormError(null)
    save.mutate({
      name: values.name,
      dane_code: values.dane_code,
      legal_reference: values.legal_reference,
      nit: values.nit,
      certificate_subtitle: values.certificate_subtitle,
      certificate_authorization: values.certificate_authorization,
      rector_name: values.rector_name,
      rector_document_number: values.rector_document_number,
      secretary_name: values.secretary_name,
      secretary_document_number: values.secretary_document_number,
    })
  }

  const pending = save.isPending || form.formState.isSubmitting

  return (
    <Paper variant="outlined" className="p-4">
      <Typography variant="subtitle1" component="h2">
        {t('bulletinLogos.profileTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" className="mb-3">
        {t('bulletinLogos.profileHelp')}
      </Typography>
      <Box
        component="form"
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {formError ? <Alert severity="error">{formError}</Alert> : null}
        {saved ? (
          <Alert severity="success">{t('bulletinLogos.profileSaved')}</Alert>
        ) : null}
        <Box className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label={t('institutions.name')}
            {...form.register('name')}
            error={!!form.formState.errors.name}
            helperText={form.formState.errors.name?.message}
            fullWidth
            required
          />
          <TextField
            label={t('institutions.daneCode')}
            {...form.register('dane_code')}
            error={!!form.formState.errors.dane_code}
            helperText={form.formState.errors.dane_code?.message}
            fullWidth
            required
          />
          <TextField
            label={t('institutions.legalReference')}
            {...form.register('legal_reference')}
            helperText={t('bulletinLogos.legalHelp')}
            fullWidth
          />
          <TextField
            label={t('institutions.nit')}
            {...form.register('nit')}
            error={!!form.formState.errors.nit}
            helperText={form.formState.errors.nit?.message}
            fullWidth
          />
        </Box>
        <TextField
          label={t('institutions.certificateSubtitle')}
          {...form.register('certificate_subtitle')}
          helperText={t('bulletinLogos.subtitleHelp')}
          fullWidth
        />
        <TextField
          label={t('institutions.certificateAuthorization')}
          {...form.register('certificate_authorization')}
          helperText={t('bulletinLogos.authorizationHelp')}
          fullWidth
          multiline
          minRows={4}
        />
        <Typography variant="body2" color="text.secondary">
          {t('bulletinLogos.signatoryHelp')}
        </Typography>
        <Box className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label={t('institutions.rectorName')}
            {...form.register('rector_name')}
            fullWidth
          />
          <TextField
            label={t('institutions.rectorDocument')}
            {...form.register('rector_document_number')}
            fullWidth
          />
          <TextField
            label={t('institutions.secretaryName')}
            {...form.register('secretary_name')}
            fullWidth
          />
          <TextField
            label={t('institutions.secretaryDocument')}
            {...form.register('secretary_document_number')}
            fullWidth
          />
        </Box>
        <Box>
          <Button type="submit" variant="contained" disabled={pending || !form.formState.isDirty}>
            {pending ? t('bulletinLogos.saving') : t('bulletinLogos.save')}
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
