import { MenuItem, TextField, type TextFieldProps } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { UseFormRegisterReturn } from 'react-hook-form'

import { BULK_STUDENT_DOCUMENT_TYPE_OPTIONS } from '@/constants/documentTypes'

type Props = {
  registerProps: UseFormRegisterReturn<'document_type'>
  /** Valor actual (p. ej. watch) para mostrar opción si no está en el catálogo CSV */
  currentValue?: string
} & Pick<TextFieldProps, 'error' | 'helperText' | 'required' | 'disabled' | 'size'>

export function DocumentTypeSelect({
  registerProps,
  currentValue = '',
  error,
  helperText,
  required,
  disabled,
  size,
}: Props) {
  const { t } = useTranslation()
  const legacy =
    currentValue.trim() &&
    !BULK_STUDENT_DOCUMENT_TYPE_OPTIONS.some((o) => o.value === currentValue)
      ? currentValue
      : null

  return (
    <TextField
      select
      label={t('documentTypeSelect.label')}
      fullWidth
      error={error}
      helperText={helperText}
      required={required}
      disabled={disabled}
      size={size}
      slotProps={{ select: { displayEmpty: true } }}
      {...registerProps}
    >
      <MenuItem value="">
        <em>{t('documentTypeSelect.unspecified')}</em>
      </MenuItem>
      {legacy ? (
        <MenuItem value={legacy}>{legacy}</MenuItem>
      ) : null}
      {BULK_STUDENT_DOCUMENT_TYPE_OPTIONS.map(({ value, label }) => (
        <MenuItem key={value} value={value}>
          {label}
        </MenuItem>
      ))}
    </TextField>
  )
}
