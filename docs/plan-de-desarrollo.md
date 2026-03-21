# Plan de Desarrollo — eduCalc API

**Documento base:** [analisis-entidades-reporte-academico.md](./analisis-entidades-reporte-academico.md)  
**Versión:** 1.0  
**Última actualización:** Marzo 2025

---

## Contexto para retomar el trabajo

Este plan permite retomar el desarrollo en cualquier punto. Se asume:

- **Stack:** Django 4.2, Django REST Framework, PostgreSQL, drf-spectacular (OpenAPI)
- **Estructura:** Configuración en `backend/` (settings, urls, wsgi, asgi en la raíz)
- **Reglas:** Código fuente en inglés; cada entidad debe estar documentada en OpenAPI/Swagger
- **Migraciones:** Generar con `manage.py makemigrations`. Si no es posible (ej. el asistente no puede ejecutar comandos), el desarrollador las genera.
- **Referencia:** Entidades y atributos en `docs/analisis-entidades-reporte-academico.md`

---

## Convenciones de desarrollo

| Regla | Descripción |
|-------|-------------|
| **Idioma del código** | Nombres de variables, clases, funciones y comentarios en inglés |
| **Idioma de la API** | Campos y mensajes de la API en inglés (snake_case) |
| **OpenAPI por entidad** | Cada ViewSet/endpoint debe usar `@extend_schema` con descripción, tags y ejemplos |
| **Checkpoints** | Commit y etiqueta git al completar cada fase |
| **Orden de implementación** | Respetar dependencias (modelos base antes de modelos con FKs) |
| **Migraciones** | Deben generarse con el CLI de Django (`manage.py makemigrations`). Si no es posible, el desarrollador las genera manualmente. |

---

## Fase 0: Infraestructura base

- [x] **0.1** Crear app Django `core` o `academic` para los modelos
- [x] **0.2** Registrar app en `INSTALLED_APPS`
- [x] **0.3** Configurar SimpleJWT en `settings.py` (ACCESS_LIFETIME, REFRESH_LIFETIME)
- [x] **0.4** Verificar conexión a PostgreSQL con `.env`
- [x] **0.5** Verificar que `/api/docs/` y `/api/schema/` respondan

**Checkpoint:** `git commit -m "chore: setup core app and JWT config"`

---

## Fase 1: Modelos base (sin dependencias entre sí)

Orden sugerido según FK.

### 1.1 Institution

- [x] Modelo `Institution` con campos del análisis (id UUID, name, legal_reference, dane_code, nit, timestamps)
- [x] Migración
- [x] Admin básico

### 1.2 Campus

- [x] Modelo `Campus` (FK → Institution)
- [x] Migración
- [x] Admin

### 1.3 AcademicYear

- [x] Modelo `AcademicYear` (FK → Institution)
- [x] Migración
- [x] Admin

### 1.4 GradeLevel

- [x] Modelo `GradeLevel` (FK → Institution)
- [x] Migración
- [x] Admin

### 1.5 AcademicArea

- [x] Modelo `AcademicArea` (FK → Institution)
- [x] Migración
- [x] Admin

### 1.6 GradingScale

- [x] Modelo `GradingScale` (FK → Institution)
- [x] Migración
- [x] Admin

**Checkpoint:** `git commit -m "feat: add base models (Institution, Campus, AcademicYear, GradeLevel, AcademicArea, GradingScale)"`

---

## Fase 2: Modelos de personas

### 2.1 Student

- [x] Modelo `Student` según análisis
- [x] Método `full_name` o `save()` para computar `full_name`
- [x] Migración
- [x] Admin

### 2.2 Teacher

- [x] Modelo `Teacher`
- [x] Migración
- [x] Admin

### 2.3 Parent

- [x] Modelo `Parent`
- [x] Migración
- [x] Admin

**Checkpoint:** `git commit -m "feat: add person models (Student, Teacher, Parent)"`

---

## Fase 3: Modelos relacionales académicos

### 3.1 Group

- [x] Modelo `Group` (FK → GradeLevel, AcademicYear, Campus)
- [x] Migración
- [x] Admin

### 3.2 Subject

- [x] Modelo `Subject` (FK → AcademicArea, Institution)
- [x] Migración
- [x] Admin

### 3.3 AcademicPeriod

- [x] Modelo `AcademicPeriod` (FK → AcademicYear)
- [x] Migración
- [x] Admin

### 3.4 CourseAssignment

- [x] Modelo `CourseAssignment` (FK → Subject, Teacher, Group, AcademicYear)
- [x] Migración
- [x] Admin

### 3.5 GradeDirector

- [x] Modelo `GradeDirector` (FK → Teacher, Group, AcademicYear)
- [x] Migración
- [x] Admin

### 3.6 Enrollment

- [x] Modelo `Enrollment` (FK → Student, Group, AcademicYear)
- [x] Migración
- [x] Admin

### 3.7 StudentGuardian

