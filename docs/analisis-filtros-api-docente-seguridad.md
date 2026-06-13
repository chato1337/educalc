# Análisis de filtros API — alcance docente y seguridad de acceso

**Proyecto:** eduCalc  
**Documento:** Revisión de endpoints, filtros por rol y brechas de seguridad  
**Fecha:** Junio 2025  
**Alcance:** Backend Django REST Framework (`backend/`) y compensaciones en frontend

---

## 1. Resumen ejecutivo

eduCalc expone más de **40 recursos REST** bajo el prefijo `/api/`, más endpoints compuestos (reportes, KPIs, recálculos). La autenticación es **JWT** (SimpleJWT); el modelo de roles está definido en `UserProfile` con cuatro roles: `ADMIN`, `COORDINATOR`, `TEACHER` y `PARENT`.

**Hallazgo principal:** el filtrado automático por rol (**scope**) está implementado de forma consistente **solo en el módulo de calificaciones por actividades** y en algunos endpoints agregados (dashboard KPIs, exportación consolidada). La gran mayoría de ViewSets en `views.py` requieren únicamente `IsAuthenticated` y **no aplican filtros por sede, estudiante ni asignatura** en el servidor.

| Rol | Comportamiento esperado | Comportamiento actual en API |
|-----|-------------------------|------------------------------|
| **ADMIN** | Ver y modificar todos los registros | ✅ Sin filtros (acceso global) |
| **COORDINATOR** | Ver/modificar datos de su institución | ⚠️ Parcial: KPIs, export CSV y módulo grading; core CRUD sin filtro |
| **TEACHER** (docente) | Solo su sede, grupos, estudiantes y asignaturas asignadas | ⚠️ Parcial: grading + KPIs; core CRUD expone tablas completas |
| **PARENT** (acudiente) | Solo sus hijos vinculados | ⚠️ KPIs sí; CRUD sin filtro implementado |

El frontend compensa parcialmente con guards de rutas (`routeAccess.ts`) y filtros de lista para docentes (`useTeacherScopeListDefaults.ts`), pero **estos mecanismos no protegen la API** si un usuario invoca los endpoints directamente.

---

## 2. Arquitectura de control de acceso

