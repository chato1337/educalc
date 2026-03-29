import type { BulkLoadApiPath } from '@/api/bulkLoad'

/** Targets: multipart campo `file`, UTF-8 CSV. Plantillas en `docs/bulk_load_*.csv`. */
export type BulkLoadTarget = {
  id: string
  label: string
  /** Path alineado con `paths` en openapi.d.ts */
  apiPath: BulkLoadApiPath
  sampleFile: string
  /** Texto UI adicional (negocio). */
  hint?: string
  /** Descripción de columnas según OpenAPI (schema.json). */
  openApiDescription: string
  /** Estudiantes usa `BulkLoadStudentsCsvRequest`; el resto `BulkLoadCsvUploadRequest`. */
  requestSchema: 'BulkLoadCsvUploadRequest' | 'BulkLoadStudentsCsvRequest'
}

export type BulkLoadSection = {
  title: string
  targets: BulkLoadTarget[]
}

export const bulkLoadSections: BulkLoadSection[] = [
  {
    title: 'Estructura académica',
    targets: [
      {
        id: 'academic_areas',
        label: 'Áreas académicas',
        apiPath: '/api/academic-areas/bulk-load/',
        sampleFile: 'bulk_load_academic_areas.csv',
        openApiDescription:
          'Columns: DANE_COD, AREA_NOMBRE, AREA_COD, DESCRIPCION. See docs/plan-implementacion-carga-masiva-csv.md',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'grading_scales',
        label: 'Escalas de valoración',
        apiPath: '/api/grading-scales/bulk-load/',
        sampleFile: 'bulk_load_grading_scales.csv',
        openApiDescription:
          'Columns: DANE_COD, COD_NIVEL, NOMBRE_NIVEL, NOTA_MIN, NOTA_MAX, DESCRIPCION.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'academic_periods',
        label: 'Períodos académicos',
        apiPath: '/api/academic-periods/bulk-load/',
        sampleFile: 'bulk_load_academic_periods.csv',
        openApiDescription:
          'Columns: DANE_COD, ANO, PERIODO_NUM, PERIODO_NOMBRE, FECHA_INI, FECHA_FIN.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'subjects',
        label: 'Asignaturas',
        apiPath: '/api/subjects/bulk-load/',
        sampleFile: 'bulk_load_subjects.csv',
        openApiDescription:
          'Columns: DANE_COD, AREA_NOMBRE, ASIGNATURA_NOMBRE, ENFASIS, HORAS.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    title: 'Personas',
    targets: [
      {
        id: 'students',
        label: 'Estudiantes (matrícula, grupos)',
        apiPath: '/api/students/bulk-load/',
        sampleFile: 'bulk_load_students.csv',
        hint: 'Crea/actualiza estudiantes, matrículas e infraestructura (institución, sede, año, grado, grupo).',
        openApiDescription:
          'Upload a CSV file to create/update students, enrollments, institutions, campuses, academic years, grade levels, and groups. CSV format: ANO, INSTITUCION, SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO, BARRIO, EPS, TIPO DE SANGRE, DISCAPACIDAD, TELEFONO. Use multipart/form-data with field \'file\'.',
        requestSchema: 'BulkLoadStudentsCsvRequest',
      },
      {
        id: 'teachers',
        label: 'Docentes',
        apiPath: '/api/teachers/bulk-load/',
        sampleFile: 'bulk_load_teachers.csv',
        openApiDescription:
          'Columns: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, ESPECIALIDAD.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'parents',
        label: 'Acudientes',
        apiPath: '/api/parents/bulk-load/',
        sampleFile: 'bulk_load_parents.csv',
        hint: 'Si EMAIL está vacío, el backend asigna un correo sintético.',
        openApiDescription:
          'Columns: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, PARENTESCO. Empty EMAIL uses a synthetic address.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'student_guardians',
        label: 'Vínculo estudiante–acudiente',
        apiPath: '/api/student-guardians/bulk-load/',
        sampleFile: 'bulk_load_student_guardians.csv',
        openApiDescription: 'Columns: DOC_ESTUDIANTE, DOC_ACUDIENTE, ES_PRIMARIO.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'grade_directors',
        label: 'Directores de grupo',
        apiPath: '/api/grade-directors/bulk-load/',
        sampleFile: 'bulk_load_grade_directors.csv',
        openApiDescription:
          'Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, DOC_DOCENTE.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    title: 'Matrícula y cursos',
    targets: [
      {
        id: 'course_assignments',
        label: 'Asignación docente–curso',
        apiPath: '/api/course-assignments/bulk-load/',
        sampleFile: 'bulk_load_course_assignments.csv',
        openApiDescription:
          'Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (optional), DOC_DOCENTE.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    title: 'Evaluación',
    targets: [
      {
        id: 'grades',
        label: 'Calificaciones (notas)',
        apiPath: '/api/grades/bulk-load/',
        sampleFile: 'bulk_load_grades.csv',
        hint: 'Requiere CourseAssignment y período ya cargados.',
        openApiDescription:
          'Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (optional), PERIODO_NUM, NOTA, COD_NIVEL (optional), NOTA_DEFINITIVA (optional). Requires existing CourseAssignment.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'academic_indicators',
        label: 'Indicadores académicos',
        apiPath: '/api/academic-indicators/bulk-load/',
        sampleFile: 'bulk_load_academic_indicators.csv',
        hint: 'Cada fila crea un registro (no sustituye anteriores).',
        openApiDescription:
          'Context columns as grades; DESCRIPCION, NOTA (optional), NIVEL_DESEMPENO_TEXTO (optional). Appends rows.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'performance_summaries',
        label: 'Resúmenes de desempeño',
        apiPath: '/api/performance-summaries/bulk-load/',
        sampleFile: 'bulk_load_performance_summaries.csv',
        openApiDescription:
          'Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, PERIODO_NUM, PROMEDIO_PERIODO, PUESTO, PROMEDIO_DEFINITIVO.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    title: 'Convivencia y asistencia',
    targets: [
      {
        id: 'attendance',
        label: 'Asistencia',
        apiPath: '/api/attendances/bulk-load/',
        sampleFile: 'bulk_load_attendance.csv',
        openApiDescription:
          'Same context columns as grades plus INASISTENCIAS_SIN_JUSTIFICAR, INASISTENCIAS_JUSTIFICADAS.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'disciplinary',
        label: 'Reportes disciplinarios',
        apiPath: '/api/disciplinary-reports/bulk-load/',
        sampleFile: 'bulk_load_disciplinary_reports.csv',
        openApiDescription:
          'Columns: DOC_ESTUDIANTE, DANE_COD, ANO, PERIODO_NUM, TEXTO, DOC_DOCENTE_CREADOR (optional).',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
]

export const bulkLoadTargets: BulkLoadTarget[] = bulkLoadSections.flatMap(
  (s) => s.targets,
)