- [x] Modelo `StudentGuardian` (FK → Student, Parent)
- [x] Migración
- [x] Admin

**Checkpoint:** `git commit -m "feat: add relational models (Group, Subject, CourseAssignment, etc.)"`

---

## Fase 4: Modelos de evaluación

### 4.1 Grade

- [x] Modelo `Grade` (FK → Student, CourseAssignment, AcademicPeriod, GradingScale opcional)
- [x] Migración
- [x] Admin

### 4.2 Attendance

- [x] Modelo `Attendance` (FK → Student, CourseAssignment, AcademicPeriod)
- [x] Migración
- [x] Admin

### 4.3 AcademicIndicator

- [x] Modelo `AcademicIndicator` (FK → Student, CourseAssignment, AcademicPeriod)
- [x] Migración
- [x] Admin

### 4.4 PerformanceSummary

- [x] Modelo `PerformanceSummary` (FK → Student, Group, AcademicPeriod)
- [x] Migración
- [x] Admin

### 4.5 DisciplinaryReport

- [x] Modelo `DisciplinaryReport` (FK → Student, AcademicPeriod, Teacher opcional)
- [x] Migración
- [x] Admin

**Checkpoint:** `git commit -m "feat: add evaluation models (Grade, Attendance, AcademicIndicator, etc.)"`

---

## Fase 5: Modelos de reportes y usuarios

### 5.1 SchoolRecord

- [x] Modelo `SchoolRecord` (FK → Student, Group, AcademicYear, Institution, Campus)
- [x] Migración
- [x] Admin

### 5.2 AcademicIndicatorsReport

- [x] Modelo `AcademicIndicatorsReport` (FK → Student, Group, AcademicPeriod, grade_director)
- [x] Migración
- [x] Admin

### 5.3 User / UserProfile (RBAC)

- [x] Modelo `UserProfile` (OneToOne User, role enum, FK → Teacher, Parent, Institution)
- [x] Choices para `role`: ADMIN, COORDINATOR, TEACHER, PARENT
- [x] Migración
- [x] Signal para crear UserProfile al crear User

**Checkpoint:** `git commit -m "feat: add report models and UserProfile for RBAC"`

---

## Fase 6: API — Autenticación y RBAC

### 6.1 Auth endpoints

- [x] `POST /api/auth/login/` — Login con username/password, retorna JWT
- [x] `POST /api/auth/refresh/` — Refresh token
- [x] `GET /api/auth/me/` — Perfil (incluye role, institution, teacher/parent si aplica)
- [x] `@extend_schema` en cada vista de auth

### 6.2 Permisos RBAC

- [x] Clase `IsAdminUser`
- [x] Clase `IsCoordinator`
- [x] Clase `IsTeacher` (con filtro por CourseAssignment)
- [x] Clase `IsParent` (con filtro por StudentGuardian)
- [x] Mixin o helper para filtrar `get_queryset()` por rol

**Checkpoint:** `git commit -m "feat: implement auth endpoints and RBAC permissions"`

---

## Fase 7: API — CRUD por entidad (con OpenAPI)

Cada entidad debe tener:

- ViewSet con CRUD (o el subconjunto según RBAC)
- Serializer (list + detail/retrieve si difieren)
- `@extend_schema` con: summary, description, tags, responses
- Filtros con django-filter si aplica

### 7.1 Institution

- [x] `InstitutionViewSet`
- [x] `InstitutionSerializer`
- [x] OpenAPI: tags `["Institutions"]`, descripción del recurso

### 7.2 Campus

- [x] `CampusViewSet`, `CampusSerializer`
- [x] OpenAPI: tags `["Campuses"]`

### 7.3 AcademicYear

- [x] `AcademicYearViewSet`, `AcademicYearSerializer`
- [x] OpenAPI: tags `["Academic Years"]`

### 7.4 GradeLevel

- [x] `GradeLevelViewSet`, `GradeLevelSerializer`
- [x] OpenAPI: tags `["Grade Levels"]`

### 7.5 Group

- [x] `GroupViewSet`, `GroupSerializer`
- [x] OpenAPI: tags `["Groups"]`

### 7.6 Student

- [x] `StudentViewSet`, `StudentSerializer`
- [x] OpenAPI: tags `["Students"]`

### 7.7 Teacher

- [x] `TeacherViewSet`, `TeacherSerializer`
- [x] OpenAPI: tags `["Teachers"]`

### 7.8 Parent

- [x] `ParentViewSet`, `ParentSerializer`
- [x] OpenAPI: tags `["Parents"]`

### 7.9 StudentGuardian

- [x] `StudentGuardianViewSet`, `StudentGuardianSerializer`
- [x] OpenAPI: tags `["Student Guardians"]`

### 7.10 AcademicArea

- [x] `AcademicAreaViewSet`, `AcademicAreaSerializer`
- [x] OpenAPI: tags `["Academic Areas"]`

### 7.11 Subject