### 2.1 Autenticación

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/api/auth/login/` | POST | Público | Emite JWT + rol e IDs de perfil |
| `/api/auth/refresh/` | POST | Público | Renueva access token |
| `/api/auth/me/` | GET | Autenticado | Devuelve `role`, `institution_id`, `teacher_id`, `parent_id` |

### 2.2 Clases de permiso (`backend/core/permissions.py`)

| Clase | Roles permitidos |
|-------|------------------|
| `IsAdminUser` | Solo `ADMIN` |
| `IsCoordinator` | `ADMIN`, `COORDINATOR` |
| `IsTeacher` | `ADMIN`, `COORDINATOR`, `TEACHER` |
| `IsParent` | `ADMIN`, `PARENT` |
| `IsAdminUserOrReadOnlyStaff` | Lectura: staff (`ADMIN`/`COORDINATOR`/`TEACHER`); escritura: solo `ADMIN` |

### 2.3 `RoleScopeMixin` — filtrado por rol en queryset

Única utilidad centralizada para scope en servidor. Comportamiento:

| Rol | Filtro aplicado |
|-----|-----------------|
| `ADMIN` | **Ninguno** — retorna queryset completo |
| `COORDINATOR` | Por `institution_id` del perfil (vía FK del modelo) |
| `TEACHER` | Delegado a `filter_queryset_for_teacher()` (por ViewSet) |
| `PARENT` | Delegado a `filter_queryset_for_parent()` (no implementado en ningún ViewSet) |
| Otros / sin perfil | `queryset.none()` |

**Implementación actual:** solo los ViewSets en `grading_views.py` usan este mixin con `get_queryset()` override.

### 2.4 Filtros de consulta (django-filter)

Los `filterset_fields` y `FilterSet` son **filtros opcionales por query string**, controlados por el cliente. **No sustituyen el scope por rol**: un docente puede omitir filtros y recibir todos los registros en endpoints no protegidos.

El filtro más relevante para docentes es `CourseAssignmentFilter` (`backend/core/filters.py`):

- `subject`, `teacher`, `teacher__document_number`, `teacher__in`
- `group`, `group__name`, `group__in`
- `academic_year`, `academic_year__year`

---

## 3. Scope docente — dimensiones esperadas

Un docente debe ver únicamente información relacionada con sus **asignaciones de curso** (`CourseAssignment`: docente + asignatura + grupo + año lectivo). Indirectamente esto define:

| Dimensión | Relación en modelo |
|-----------|-------------------|
| **Asignaturas** | `CourseAssignment.subject` |
| **Grupos / estudiantes** | `CourseAssignment.group` → `Enrollment` → `Student` |
| **Sede** | `CourseAssignment.group.campus` |
| **Año lectivo** | `CourseAssignment.academic_year` |
| **Calificaciones / asistencia** | FK a `course_assignment` o `student` en grupos asignados |

---

## 4. Endpoints con scope por rol implementado

### 4.1 Dashboard KPIs — ✅ Correcto

**`GET /api/dashboard/kpis/`** — `IsAuthenticated`

| Rol | Scope |
|-----|-------|
| `ADMIN` sin `?institution=` | Totales globales |
| `ADMIN` con `?institution=` | Totales de esa institución |
| `COORDINATOR` | Institución del perfil |
| `TEACHER` | `compute_kpis_teacher(teacher_id)` — asignaciones, grupos, sedes, matrículas, notas, etc. |
| `PARENT` | `compute_kpis_parent(parent_id)` — hijos vinculados |

Parámetro opcional `academic_period` valida accesibilidad según rol e institución.

### 4.2 Módulo de calificaciones por actividades — ✅ Correcto (docente)

Todos requieren `IsAuthenticated` + `IsTeacher` y aplican `RoleScopeMixin`:

| Recurso | Filtro docente |
|---------|----------------|
| `/api/grading-schemes/` | `course_assignment__teacher = profile.teacher` |
| `/api/component-segments/` | `grading_scheme__course_assignment__teacher = teacher` |
| `/api/grading-activities/` | `segment__grading_scheme__course_assignment__teacher = teacher` |
| `/api/student-activity-scores/` | `activity__segment__grading_scheme__course_assignment__teacher = teacher` |
| `/api/subject-components/` (lectura) | `subject__institution_id = profile.institution_id` (toda la institución, no solo asignaturas asignadas) |

**ADMIN:** sin filtro en todos los anteriores.

**COORDINATOR:** filtro por institución en cada mixin.

**Excepción menor:** acciones `breakdown`, `apply-suggestion` y `bulk-load` del módulo grading no revalidan que el estudiante pertenezca al grupo del docente.

### 4.3 Exportación consolidada CSV — ✅ Correcto (coordinador/admin)

**`GET /api/reports/grading-consolidated/`** — `IsAuthenticated` + `IsCoordinator`

- `TEACHER` → **403 Forbidden**
- `COORDINATOR` → restringido a `UserProfile.institution`
- `ADMIN` → año lectivo completo; opcional `?institution=`

Filtros opcionales: `academic_period`, `campus`, `group`, `grade_level`, `academic_area`, `teacher`, `subject`.

### 4.4 Usuarios — ✅ Correcto (solo admin)

**`/api/users/`** — `IsAuthenticated` + `IsAdminUser`

Solo administradores pueden gestionar perfiles de usuario.

---

## 5. Inventario de endpoints core — permisos y filtros

Leyenda de columnas:

- **Permiso:** clase DRF aplicada
- **Scope servidor:** filtro automático por rol
- **Filtros query:** parámetros django-filter disponibles (no son seguridad)

### 5.1 Estructura académica

| Recurso | Métodos | Permiso | Scope servidor | Filtros query principales |
|---------|---------|---------|----------------|---------------------------|
| `/api/institutions/` | CRUD | Auth | ❌ Ninguno | `dane_code`, `nit`, `name` |
| `/api/campuses/` | CRUD | Auth | ❌ | `institution`, `name`, `code` |
| `/api/academic-years/` | CRUD | Auth | ❌ | `institution`, `year`, `is_active` |
| `/api/grade-levels/` | CRUD | Auth | ❌ | `institution`, `name`, `level_order` |
| `/api/academic-areas/` | CRUD + bulk-load | Auth | ❌ | `institution`, `name`, `code` |
| `/api/subjects/` | CRUD + bulk-load | Auth | ❌ | `institution`, `academic_area`, `name`, `emphasis` |
| `/api/groups/` | CRUD + `students-rankings` | Auth | ❌ | `campus`, `academic_year`, `grade_level`, `name` |
| `/api/academic-periods/` | CRUD + bulk-load | Auth | ❌ | `academic_year`, `number`, `name` |
| `/api/grading-scales/` | CRUD + bulk-load | Auth | ❌ | `institution`, `code`, `name` |

### 5.2 Personas y matrículas

| Recurso | Métodos | Permiso | Scope servidor | Filtros query principales |
|---------|---------|---------|----------------|---------------------------|
| `/api/students/` | CRUD + bulk-load + `grades-summary` + `transfer` | Auth | ❌ | `document_type`, `document_number`, `gender`, `sisben`, `stratum` |
| `/api/teachers/` | CRUD + bulk-load + bulk-load-users | Auth | ❌ | `document_type`, `document_number`, `email`, `specialty` |
| `/api/parents/` | CRUD + bulk-load | Auth | ❌ | `document_type`, `document_number`, `email`, `kinship` |
| `/api/student-guardians/` | CRUD + bulk-load | Auth | ❌ | `student`, `parent`, `is_primary` |
| `/api/enrollments/` | CRUD | Auth | ❌ | `student`, `group`, `academic_year`, `status` |
| `/api/grade-directors/` | CRUD + bulk-load | Auth | ❌ | `teacher`, `group`, `academic_year` |

### 5.3 Asignaciones y operaciones

| Recurso | Métodos | Permiso | Scope servidor | Filtros query principales |
|---------|---------|---------|----------------|---------------------------|
| `/api/course-assignments/` | CRUD + bulk-load + **`for-teacher`** | Auth | ❌ | `subject`, `teacher`, `teacher__in`, `group`, `group__in`, `academic_year` |
| `/api/grades/` | CRUD + bulk-load + **`suggested`** | Auth | ❌ | `student`, `course_assignment`, `course_assignment__group`, `course_assignment__teacher__document_number`, `course_assignment__subject__academic_area`, `academic_period` |
| `/api/attendances/` | CRUD + bulk-load | Auth | ❌ | `student`, `course_assignment`, `academic_period`, `date` |
| `/api/academic-indicator-catalogs/` | CRUD | Auth | ❌ | `institution`, `code`, `name` |
| `/api/academic-indicators/` | CRUD + bulk-load | Auth | ❌ | `student`, `course_assignment`, `academic_period`, `catalog` |
| `/api/performance-summaries/` | CRUD + bulk-load | Auth | ❌ | `student`, `group`, `academic_period` |
| `/api/disciplinary-reports/` | CRUD + bulk-load | Auth | ❌ | `student`, `group`, `academic_period` |

### 5.4 Reportes y documentos

| Recurso / endpoint | Métodos | Permiso | Scope servidor | Notas |
|--------------------|---------|---------|----------------|-------|
| `/api/school-records/` | GET list, GET detail, POST | Auth | ❌ | Sin filtro por rol |
| `/api/school-records/{student}/{year}/` | GET | Auth | ❌ | Cualquier estudiante por UUID |
| `/api/academic-indicators-reports/` | GET list, GET detail, POST | Auth | ❌ | Sin filtro |
| `/api/academic-indicators-reports/{student}/{period}/` | GET | Auth | ❌ | Cualquier estudiante |
| `/api/academic-grades/bulletin/` | GET (PDF) | Auth | ❌ | Boletín por estudiante o grupo arbitrario |
| `/api/performance-summaries/recalculate-by-grade/` | POST | Auth | ❌ | Recálculo masivo sin verificación de rol |
| `/api/performance-summaries/recalculate-by-institution/` | POST | Auth | ❌ | Recálculo institucional sin verificación de rol |

### 5.5 OpenAPI (sin autenticación por defecto)

| Endpoint | Riesgo |
|----------|--------|
| `/api/schema/` | Esquema público |
| `/api/docs/` | Swagger UI público |
| `/api/redoc/` | ReDoc público |

---

## 6. Endpoint crítico: `course-assignments/for-teacher`

**`GET /api/course-assignments/for-teacher/?teacher={uuid}&academic_year={uuid}`**

- Permiso: solo `IsAuthenticated`
- **No valida** que el parámetro `teacher` coincida con `request.user.profile.teacher_id`
- Cualquier usuario autenticado puede consultar las asignaciones de **cualquier docente**

El frontend usa este endpoint para cargar el scope del docente logueado, pero la API no impone esa restricción en el servidor.

---

## 7. Compensaciones en frontend (no son seguridad)

| Mecanismo | Archivo | Qué hace |
|-----------|---------|----------|
| Guards de rutas | `frontend/src/app/routeAccess.ts`, `roleMatrix.ts` | Oculta pantallas según rol |
| Navegación | `frontend/src/app/navConfig.ts` | Menú filtrado por rol |
| Filtros de lista docente | `frontend/src/features/operations/useTeacherScopeListDefaults.ts` | Al entrar como `TEACHER`, preselecciona año lectivo, documento del docente, área y grupo según `CourseAssignment` |

Estos filtros mejoran la UX pero **un docente con JWT válido puede omitirlos** llamando directamente a `/api/students/`, `/api/grades/`, etc.

---

## 8. Matriz de brechas de seguridad

### 8.1 Críticas

1. **~25 ViewSets core sin `get_queryset()` por rol** — listado y CRUD de tablas completas para cualquier usuario autenticado.
2. **Endpoints bulk-load** — carga masiva de estudiantes, notas, asignaciones, etc. sin restricción de rol.
3. **Traslado de estudiantes** — `POST /api/students/{id}/transfer/` sin verificación de rol ni institución.
4. **Reportes compuestos y boletín PDF** — generación para UUIDs arbitrarios de estudiante/grupo.
5. **Recálculo de performance** — endpoints POST a nivel grado/institución sin gate de rol.
6. **`for-teacher`** — parámetro `teacher` no atado al usuario autenticado.

### 8.2 Moderadas

7. **`GradeViewSet.suggested`** y **`GradingScheme.breakdown`** — no verifican que el estudiante esté en un grupo asignado al docente.
8. **`SubjectComponent` lectura docente** — scope a toda la institución, más amplio que asignaturas asignadas.
9. **`COORDINATOR` en core CRUD** — sin filtro por institución (solo en grading, KPIs y export CSV).
10. **`PARENT`** — `filter_queryset_for_parent` nunca implementado en ViewSets.
11. **Documentación OpenAPI pública** — exposición del surface area de la API.

### 8.3 Informativas

12. **Documentación vs código** — `docs/analisis-entidades-reporte-academico.md` y `docs/plan-de-desarrollo.md` describen RBAC completo; implementación parcial.
13. **`views.py` línea 1** — comentario explícito: *"RBAC scope filtering can be applied per-view"* — pendiente de aplicar en core.

---

## 9. Lo que funciona correctamente

| Funcionalidad | Ubicación |
|---------------|-----------|
| Login JWT y perfil `/me` | `auth_views.py` |
| Gestión de usuarios solo admin | `UserProfileViewSet` |
| Aislamiento docente en grading por actividades | `grading_views.py` + tests |
| KPIs agregados por rol | `dashboard_views.py`, `dashboard_kpis.py` |
| Export CSV consolidado solo coordinador/admin | `grading_consolidated_export_views.py` |
| Escritura de componentes de asignatura solo admin | `IsAdminUserOrReadOnlyStaff` |
| ADMIN mantiene acceso global sin filtros | Diseño intencional en `RoleScopeMixin` |

---

## 10. Recomendaciones de implementación

Para alinear la API con el modelo RBAC documentado y mejorar UX/seguridad docente:

### 10.1 Patrón base por ViewSet

```python
def get_queryset(self):
    return self.filter_queryset_by_role(super().get_queryset(), self.request)
