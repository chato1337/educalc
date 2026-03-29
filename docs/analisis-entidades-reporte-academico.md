# Análisis de Entidades - Sistema de Reportes Académicos

**Proyecto:** eduCalc  
**Documento:** Análisis de entidades y atributos para API REST  
**Referencia:** Decreto 1290 de 2009 (Colombia)  
**Fecha:** Marzo 2025

---

## 1. Resumen Ejecutivo

Este documento identifica todas las entidades, atributos y relaciones necesarias para implementar un sistema de reportes académicos que genere documentación equivalente al **Registro Escolar de Valoración** e **Indicadores Académicos** de instituciones educativas colombianas.

El sistema se desarrollará sobre el framework **Django REST Framework** existente en el backend del proyecto.

---

## 2. Entidades Identificadas

### 2.1 Institución Educativa (`Institution`)

Representa la institución educativa a nivel corporativo.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `name` | string | Nombre completo de la institución | Sí |
| `legal_reference` | string | Referencia legal (ej: "Art. 16 Decreto 1290 de 2009") | No |
| `dane_code` | string | Código DANE (ej: 219212000339) | Sí |
| `nit` | string | NIT de la institución | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Ejemplo:** INSTITUCIÓN EDUCATIVA AGROPECUARIA CARRIZALES

---

### 2.2 Sede / Campus (`Campus`)

Representa cada sede o campus de la institución.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `institution` | FK → Institution | Institución a la que pertenece | Sí |
| `name` | string | Nombre de la sede | Sí |
| `code` | string | Código interno (ej: E.R.M. CARRIZALES) | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Ejemplo:** COLEGIO RURAL AGROPECUARIO CARRIZALES (E.R.M. CARRIZALES)

---

### 2.3 Año Lectivo (`AcademicYear`)

Representa el año escolar.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `year` | integer | Año (ej: 2024) | Sí |
| `institution` | FK → Institution | Institución | Sí |
| `start_date` | date | Inicio del año lectivo | No |
| `end_date` | date | Fin del año lectivo | No |
| `is_active` | boolean | Indica si es el año actual | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.4 Grado (`GradeLevel`)

Nivel educativo (ej: SEXTO, PRIMERO, SEGUNDO).

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `name` | string | Nombre del grado (SEXTO, PRIMERO, etc.) | Sí |
| `level_order` | integer | Orden numérico para ordenamiento | Sí |
| `institution` | FK → Institution | Institución | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.5 Grupo / Curso (`Group`)

Grupo específico de estudiantes dentro de un grado (ej: 601, 602). Un grupo es único por grado, año lectivo, sede y nombre.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `name` | string | Nombre/código del grupo (ej: 601) | Sí |
| `grade_level` | FK → GradeLevel | Grado al que pertenece | Sí |
| `academic_year` | FK → AcademicYear | Año lectivo | Sí |
| `campus` | FK → Campus | Sede donde se imparte | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.6 Estudiante (`Student`)

Datos del estudiante.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `document_type` | string | Tipo documento (CC, TI, RC) | No |
| `document_number` | string | Número de identificación | No |
| `first_name` | string | Primer nombre | Sí |
| `second_name` | string | Segundo nombre | No |
| `first_last_name` | string | Primer apellido | Sí |
| `second_last_name` | string | Segundo apellido | No |
| `full_name` | string | Nombre completo (calculado o almacenado) | Sí |
| `date_of_birth` | date | Fecha de nacimiento | No |
| `gender` | string | Género | No |
| `enrollment_date` | date | Fecha de matrícula | No |
| `stratum` | string | Estrato socioeconómico (ej: ESTRATO 1, NO APLICA) | No |
| `sisben` | string | Nivel SISBEN IV (ej: A5, NO APLICA) | No |
| `neighborhood` | string | Barrio o vereda | No |
| `health_insurer` | string | EPS o aseguradora | No |
| `blood_type` | string | Tipo de sangre (ej: O +) | No |
| `disability` | string | Discapacidad (ej: NO APLICA, DISCAPACIDAD MÚLTIPLE) | No |
| `phone` | string | Teléfono de contacto | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Nota:** En el documento aparece el nombre en formato "APELLIDO NOMBRE NOMBRE" (ej: IPIA CAMPO MICHEL MARIANA). Los campos `stratum`, `sisben`, `neighborhood`, `health_insurer`, `blood_type`, `disability` y `phone` se usan en la carga masiva desde CSV.

---

### 2.7 Matrícula (`Enrollment`)