- [x] `SubjectViewSet`, `SubjectSerializer`
- [x] OpenAPI: tags `["Subjects"]`

### 7.12 CourseAssignment

- [x] `CourseAssignmentViewSet`, `CourseAssignmentSerializer`
- [x] OpenAPI: tags `["Course Assignments"]`

### 7.13 AcademicPeriod

- [x] `AcademicPeriodViewSet`, `AcademicPeriodSerializer`
- [x] OpenAPI: tags `["Academic Periods"]`

### 7.14 GradingScale

- [x] `GradingScaleViewSet`, `GradingScaleSerializer`
- [x] OpenAPI: tags `["Grading Scales"]`

### 7.15 Grade

- [x] `GradeViewSet`, `GradeSerializer`
- [x] OpenAPI: tags `["Grades"]`

### 7.16 Attendance

- [x] `AttendanceViewSet`, `AttendanceSerializer`
- [x] OpenAPI: tags `["Attendance"]`

### 7.17 AcademicIndicator

- [x] `AcademicIndicatorViewSet`, `AcademicIndicatorSerializer`
- [x] OpenAPI: tags `["Academic Indicators"]`

### 7.18 PerformanceSummary

- [x] `PerformanceSummaryViewSet`, `PerformanceSummarySerializer`
- [x] OpenAPI: tags `["Performance Summaries"]`

### 7.19 DisciplinaryReport

- [x] `DisciplinaryReportViewSet`, `DisciplinaryReportSerializer`
- [x] OpenAPI: tags `["Disciplinary Reports"]`

### 7.20 SchoolRecord

- [x] `SchoolRecordViewSet` (GET, POST para generar)
- [x] OpenAPI: tags `["School Records"]`

### 7.21 AcademicIndicatorsReport

- [x] `AcademicIndicatorsReportViewSet` (GET, POST para generar)
- [x] OpenAPI: tags `["Academic Indicators Reports"]`

### 7.22 GradeDirector

- [x] `GradeDirectorViewSet`, `GradeDirectorSerializer`
- [x] OpenAPI: tags `["Grade Directors"]`

### 7.23 User (admin)

- [x] `UserProfileViewSet` (solo ADMIN), `UserProfileSerializer`
- [x] OpenAPI: tags `["Users"]`

**Checkpoint:** `git commit -m "feat: implement CRUD API for all entities with OpenAPI docs"`

---

## Fase 8: Endpoints compuestos y reportes

- [ ] `GET /api/school-records/{student_id}/{academic_year_id}/` — Generar registro escolar
- [ ] `GET /api/academic-indicators-reports/{student_id}/{period_id}/` — Generar indicadores
- [ ] `GET /api/students/{id}/grades-summary/` — Resumen de calificaciones
- [ ] `GET /api/groups/{id}/students-rankings/` — Rankings por periodo
- [ ] Documentar cada endpoint con `@extend_schema`

**Checkpoint:** `git commit -m "feat: add composite report endpoints"`

---

## Fase 9: Exportación de schema y datos de prueba

- [ ] Ejecutar `./scripts/export-openapi-schema.sh` y verificar `docs/openapi/schema.yaml`
- [ ] Crear management command o fixtures para datos de prueba (institución, grados, escalas)
- [ ] Verificar que Swagger UI muestre todas las entidades documentadas

**Checkpoint:** `git commit -m "chore: export OpenAPI schema and add seed data"`

---

## Fase 10 (Opcional): Generación de PDF

- [ ] Integrar librería (reportlab, weasyprint u otra)
- [ ] Vista/endpoint para generar PDF del Registro Escolar
- [ ] Vista/endpoint para generar PDF de Indicadores Académicos

**Checkpoint:** `git commit -m "feat: add PDF generation for reports"`

---

## Checklist de verificación por entidad

Para cada entidad completada, asegurarse:

| Verificación | ✓ |
|--------------|---|
| Modelo en inglés, campos en inglés | |
| Migración aplicada sin errores | |
| Serializer con campos necesarios | |
| ViewSet registrado en router | |
| `@extend_schema` con tags y descripción | |
| Permisos RBAC aplicados según matriz | |
| Filtros django-filter si aplica | |

---

## Cómo retomar desde un checkpoint

1. Revisar este documento y marcar tareas completadas.
2. Identificar la siguiente fase o tarea pendiente.
3. Consultar `docs/analisis-entidades-reporte-academico.md` para atributos y relaciones.
4. Revisar `docs/api-documentacion.md` para Swagger y exportación del schema.
5. Probar con `python manage.py check` y `GET /api/docs/` antes de continuar.

---

## Referencias rápidas

- **Entidades:** Ver sección 2 de [analisis-entidades-reporte-academico.md](./analisis-entidades-reporte-academico.md)
- **Endpoints:** Sección 4.1 y 4.2 del análisis
- **RBAC:** Sección 4.4 del análisis
- **Swagger:** `http://localhost:8000/api/docs/`
- **Export schema:** `./scripts/export-openapi-schema.sh`
