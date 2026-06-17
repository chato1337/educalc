import type { BulkLoadApiPath } from '@/api/bulkLoad'

/** Tipos de carga masiva CSV disponibles en la plataforma. */
export type BulkLoadTarget = {
  id: string
  labelKey: string
  apiPath: BulkLoadApiPath
  sampleFile: string
  hintKey?: string
  /** Descripción de columnas esperadas en el archivo CSV. */
  columnsDescription: string
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
        columnsDescription:
          'Columnas: DANE_COD, AREA_NOMBRE, AREA_COD, DESCRIPCION.',
      },
      {
        id: 'grading_scales',
        labelKey: 'bulkLoadTargets.targets.gradingScales',
        apiPath: '/api/grading-scales/bulk-load/',
        sampleFile: 'bulk_load_grading_scales.csv',
        columnsDescription:
          'Columnas: DANE_COD, COD_NIVEL, NOMBRE_NIVEL, NOTA_MIN, NOTA_MAX, DESCRIPCION.',
      },
      {
        id: 'academic_periods',
        labelKey: 'bulkLoadTargets.targets.academicPeriods',
        apiPath: '/api/academic-periods/bulk-load/',
        sampleFile: 'bulk_load_academic_periods.csv',
        columnsDescription:
          'Columnas: DANE_COD, ANO, PERIODO_NUM, PERIODO_NOMBRE, FECHA_INI, FECHA_FIN.',
      },
      {
        id: 'subjects',
        labelKey: 'bulkLoadTargets.targets.subjects',
        apiPath: '/api/subjects/bulk-load/',
        sampleFile: 'bulk_load_subjects.csv',
        columnsDescription:
          'Columnas: DANE_COD, AREA_NOMBRE, ASIGNATURA_NOMBRE, ENFASIS, HORAS.',
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
        columnsDescription:
          'Columnas: ANO, INSTITUCION, SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO, BARRIO, EPS, TIPO DE SANGRE, DISCAPACIDAD, TELEFONO.',
      },
      {
        id: 'teachers',
        labelKey: 'bulkLoadTargets.targets.teachers',
        apiPath: '/api/teachers/bulk-load/',
        sampleFile: 'bulk_load_teachers.csv',
        columnsDescription:
          'Columnas: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, ESPECIALIDAD.',
      },
      {
        id: 'teachers_users',
        labelKey: 'bulkLoadTargets.targets.teachersUsers',
        apiPath: '/api/teachers/bulk-load-users/',
        sampleFile: 'bulk_load_teachers.csv',
        hintKey: 'bulkLoadTargets.hints.teachersUsers',
        columnsDescription:
          'Mismas columnas que la carga de docentes (DOC, NOMBRE1, APELLIDO1, EMAIL). Crea o actualiza cuentas de acceso para docentes existentes.',
      },
      {
        id: 'parents',
        labelKey: 'bulkLoadTargets.targets.parents',
        apiPath: '/api/parents/bulk-load/',
        sampleFile: 'bulk_load_parents.csv',
        hintKey: 'bulkLoadTargets.hints.parents',
        columnsDescription:
          'Columnas: DOC, TIPODOC, NOMBRE1, NOMBRE2, APELLIDO1, APELLIDO2, EMAIL, TELEFONO, PARENTESCO.',
      },
      {
        id: 'student_guardians',
        labelKey: 'bulkLoadTargets.targets.studentGuardians',
        apiPath: '/api/student-guardians/bulk-load/',
        sampleFile: 'bulk_load_student_guardians.csv',
        columnsDescription: 'Columnas: DOC_ESTUDIANTE, DOC_ACUDIENTE, ES_PRIMARIO.',
      },
      {
        id: 'grade_directors',
        labelKey: 'bulkLoadTargets.targets.gradeDirectors',
        apiPath: '/api/grade-directors/bulk-load/',
        sampleFile: 'bulk_load_grade_directors.csv',
        columnsDescription:
          'Columnas: DANE_COD, ANO, SEDE, GRADO, GRUPO, DOC_DOCENTE.',
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
        columnsDescription:
          'Columnas: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (opcional), DOC_DOCENTE.',
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
        columnsDescription:
          'Columnas: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS, AREA_NOMBRE (opcional), PERIODO_NUM, NOTA, COD_NIVEL (opcional), NOTA_DEFINITIVA (opcional).',
      },
      {
        id: 'grading_structure',
        labelKey: 'bulkLoadTargets.targets.gradingStructure',
        apiPath: '/api/grading-schemes/bulk-load/',
        sampleFile: 'bulk_load_grading_structure.csv',
        hintKey: 'bulkLoadTargets.hints.gradingStructure',
        columnsDescription:
          'Columnas: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, PERIODO_NUM, COMPONENTE_NOMBRE, COMPONENTE_PESO, SEGMENTO_NOMBRE, SEGMENTO_PESO, ACTIVIDAD_NOMBRE, ACTIVIDAD_FECHA, NOTA_MAXIMA (opcional).',
      },
      {
        id: 'student_activity_scores',
        labelKey: 'bulkLoadTargets.targets.studentActivityScores',
        apiPath: '/api/student-activity-scores/bulk-load/',
        sampleFile: 'bulk_load_student_activity_scores.csv',
        hintKey: 'bulkLoadTargets.hints.studentActivityScores',
        columnsDescription:
          'Columnas: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, PERIODO_NUM, COMPONENTE_NOMBRE, SEGMENTO_NOMBRE, ACTIVIDAD_NOMBRE, ACTIVIDAD_FECHA (opcional), NOTA, OBSERVACIONES (opcional).',
      },
      {
        id: 'academic_indicators_catalog',
        labelKey: 'bulkLoadTargets.targets.academicIndicatorsCatalog',
        apiPath: '/api/academic-indicators/bulk-load/',
        sampleFile: 'bulk_load_academic_indicators.csv',
        hintKey: 'bulkLoadTargets.hints.academicIndicatorsCatalog',
        columnsDescription:
          'Modo plantillas (sin DOC_ESTUDIANTE). Columnas: DANE_COD, AREA_ACADEMICA o AREA_NOMBRE, GRADO, LOGRO_POSITIVO, LOGRO_NEGATIVO; PERIODO_NUM opcional (1–4, omitir = genérica).',
      },
      {
        id: 'academic_indicators_students',
        labelKey: 'bulkLoadTargets.targets.academicIndicatorsStudents',
        apiPath: '/api/academic-indicators/bulk-load/',
        sampleFile: 'bulk_load_academic_indicators_legacy.csv',
        hintKey: 'bulkLoadTargets.hints.academicIndicatorsStudents',
        columnsDescription:
          'Modo por estudiante. Columnas: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, PERIODO_NUM, DESCRIPCION; NOTA y NIVEL_DESEMPENO_TEXTO opcionales.',
      },
      {
        id: 'performance_summaries',
        labelKey: 'bulkLoadTargets.targets.performanceSummaries',
        apiPath: '/api/performance-summaries/bulk-load/',
        sampleFile: 'bulk_load_performance_summaries.csv',
        columnsDescription:
          'Columnas: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, PERIODO_NUM, PROMEDIO_PERIODO, PUESTO, PROMEDIO_DEFINITIVO.',
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
        columnsDescription:
          'Mismas columnas de contexto que calificaciones, más INASISTENCIAS_SIN_JUSTIFICAR e INASISTENCIAS_JUSTIFICADAS.',
      },
      {
        id: 'disciplinary',
        labelKey: 'bulkLoadTargets.targets.disciplinaryReports',
        apiPath: '/api/disciplinary-reports/bulk-load/',
        sampleFile: 'bulk_load_disciplinary_reports.csv',
        columnsDescription:
          'Columnas: DOC_ESTUDIANTE, DANE_COD, ANO, PERIODO_NUM, TEXTO, DOC_DOCENTE_CREADOR (opcional).',
      },
    ],
  },
]

export const bulkLoadTargets: BulkLoadTarget[] = bulkLoadSections.flatMap(
  (s) => s.targets,
)