Relación estudiante-grupo en un año lectivo.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `group` | FK → Group | Grupo | Sí |
| `academic_year` | FK → AcademicYear | Año lectivo | Sí |
| `enrollment_date` | date | Fecha de matrícula | No |
| `status` | string | Estado (activo, retirado, graduado) | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.8 Docente (`Teacher`)

Información del docente/facultad.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `document_type` | string | Tipo de documento | No |
| `document_number` | string | Número de identificación | No |
| `first_name` | string | Primer nombre | Sí |
| `second_name` | string | Segundo nombre | No |
| `first_last_name` | string | Primer apellido | Sí |
| `second_last_name` | string | Segundo apellido | No |
| `full_name` | string | Nombre completo | Sí |
| `email` | string | Correo electrónico | No |
| `phone` | string | Teléfono | No |
| `specialty` | string | Especialidad o área | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Ejemplo:** NORI ZULEIMA BALCAZAR VELASCO, HIDER ALEXIS QUITUMBO ATILLO

---

### 2.9 Director de Grado (`GradeDirector`)

Docente responsable de un grupo específico (aparece en Indicadores Académicos).

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `teacher` | FK → Teacher | Docente | Sí |
| `group` | FK → Group | Grupo del que es director | Sí |
| `academic_year` | FK → AcademicYear | Año lectivo | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.10 Área Académica (`AcademicArea`)

Área o categoría amplia de conocimiento (ej: BIENESTAR Y CULTURA, PENSAMIENTO MATEMÁTICO).

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `name` | string | Nombre del área | Sí |
| `code` | string | Código corto (opcional) | No |
| `institution` | FK → Institution | Institución | Sí |
| `description` | text | Descripción adicional | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Ejemplos:**
- BIENESTAR Y CULTURA
- COMUNICACIÓN COMUNITARIA
- PENSAMIENTO MATEMÁTICO
- INGLES (área sin énfasis adicional)

---

### 2.11 Asignatura / Curso (`Subject`)

Asignatura o curso concreto. Puede tener énfasis específico dentro de un área.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `academic_area` | FK → AcademicArea | Área a la que pertenece | Sí |
| `name` | string | Nombre (puede coincidir con área o ser específico) | Sí |
| `emphasis` | string | Énfasis (ej: "Educación Física y Artística") | No |
| `hours` | integer | Intensidad horaria (columna H) | No |
| `institution` | FK → Institution | Institución | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Ejemplos:**
- BIENESTAR Y CULTURA: Énfasis en Educación Física y Artística
- INGLES (sin énfasis)
- PENSAMIENTO MATEMÁTICO: Énfasis en aritmética, Geometría y Estadística

---

### 2.12 Asignación de Curso (`CourseAssignment`)

Asignación de docente a una asignatura en un grupo y año.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `subject` | FK → Subject | Asignatura | Sí |
| `teacher` | FK → Teacher | Docente asignado | Sí |
| `group` | FK → Group | Grupo | Sí |
| `academic_year` | FK → AcademicYear | Año lectivo | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.13 Periodo Académico (`AcademicPeriod`)

Cada uno de los periodos de evaluación (P1, P2, P3, P4).

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `academic_year` | FK → AcademicYear | Año lectivo | Sí |
| `number` | integer | Número del periodo (1, 2, 3, 4) | Sí |
| `name` | string | Nombre (P1, P2, P3, P4) | Sí |
| `start_date` | date | Inicio del periodo | No |
| `end_date` | date | Fin del periodo | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.14 Escala de Valoración (`GradingScale`)

Niveles de desempeño según el Decreto 1290.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `institution` | FK → Institution | Institución | Sí |
| `code` | string | Código (SP, AL, BS, BJ) | Sí |
| `name` | string | Nombre (Superior, Alto, Básico, Bajo) | Sí |
| `min_score` | decimal | Calificación mínima | Sí |
| `max_score` | decimal | Calificación máxima | Sí |
| `description` | string | Descripción opcional | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Valores estándar:**
| Código | Nombre | Rango |
|--------|--------|-------|
| SP | Superior | 4.60 - 5.00 |
| AL | Alto | 4.00 - 4.59 |
| BS | Básico | 3.00 - 3.99 |
| BJ | Bajo | 0.00 - 2.99 |

---

### 2.15 Calificación (`Grade`)

Calificación numérica de un estudiante en una asignatura por periodo.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `course_assignment` | FK → CourseAssignment | Asignación curso | Sí |
| `academic_period` | FK → AcademicPeriod | Periodo | Sí |
| `numerical_grade` | decimal | Calificación numérica (0-5) | Sí |
| `performance_level` | FK → GradingScale | Nivel de desempeño (derivado) | No |
| `definitive_grade` | decimal | Calificación definitiva anual (para último periodo) | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.16 Inasistencia (`Attendance`)

