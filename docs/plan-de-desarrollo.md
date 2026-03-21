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

- [ ] Modelo `Student` según análisis
- [ ] Método `full_name` o `save()` para computar `full_name`
- [ ] Migración
- [ ] Admin

### 2.2 Teacher

- [ ] Modelo `Teacher`
- [ ] Migración
- [ ] Admin

### 2.3 Parent

- [ ] Modelo `Parent`
- [ ] Migración
- [ ] Admin

**Checkpoint:** `git commit -m "feat: add person models (Student, Teacher, Parent)"`

---

## Fase 3: Modelos relacionales académicos

### 3.1 Group

- [ ] Modelo `Group` (FK → GradeLevel, AcademicYear, Campus)
- [ ] Migración
- [ ] Admin

### 3.2 Subject

- [ ] Modelo `Subject` (FK → AcademicArea, Institution)
- [ ] Migración
- [ ] Admin

### 3.3 AcademicPeriod

- [ ] Modelo `AcademicPeriod` (FK → AcademicYear)
- [ ] Migración
- [ ] Admin

### 3.4 CourseAssignment

- [ ] Modelo `CourseAssignment` (FK → Subject, Teacher, Group, AcademicYear)
- [ ] Migración
- [ ] Admin

### 3.5 GradeDirector

- [ ] Modelo `GradeDirector` (FK → Teacher, Group, AcademicYear)
- [ ] Migración
- [ ] Admin

### 3.6 Enrollment

- [ ] Modelo `Enrollment` (FK → Student, Group, AcademicYear)
- [ ] Migración
- [ ] Admin

### 3.7 StudentGuardian

- [ ] Modelo `StudentGuardian` (FK → Student, Parent)
- [ ] Migración
- [ ] Admin

**Checkpoint:** `git commit -m "feat: add relational models (Group, Subject, CourseAssignment, etc.)"`

---

## Fase 4: Modelos de evaluación

### 4.1 Grade

- [ ] Modelo `Grade` (FK → Student, CourseAssignment, AcademicPeriod, GradingScale opcional)
- [ ] Migración
- [ ] Admin

### 4.2 Attendance

- [ ] Modelo `Attendance` (FK → Student, CourseAssignment, AcademicPeriod)
- [ ] Migración
- [ ] Admin

### 4.3 AcademicIndicator

- [ ] Modelo `AcademicIndicator` (FK → Student, CourseAssignment, AcademicPeriod)
- [ ] Migración
- [ ] Admin

### 4.4 PerformanceSummary

- [ ] Modelo `PerformanceSummary` (FK → Student, Group, AcademicPeriod)
- [ ] Migración
- [ ] Admin

### 4.5 DisciplinaryReport

- [ ] Modelo `DisciplinaryReport` (FK → Student, AcademicPeriod, Teacher opcional)
- [ ] Migración
- [ ] Admin

**Checkpoint:** `git commit -m "feat: add evaluation models (Grade, Attendance, AcademicIndicator, etc.)"`

---

## Fase 5: Modelos de reportes y usuarios

### 5.1 SchoolRecord

- [ ] Modelo `SchoolRecord` (FK → Student, Group, AcademicYear, Institution, Campus)
- [ ] Migración
- [ ] Admin

### 5.2 AcademicIndicatorsReport

- [ ] Modelo `AcademicIndicatorsReport` (FK → Student, Group, AcademicPeriod, grade_director)
- [ ] Migración
- [ ] Admin

### 5.3 User / UserProfile (RBAC)

- [ ] Modelo `UserProfile` (OneToOne User, role enum, FK → Teacher, Parent, Institution)
- [ ] Choices para `role`: ADMIN, COORDINATOR, TEACHER, PARENT
- [ ] Migración
- [ ] Signal para crear UserProfile al crear User

**Checkpoint:** `git commit -m "feat: add report models and UserProfile for RBAC"`

---

## Fase 6: API — Autenticación y RBAC

### 6.1 Auth endpoints

- [ ] `POST /api/auth/login/` — Login con username/password, retorna JWT
- [ ] `POST /api/auth/refresh/` — Refresh token
- [ ] `GET /api/auth/me/` — Perfil (incluye role, institution, teacher/parent si aplica)
- [ ] `@extend_schema` en cada vista de auth

### 6.2 Permisos RBAC

- [ ] Clase `IsAdminUser`
- [ ] Clase `IsCoordinator`
- [ ] Clase `IsTeacher` (con filtro por CourseAssignment)
- [ ] Clase `IsParent` (con filtro por StudentGuardian)
- [ ] Mixin o helper para filtrar `get_queryset()` por rol

