/**
 * Tipo de documento según columna TIPODOC de docs/bulk_load_students.csv.
 * PPT en el CSV puede verse con error de codificación ("PROTECCIÃ¿N"); aquí se usa "PROTECCIÓN".
 */
export const BULK_STUDENT_DOCUMENT_TYPE_OPTIONS: readonly {
  value: string
  label: string
}[] = [
  { value: 'CC:CÉDULA DE CIUDADANÍA', label: 'CC:CÉDULA DE CIUDADANÍA' },
  {
    value: 'PPT: PERMISO DE PROTECCIÓN TEMPORAL',
    label: 'PPT: PERMISO DE PROTECCIÓN TEMPORAL',
  },
  {
    value: 'RC:REGISTRO CIVIL DE NACIMIENTO',
    label: 'RC:REGISTRO CIVIL DE NACIMIENTO',
  },
  { value: 'TI:TARJETA DE IDENTIDAD', label: 'TI:TARJETA DE IDENTIDAD' },
] as const

/** Maps stored short codes (CC, TI, …) to the catalog value used by the select. */
export function resolveDocumentTypeSelectValue(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  if (BULK_STUDENT_DOCUMENT_TYPE_OPTIONS.some((o) => o.value === trimmed)) {
    return trimmed
  }
  const code = trimmed.split(':')[0].trim().toUpperCase()
  const match = BULK_STUDENT_DOCUMENT_TYPE_OPTIONS.find(
    (o) => o.value.split(':')[0].trim().toUpperCase() === code,
  )
  return match?.value ?? trimmed
}