```

Aplicar en todos los ViewSets de `views.py` con mixins específicos por modelo.

### 10.2 Filtro docente sugerido

Restringir vía subconsulta de `CourseAssignment`:

```python
assignments = CourseAssignment.objects.filter(teacher=profile.teacher)
group_ids = assignments.values_list("group_id", flat=True)
subject_ids = assignments.values_list("subject_id", flat=True)
campus_ids = Group.objects.filter(pk__in=group_ids).values_list("campus_id", flat=True)
```

Aplicar según recurso:

| Recurso | Criterio docente |
|---------|------------------|
| `Student` | Matriculado (`Enrollment`) en grupos asignados |
| `Grade`, `Attendance`, `AcademicIndicator` | `course_assignment__teacher = teacher` |
| `Group` | `pk__in=group_ids` |
| `Campus` | `pk__in=campus_ids` |
| `Subject` | `pk__in=subject_ids` |
| `CourseAssignment` | `teacher = profile.teacher` |
| `Enrollment` | `group__in=group_ids` |

### 10.3 Coordinador

Filtro uniforme: `institution_id = profile.institution_id` en todos los modelos con FK a institución.

### 10.4 Acciones compuestas

Validar scope en:

- `students/{id}/grades-summary`
- `students/{id}/transfer`
- `groups/{id}/students-rankings`
- `course-assignments/for-teacher` (forzar `teacher = profile.teacher_id` para rol `TEACHER`)
- Reportes PDF y recálculos masivos

### 10.5 Bulk-load y permisos

Restringir acciones `bulk-load` a `IsAdminUser` o `IsCoordinator` según política institucional.

### 10.6 Configuración global

Establecer en `settings.py`:

```python
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
```

Y declarar explícitamente permisos por rol en cada ViewSet.

---

## 11. Referencia de archivos clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `backend/urls.py` | Registro de rutas |
| `backend/core/views.py` | ViewSets core (mayoría sin scope) |
| `backend/core/grading_views.py` | ViewSets grading con `RoleScopeMixin` |
| `backend/core/permissions.py` | Clases RBAC y mixin de scope |
| `backend/core/filters.py` | `CourseAssignmentFilter` |
| `backend/core/dashboard_views.py` | KPIs con scope por rol |
| `backend/core/dashboard_kpis.py` | Lógica de agregación docente/coordinador |
| `backend/core/grading_consolidated_export_views.py` | Export CSV coordinador |
| `frontend/src/app/routeAccess.ts` | RBAC de rutas (UI) |
| `frontend/src/features/operations/useTeacherScopeListDefaults.ts` | Filtros UI docente |

---

## 12. Conclusión

**Los administradores (`ADMIN`) tienen acceso global sin filtros**, conforme al diseño actual de `RoleScopeMixin`.

**Los docentes (`TEACHER`) están protegidos en el módulo de calificaciones por actividades y en métricas del dashboard**, pero **no en la API principal** que usan para estudiantes, notas, asistencia, matrículas, sedes, asignaturas y reportes. Los filtros django-filter existentes son **herramientas de búsqueda**, no barreras de seguridad.

Priorizar la aplicación de `RoleScopeMixin` (o equivalente) en `views.py` y en endpoints compuestos cerrará la brecha entre la experiencia de usuario en frontend y la protección real de la información en el API.

---

## 13. Estado de implementación (Junio 2025)

Se implementó el filtrado por rol en el backend:

| Componente | Archivo | Estado |
|------------|---------|--------|
| Utilidades de scope | `backend/core/scope_utils.py` | ✅ |
| Mixins por entidad | `backend/core/scope_mixins.py` | ✅ |
| ViewSets core | `backend/core/views.py` | ✅ Todos con `RoleScopeMixin` |
| Bulk-load | Acciones `bulk-load` | ✅ Solo `ADMIN` / `COORDINATOR` (`IsBulkLoadStaff`) |
| Traslado estudiantes | `POST .../transfer/` | ✅ Solo `ADMIN` / `COORDINATOR` |
| Recálculo desempeño | `recalculate-by-*` | ✅ Solo `ADMIN` / `COORDINATOR` |
| `for-teacher` | Validación `teacher` = perfil docente | ✅ |
| Reportes compuestos | `report_views.py`, boletín PDF | ✅ `user_can_access_*` |
| Tests de scope | `backend/core/tests_scope.py` | ✅ |

**ADMIN** sigue viendo todos los registros sin filtros. **TEACHER** queda limitado a asignaciones de curso (grupos, sedes, estudiantes, asignaturas). **COORDINATOR** queda limitado a su institución. **PARENT** queda limitado a hijos vinculados vía `StudentGuardian`.