**Checkpoint:** `git commit -m "feat: implement auth endpoints and RBAC permissions"`

---

## Fase 7: API — CRUD por entidad (con OpenAPI)

Cada entidad debe tener:

- ViewSet con CRUD (o el subconjunto según RBAC)
- Serializer (list + detail/retrieve si difieren)
- `@extend_schema` con: summary, description, tags, responses
- Filtros con django-filter si aplica

### 7.1 Institution

- [ ] `InstitutionViewSet`
- [ ] `InstitutionSerializer`
- [ ] OpenAPI: tags `["Institutions"]`, descripción del recurso

### 7.2 Campus

- [ ] `CampusViewSet`, `CampusSerializer`
- [ ] OpenAPI: tags `["Campuses"]`

### 7.3 AcademicYear

- [ ] `AcademicYearViewSet`, `AcademicYearSerializer`
- [ ] OpenAPI: tags `["Academic Years"]`

### 7.4 GradeLevel

- [ ] `GradeLevelViewSet`, `GradeLevelSerializer`
- [ ] OpenAPI: tags `["Grade Levels"]`

### 7.5 Group

- [ ] `GroupViewSet`, `GroupSerializer`
- [ ] OpenAPI: tags `["Groups"]`

### 7.6 Student

- [ ] `StudentViewSet`, `StudentSerializer`
- [ ] OpenAPI: tags `["Students"]`

### 7.7 Teacher

- [ ] `TeacherViewSet`, `TeacherSerializer`
- [ ] OpenAPI: tags `["Teachers"]`

### 7.8 Parent

- [ ] `ParentViewSet`, `ParentSerializer`
- [ ] OpenAPI: tags `["Parents"]`

### 7.9 StudentGuardian

- [ ] `StudentGuardianViewSet`, `StudentGuardianSerializer`
- [ ] OpenAPI: tags `["Student Guardians"]`

### 7.10 AcademicArea

- [ ] `AcademicAreaViewSet`, `AcademicAreaSerializer`
- [ ] OpenAPI: tags `["Academic Areas"]`

### 7.11 Subject

- [ ] `SubjectViewSet`, `SubjectSerializer`
- [ ] OpenAPI: tags `["Subjects"]`

### 7.12 CourseAssignment

- [ ] `CourseAssignmentViewSet`, `CourseAssignmentSerializer`
- [ ] OpenAPI: tags `["Course Assignments"]`

### 7.13 AcademicPeriod

- [ ] `AcademicPeriodViewSet`, `AcademicPeriodSerializer`
- [ ] OpenAPI: tags `["Academic Periods"]`

### 7.14 GradingScale

- [ ] `GradingScaleViewSet`, `GradingScaleSerializer`
- [ ] OpenAPI: tags `["Grading Scales"]`

### 7.15 Grade

- [ ] `GradeViewSet`, `GradeSerializer`
- [ ] OpenAPI: tags `["Grades"]`

### 7.16 Attendance

- [ ] `AttendanceViewSet`, `AttendanceSerializer`
- [ ] OpenAPI: tags `["Attendance"]`

### 7.17 AcademicIndicator

- [ ] `AcademicIndicatorViewSet`, `AcademicIndicatorSerializer`
- [ ] OpenAPI: tags `["Academic Indicators"]`

### 7.18 PerformanceSummary

- [ ] `PerformanceSummaryViewSet`, `PerformanceSummarySerializer`
- [ ] OpenAPI: tags `["Performance Summaries"]`

### 7.19 DisciplinaryReport

- [ ] `DisciplinaryReportViewSet`, `DisciplinaryReportSerializer`
- [ ] OpenAPI: tags `["Disciplinary Reports"]`

### 7.20 SchoolRecord

- [ ] `SchoolRecordViewSet` (GET, POST para generar)
- [ ] OpenAPI: tags `["School Records"]`

### 7.21 AcademicIndicatorsReport

- [ ] `AcademicIndicatorsReportViewSet` (GET, POST para generar)
- [ ] OpenAPI: tags `["Academic Indicators Reports"]`

### 7.22 GradeDirector

- [ ] `GradeDirectorViewSet`, `GradeDirectorSerializer`
- [ ] OpenAPI: tags `["Grade Directors"]`

### 7.23 User (admin)

- [ ] `UserViewSet` (solo ADMIN), `UserSerializer`
- [ ] OpenAPI: tags `["Users"]`

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