Registro de ausencias por asignatura y periodo.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `course_assignment` | FK → CourseAssignment | Asignación curso | Sí |
| `academic_period` | FK → AcademicPeriod | Periodo | Sí |
| `unexcused_absences` | integer | Inasistencias sin excusa (SE) | Sí |
| `excused_absences` | integer | Inasistencias con excusa (CE) | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.17 Indicador Académico (`AcademicIndicator`)

Descriptor cualitativo del logro del estudiante en un área (documento Indicadores Académicos).

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `course_assignment` | FK → CourseAssignment | Asignación curso | Sí |
| `academic_period` | FK → AcademicPeriod | Periodo | Sí |
| `description` | text | Texto descriptivo del logro alcanzado | Sí |
| `numerical_grade` | decimal | Calificación asociada | No |
| `performance_level` | string | Nivel (ALTO, SUPERIOR, etc.) | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Ejemplo:** "Participa activamente en las diferentes pruebas del atletismo, ayudando a desarrollar sus cualidades físicas básicas."

---

### 2.18 Resumen de Desempeño (`PerformanceSummary`)

Promedio y puesto del estudiante por periodo.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `group` | FK → Group | Grupo (para ranking) | Sí |
| `academic_period` | FK → AcademicPeriod | Periodo | Sí |
| `period_average` | decimal | Promedio del estudiante en el periodo | Sí |
| `rank` | integer | Puesto del estudiante en el periodo | No |
| `definitive_average` | decimal | Promedio definitivo anual (solo último periodo) | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.19 Informe Disciplinario (`DisciplinaryReport`)

Comentarios cualitativos sobre conducta.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `academic_period` | FK → AcademicPeriod | Periodo (o año completo) | Sí |
| `report_text` | text | Contenido del informe disciplinario | No |
| `created_by` | FK → Teacher | Docente que registra | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.20 Reporte de Indicadores Académicos (`AcademicIndicatorsReport`)

Documento completo "Indicadores Académicos" con observaciones y firma.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `group` | FK → Group | Grupo | Sí |
| `academic_period` | FK → AcademicPeriod | Periodo | Sí |
| `grade_director` | FK → Teacher | Director de grado | Sí |
| `general_observations` | text | Observaciones generales | No |
| `generated_at` | datetime | Fecha de generación | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.21 Registro Escolar (`SchoolRecord`)

Documento principal "Registro Escolar de Valoración" - puede ser vista/agregado de datos.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `group` | FK → Group | Grupo | Sí |
| `academic_year` | FK → AcademicYear | Año lectivo | Sí |
| `institution` | FK → Institution | Institución | Sí |
| `campus` | FK → Campus | Sede | Sí |
| `generated_at` | datetime | Fecha de generación | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.22 Usuario (`User`)

Extiende el modelo de usuario de Django para autenticación y vinculación con roles. Cada usuario tiene un rol que determina sus permisos.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `username` | string | Nombre de usuario (Django) | Sí |
| `email` | string | Correo electrónico | Sí |
| `role` | enum | Rol: ADMIN, COORDINADOR, DOCENTE, PADRE_FAMILIA | Sí |
| `teacher` | FK → Teacher | Vinculación si es docente | No |
| `parent` | FK → Parent | Vinculación si es padre/acudiente | No |
| `institution` | FK → Institution | Institución (coordinadores pueden tener alcance) | No |
| `is_active` | boolean | Usuario activo | Sí |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

### 2.23 Padre / Acudiente (`Parent`)

Representa al padre, madre o acudiente del estudiante para acceso al sistema.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `document_type` | string | Tipo de documento | No |
| `document_number` | string | Número de identificación | No |
| `first_name` | string | Primer nombre | Sí |
| `second_name` | string | Segundo nombre | No |
| `first_last_name` | string | Primer apellido | Sí |
| `second_last_name` | string | Segundo apellido | No |
| `full_name` | string | Nombre completo | Sí |
| `email` | string | Correo electrónico | Sí |
| `phone` | string | Teléfono | No |
| `kinship` | string | Parentesco (padre, madre, acudiente, etc.) | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

**Relación:** Un Parent puede tener varios Student (hijos) mediante `StudentGuardian`.

---

### 2.24 Estudiante-Acudiente (`StudentGuardian`)

Relación many-to-many entre estudiante y acudientes.

