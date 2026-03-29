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
