import type { BulkLoadApiPath } from '@/api/bulkLoad'

/** Targets: multipart campo `file`, UTF-8 CSV. Plantillas en `docs/bulk_load_*.csv`. */
export type BulkLoadTarget = {
  id: string
  labelKey: string
  /** Path alineado con `paths` en openapi.d.ts */
  apiPath: BulkLoadApiPath
  sampleFile: string
  /** Texto UI adicional (negocio). */
  hintKey?: string
  /** Descripción de columnas según OpenAPI (schema.json). */
  openApiDescription: string
  /** Estudiantes usa `BulkLoadStudentsCsvRequest`; el resto `BulkLoadCsvUploadRequest`. */
  requestSchema: 'BulkLoadCsvUploadRequest' | 'BulkLoadStudentsCsvRequest'
}

export type BulkLoadSection = {
  titleKey: string
  targets: BulkLoadTarget[]
}

export const bulkLoadSections: BulkLoadSection[] = [
  {
    titleKey: 'bulkLoadTargets.sections.academicStructure',
    targets: [
      {
        id: 'academic_areas',
        labelKey: 'bulkLoadTargets.targets.academicAreas',
        apiPath: '/api/academic-areas/bulk-load/',
        sampleFile: 'bulk_load_academic_areas.csv',
        openApiDescription:
          'Columns: DANE_COD, AREA_NOMBRE, AREA_COD, DESCRIPCION. See docs/plan-implementacion-carga-masiva-csv.md',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'grading_scales',
        labelKey: 'bulkLoadTargets.targets.gradingScales',
        apiPath: '/api/grading-scales/bulk-load/',
        sampleFile: 'bulk_load_grading_scales.csv',
        openApiDescription:
          'Columns: DANE_COD, COD_NIVEL, NOMBRE_NIVEL, NOTA_MIN, NOTA_MAX, DESCRIPCION.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'academic_periods',
        labelKey: 'bulkLoadTargets.targets.academicPeriods',
        apiPath: '/api/academic-periods/bulk-load/',
        sampleFile: 'bulk_load_academic_periods.csv',
        openApiDescription:
          'Columns: DANE_COD, ANO, PERIODO_NUM, PERIODO_NOMBRE, FECHA_INI, FECHA_FIN.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'subjects',
        labelKey: 'bulkLoadTargets.targets.subjects',
        apiPath: '/api/subjects/bulk-load/',
        sampleFile: 'bulk_load_subjects.csv',
        openApiDescription:
          'Columns: DANE_COD, AREA_NOMBRE, ASIGNATURA_NOMBRE, ENFASIS, HORAS.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    titleKey: 'bulkLoadTargets.sections.people',
    targets: [
      {
        id: 'students',
        labelKey: 'bulkLoadTargets.targets.students',
        apiPath: '/api/students/bulk-load/',
        sampleFile: 'bulk_load_students.csv',
        hintKey: 'bulkLoadTargets.hints.students',
        openApiDescription:
          'Upload a CSV file to create/update students, enrollments, institutions, campuses, academic years, grade levels, and groups. CSV format: ANO, INSTITUCION, SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO, BARRIO, EPS, TIPO DE SANGRE, DISCAPACIDAD, TELEFONO. Use multipart/form-data with field \'file\'.',
        requestSchema: 'BulkLoadStudentsCsvRequest',
      },
      {
        id: 'teachers',
        labelKey: 'bulkLoadTargets.targets.teachers',
        apiPath: '/api/teachers/bulk-load/',
        sampleFile: 'bulk_load_teachers.csv',
        openApiDescription:
          'Columns: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, ESPECIALIDAD.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'teachers_users',
        labelKey: 'bulkLoadTargets.targets.teachersUsers',
        apiPath: '/api/teachers/bulk-load-users/',
        sampleFile: 'bulk_load_teachers.csv',
        hintKey: 'bulkLoadTargets.hints.teachersUsers',
        openApiDescription:
          'Uses the same teachers CSV columns (DOC, NOMBRE1, APELLIDO1, EMAIL). Creates or updates login users for existing teachers. Username format: nombre.apellido (normalized to lowercase ASCII). Password format: document number (DOC).',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'parents',
        labelKey: 'bulkLoadTargets.targets.parents',
        apiPath: '/api/parents/bulk-load/',
        sampleFile: 'bulk_load_parents.csv',
        hintKey: 'bulkLoadTargets.hints.parents',
        openApiDescription:
          'Columns: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, PARENTESCO. Empty EMAIL uses a synthetic address.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'student_guardians',
        labelKey: 'bulkLoadTargets.targets.studentGuardians',
        apiPath: '/api/student-guardians/bulk-load/',
        sampleFile: 'bulk_load_student_guardians.csv',
        openApiDescription: 'Columns: DOC_ESTUDIANTE, DOC_ACUDIENTE, ES_PRIMARIO.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'grade_directors',
        labelKey: 'bulkLoadTargets.targets.gradeDirectors',
        apiPath: '/api/grade-directors/bulk-load/',
        sampleFile: 'bulk_load_grade_directors.csv',
        openApiDescription:
          'Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, DOC_DOCENTE.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    titleKey: 'bulkLoadTargets.sections.enrollmentCourses',
    targets: [
      {
        id: 'course_assignments',
        labelKey: 'bulkLoadTargets.targets.courseAssignments',
        apiPath: '/api/course-assignments/bulk-load/',
        sampleFile: 'bulk_load_course_assignments.csv',
        openApiDescription:
          'Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (optional), DOC_DOCENTE.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    titleKey: 'bulkLoadTargets.sections.evaluation',
    targets: [
      {
        id: 'grades',
        labelKey: 'bulkLoadTargets.targets.grades',
        apiPath: '/api/grades/bulk-load/',
        sampleFile: 'bulk_load_grades.csv',
        hintKey: 'bulkLoadTargets.hints.grades',
        openApiDescription:
          'Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (optional), PERIODO_NUM, NOTA, COD_NIVEL (optional), NOTA_DEFINITIVA (optional). Requires existing CourseAssignment.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'academic_indicators',
        labelKey: 'bulkLoadTargets.targets.academicIndicators',
        apiPath: '/api/academic-indicators/bulk-load/',
        sampleFile: 'bulk_load_academic_indicators.csv',
        hintKey: 'bulkLoadTargets.hints.academicIndicators',
        openApiDescription:
          'Context columns as grades; DESCRIPCION, NOTA (optional), NIVEL_DESEMPENO_TEXTO (optional). Appends rows.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'performance_summaries',
        labelKey: 'bulkLoadTargets.targets.performanceSummaries',
        apiPath: '/api/performance-summaries/bulk-load/',
        sampleFile: 'bulk_load_performance_summaries.csv',
        openApiDescription:
          'Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, PERIODO_NUM, PROMEDIO_PERIODO, PUESTO, PROMEDIO_DEFINITIVO.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
    ],
  },
  {
    titleKey: 'bulkLoadTargets.sections.coexistenceAttendance',
    targets: [
      {
        id: 'attendance',
        labelKey: 'bulkLoadTargets.targets.attendance',
        apiPath: '/api/attendances/bulk-load/',
        sampleFile: 'bulk_load_attendance.csv',
        openApiDescription:
          'Same context columns as grades plus INASISTENCIAS_SIN_JUSTIFICAR, INASISTENCIAS_JUSTIFICADAS.',
        requestSchema: 'BulkLoadCsvUploadRequest',
      },
      {
        id: 'disciplinary',
        labelKey: 'bulkLoadTargets.targets.disciplinaryReports',
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