| Atributo | Tipo | Descripción | Obligatorio |
|----------|------|-------------|-------------|
| `id` | UUID/PK | Identificador único | Sí |
| `student` | FK → Student | Estudiante | Sí |
| `parent` | FK → Parent | Acudiente | Sí |
| `is_primary` | boolean | Acudiente principal | No |
| `created_at` | datetime | Fecha de creación | Sí |
| `updated_at` | datetime | Última actualización | Sí |

---

## 3. Diagrama de Relaciones (ER Simplificado)

```
Institution
    ├── Campus (1:N)
    ├── AcademicYear (1:N)
    ├── GradeLevel (1:N)
    ├── AcademicArea (1:N)
    ├── Subject (1:N)
    └── GradingScale (1:N)

AcademicYear
    ├── Group (1:N)
    ├── AcademicPeriod (1:N)
    └── Enrollment (1:N)

Group
    ├── Enrollment (1:N)
    ├── CourseAssignment (1:N)
    ├── GradeDirector (1:1)
    └── PerformanceSummary (1:N)

Student
    ├── Enrollment (1:N)
    ├── Grade (1:N)
    ├── Attendance (1:N)
    ├── AcademicIndicator (1:N)
    ├── PerformanceSummary (1:N)
    └── DisciplinaryReport (1:N)

Teacher
    ├── CourseAssignment (1:N)
    ├── GradeDirector (1:N)
    └── DisciplinaryReport (1:N)

Subject
    └── CourseAssignment (1:N)

CourseAssignment
    ├── Grade (1:N)
    ├── Attendance (1:N)
    └── AcademicIndicator (1:N)

User (Django + perfil)
    ├── Teacher (1:1, si rol DOCENTE)
    └── Parent (1:1, si rol PADRE_FAMILIA)

Parent
    └── StudentGuardian (1:N) ──► Student
```

---

## 4. Consideraciones para la API REST

### 4.1 Endpoints sugeridos (por recurso)

| Recurso | Endpoint base | Operaciones |
|---------|---------------|-------------|
| Institution | `/api/institutions/` | CRUD |
| Campus | `/api/campuses/` | CRUD |
| AcademicYear | `/api/academic-years/` | CRUD |
| GradeLevel | `/api/grade-levels/` | CRUD |
| Group | `/api/groups/` | CRUD |
| Student | `/api/students/` | CRUD |
| Teacher | `/api/teachers/` | CRUD |
| AcademicArea | `/api/academic-areas/` | CRUD |
| Subject | `/api/subjects/` | CRUD |
| CourseAssignment | `/api/course-assignments/` | CRUD |
| AcademicPeriod | `/api/academic-periods/` | CRUD |
| GradingScale | `/api/grading-scales/` | CRUD |
| Grade | `/api/grades/` | CRUD |
| Attendance | `/api/attendances/` | CRUD |
| AcademicIndicator | `/api/academic-indicators/` | CRUD |
| PerformanceSummary | `/api/performance-summaries/` | CRUD |
| DisciplinaryReport | `/api/disciplinary-reports/` | CRUD |
| SchoolRecord | `/api/school-records/` | GET, POST (generar) |
| AcademicIndicatorsReport | `/api/academic-indicators-reports/` | GET, POST (generar) |
| User | `/api/users/` | CRUD (solo ADMIN) |
| Parent | `/api/parents/` | CRUD |
| StudentGuardian | `/api/student-guardians/` | CRUD |

### 4.2 Endpoints compuestos para reportes

- `GET /api/school-records/{student_id}/{academic_year_id}/` — Generar registro escolar completo
- `GET /api/academic-indicators-reports/{student_id}/{period_id}/` — Generar indicadores académicos
- `GET /api/students/{id}/grades-summary/` — Resumen de calificaciones
- `GET /api/groups/{id}/students-rankings/` — Rankings por periodo

### 4.2.1 Carga masiva de estudiantes

- `POST /api/students/bulk-load/` — Carga masiva desde CSV (multipart/form-data, campo `file`).

**Columnas del CSV:** ANO, INSTITUCION, SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV, DOC, TIPODOC, APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO, BARRIO, EPS, TIPO DE SANGRE, DISCAPACIDAD, TELEFONO.

**Comportamiento:** Crea o actualiza Institution, Campus, AcademicYear, GradeLevel, Group, Student y Enrollment según los datos del CSV. Los estudiantes se identifican por `document_number`; si existe se actualiza, si no se crea.

### 4.3 Framework identificado

- **Backend:** Django 4.2 + Django REST Framework
- **Autenticación:** SimpleJWT (JWT)
- **Filtros:** django-filter
- **Base de datos:** PostgreSQL (psycopg2-binary en Pipfile) / SQLite (configuración actual)

### 4.4 Autorización basada en roles (RBAC)

La API implementará **Role-Based Access Control (RBAC)** para restringir el acceso según el rol del usuario autenticado. Cada usuario tiene un único rol que determina sus permisos sobre los recursos.

#### Roles definidos

| Rol | Código | Descripción |
|-----|--------|-------------|
| **Administrador** | `ADMIN` | Acceso total al sistema. Gestión de institución, usuarios, configuración. |
| **Coordinador** | `COORDINADOR` | Gestión académica de la institución o sede. Reportes consolidados, configuración de periodos, escalas. |
| **Docente** | `DOCENTE` | Gestión de calificaciones, indicadores e inasistencias de sus asignaturas y grupos asignados. |
| **Padre de familia** | `PADRE_FAMILIA` | Solo lectura de información de sus hijos (calificaciones, reportes, asistencias). |

#### Matriz de permisos por rol

| Recurso | ADMIN | COORDINADOR | DOCENTE | PADRE_FAMILIA |
|---------|:-----:|:-----------:|:-------:|:-------------:|
| Institution, Campus | CRUD | R | — | — |
| AcademicYear, AcademicPeriod | CRUD | CRUD | R | R |
| GradeLevel, Group | CRUD | CRUD | R* | — |
| Student | CRUD | CRUD | R* | R** |
| Teacher, Parent | CRUD | CRUD | R | — |
| AcademicArea, Subject | CRUD | CRUD | R | — |
| CourseAssignment | CRUD | CRUD | R* | — |
| GradingScale | CRUD | CRUD | R | — |
| Grade | CRUD | CRUD | CRUD* | R** |
| Attendance | CRUD | CRUD | CRUD* | R** |
| AcademicIndicator | CRUD | CRUD | CRUD* | R** |
| PerformanceSummary | CRUD | CRUD | R | R** |
| DisciplinaryReport | CRUD | CRUD | CRUD* | R** |
| SchoolRecord | R, generar | R, generar | R* | R** |
| AcademicIndicatorsReport | R, generar | R, generar | R* | R** |

**Leyenda:**
- **CRUD:** Create, Read, Update, Delete
- **R:** Solo lectura
- **\*** Restringido a grupos/asignaturas del docente
- **\*\*** Restringido solo a hijos del padre de familia

#### Alcance por rol (filtrado de datos)

| Rol | Alcance de datos |
|-----|------------------|
| **ADMIN** | Toda la institución. Puede gestionar múltiples sedes si aplica. |
| **COORDINADOR** | Institución o sede asignada. Acceso a todos los grupos y estudiantes de su alcance. |
| **DOCENTE** | Solo grupos y asignaturas donde está asignado (`CourseAssignment`). Solo estudiantes de esos grupos. |
| **PADRE_FAMILIA** | Solo estudiantes vinculados como hijos (`StudentGuardian`). |

#### Implementación sugerida

- **Django:** Usar `django.contrib.auth` con modelo `User` extendido (OneToOne `UserProfile` con `role` y FKs).
- **DRF:** Permisos personalizados (`IsAdmin`, `IsCoordinator`, `IsTeacher`, `IsParent`) + filtros por alcance en `get_queryset()`.
- **Alternativa:** Paquete `django-guardian` o `django-rules` para permisos por objeto si se requiere granularidad por sede/grupo.
- Los tokens JWT pueden incluir el `role` en el payload para evitar consultas repetidas.

#### Endpoints de autenticación

- `POST /api/auth/login/` — Login (retorna JWT con `user_id`, `role`, `institution_id`)
- `POST /api/auth/refresh/` — Refresh token
- `GET /api/auth/me/` — Perfil del usuario autenticado (incluye rol y alcance)

---

## 5. Próximos Pasos

1. Crear modelos Django según este análisis
2. Configurar Django REST Framework y SimpleJWT en `settings.py`
3. Implementar autorización basada en roles (RBAC): perfiles de usuario, permisos por rol, filtrado por alcance
4. Implementar serializers y ViewSets
5. Crear migraciones e inicializar base de datos
6. Implementar lógica de generación de reportes PDF/documentos
7. Crear endpoints de reportes compuestos

---

## 6. Referencias

- Decreto 1290 de 2009 — Evaluación del aprendizaje y promoción de estudiantes (Colombia)
- Imágenes de referencia: Registro Escolar de Valoración, Indicadores Académicos
- Institución de referencia: INSTITUCIÓN EDUCATIVA AGROPECUARIA CARRIZALES
