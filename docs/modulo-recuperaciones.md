# Módulo de recuperaciones (nota definitiva)

**Proyecto:** eduCalc  
**Fecha:** Julio 2026 (boletín: septiembre 2026)  
**Estado:** Implementado (backend + frontend + contrato OpenAPI)  
**Relacionado con:**
- [analisis-filtros-api-docente-seguridad.md](./analisis-filtros-api-docente-seguridad.md)
- [modulo-gestion-calificaciones-por-actividades.md](./modulo-gestion-calificaciones-por-actividades.md)

---

## Resumen ejecutivo

El módulo **Recuperaciones** permite al personal docente (y roles staff) listar calificaciones cuya nota numérica está en la escala de valoración **Baja (BJ)** y registrar una recuperación **a nivel de periodo** que:

1. Guarda un historial auditado (`GradeRecovery`: nota, descripción, definitiva previa, docente).
2. **Sobrescribe** `Grade.definitive_grade` con la nota de recuperación de **ese** periodo.

No modifica `Grade.numerical_grade` ni `performance_level`. La sugerencia por actividades tampoco toca `definitive_grade`; este módulo es la vía explícita para hacerlo.

En el **boletín**, la celda de ese periodo toma `definitive_grade` si existe; si no, `numerical_grade`. La columna Def anual es el promedio de esas notas efectivas por periodo.

---

## Conceptos

| Concepto | Origen | Uso en recuperaciones |
|----------|--------|------------------------|
| `numerical_grade` | `Grade` | Criterio de elegibilidad (¿está en Bajo?) |
| Escala Baja (`BJ` / nombre «Bajo») | `GradingScale` por institución | Umbral: `numerical_grade <= max_score` |
| Fallback Bajo | Constante `2.99` | Si la institución no tiene fila BJ/Bajo |
| `definitive_grade` | `Grade` | Nota de recuperación **del periodo**; el boletín la usa en esa columna |
| Descripción | `GradeRecovery.description` | Texto de la recuperación presentada |

```
Grade (por estudiante + asignatura + periodo)
  numerical_grade     → nota oficial del periodo (no cambia al recuperar)
  definitive_grade    → nota de recuperación de ese periodo (si existe)
  └── GradeRecovery[]  (historial; el create más reciente refleja la definitiva actual)
```

Ejemplo: P1 con `2.50` recuperado a `3.00` → `numerical_grade = 2.50`, `definitive_grade = 3.00`. El boletín muestra **3.00** en P1.

---

## Reglas de negocio

1. **Elegibilidad:** solo calificaciones con `numerical_grade` en banda Bajo de la institución del `course_assignment.subject.institution`.
2. **Fallback:** sin escala BJ/Bajo → umbral `<= 2.99` (`BAJO_FALLBACK_MAX` en `recovery_utils.py`).
3. **Aplicación:** `POST` crea `GradeRecovery` y escribe `grade.definitive_grade = recovery_grade` en esa `Grade` (periodo).
4. **Reintentos:** se puede volver a recuperar la misma `Grade` (nuevo registro de historial + nueva definitiva).
5. **Notas fuera de Bajo:** `400` — no se permite recuperación.
6. **Scope:** el docente solo opera sobre calificaciones de sus `CourseAssignment` (mismo patrón que `/api/grades/`).
7. **Boletín (por periodo):** si el periodo tiene `definitive_grade`, esa es la nota de la celda (y el color de escala); si no, `numerical_grade`.
8. **Boletín (Def anual):** promedio simple de las notas efectivas de los periodos incluidos (recuperada o numérica). Una recuperación en P1 **no** sustituye por sí sola la Def del año.

---

## Boletín

La recuperación es **por periodo**. El cuadro de evaluaciones usa `_effective_period_grade` en `bulletin_service.py`:

| Periodo | `numerical_grade` | `definitive_grade` | Celda del boletín |
|---------|-------------------|--------------------|-------------------|
| P1 | 2.50 | 3.00 | **3.00** (recuperación) |
| P2 | 4.00 | — | **4.00** (oficial) |
| Def anual | | | **3.50** = (3.00 + 4.00) / 2 |

Antes, la celda de P1 mostraba 2.50 y la Def anual podía quedar en 3.00 (última `definitive_grade` encontrada). Eso ya no aplica.

No cambian con la recuperación:

- Indicadores cualitativos y `performance_level` (siguen la nota oficial).
- Filas de promedio y puesto del boletín (`PerformanceSummary.period_average` / `rank`).

---

## Seguridad (RBAC)

Sigue el patrón documentado en [analisis-filtros-api-docente-seguridad.md](./analisis-filtros-api-docente-seguridad.md):

| Capa | Comportamiento |
|------|----------------|
| Permiso ViewSet | `IsAuthenticated` + `IsTeacher` (ADMIN, COORDINATOR, TEACHER) |
| Scope listado recuperaciones | `GradeRecoveryRoleScopeMixin` → `grade__course_assignment__teacher` |
| Scope elegibles / create | Mismo filtro de notas que `CourseAssignmentFkRoleScopeMixin` |
| ADMIN | Sin filtro de queryset |
| COORDINATOR | Institución del perfil |
| TEACHER | Solo asignaciones propias |
| PARENT | Sin acceso al ViewSet (`IsTeacher`) |

Validaciones en create:

- La `Grade` debe existir **dentro del queryset ya filtrado por rol** → si no, `404`.
- Debe pasar `grade_is_in_bajo_scale(grade)` → si no, `400`.

---

## API

Prefijo: `/api/grade-recoveries/`  
Tag OpenAPI: `Grade Recoveries`

### Listar historial

```
GET /api/grade-recoveries/
```

Respuesta paginada de `GradeRecovery` (campos denormalizados de estudiante, asignatura, grupo, periodo).

Filtros útiles: `grade`, `grade__student`, `grade__course_assignment`, `grade__course_assignment__group`, `grade__academic_period`, `search`.

### Detalle

```
GET /api/grade-recoveries/{id}/
```

### Elegibles (notas en Bajo)

```
GET /api/grade-recoveries/eligible/
```

Respuesta paginada de **`Grade`** (mismo shape que `/api/grades/`), no de `GradeRecovery`.

Query params documentados en OpenAPI:

| Parámetro | Descripción |
|-----------|-------------|
| `course_assignment__academic_year` | Año lectivo |
| `course_assignment__group` | Grupo |
| `course_assignment__subject__academic_area` | Área |
| `course_assignment__teacher__document_number` | Documento docente |
| `academic_period` | Periodo |
| `academic_period__number` | Número de periodo |
| `student` / `course_assignment` | Filtros directos |
| `search` | Documento/nombre, asignatura, grupo, periodo |
| `hide_recovered` | `true` / `1` / `yes` / `si`: excluye grades con al menos un `GradeRecovery` |

### Aplicar recuperación

```
POST /api/grade-recoveries/
Content-Type: application/json

{
  "grade": "<uuid>",
  "recovery_grade": "3.20",
  "description": "Sustentación oral de competencias pendientes."
}
```

**Respuesta `201`:** `GradeRecovery` (incluye `previous_definitive_grade`, nombres denormalizados, etc.).

**Efecto lateral:** `Grade.definitive_grade` queda igual a `recovery_grade`.

---

## Modelo y helpers

### `GradeRecovery` (`backend/core/models.py`)

| Campo | Tipo | Notas |
|-------|------|-------|
| `grade` | FK → `Grade` | Cascade |
| `recovery_grade` | Decimal(4,2) | Nota aplicada |
| `description` | Text | Obligatorio en create |
| `previous_definitive_grade` | Decimal nullable | Auditoría |
| `created_by` | FK → `Teacher` nullable | Docente autenticado si rol TEACHER |
| `id`, `created_at`, `updated_at` | `TimeStampedModel` | UUID |

Migración: `core/migrations/0014_grade_recovery.py`.

### Helpers (`backend/core/recovery_utils.py`)

| Función | Rol |
|---------|-----|
| `resolve_bajo_max_score(institution_id)` | `max_score` BJ/Bajo o `2.99` |
| `filter_grades_in_bajo_scale(queryset)` | Annotate + filter sobre `Grade` |
| `exclude_grades_with_recovery(queryset)` | Excluye grades con ≥1 `GradeRecovery` |
| `parse_bool_query_param(raw)` | Interpreta `hide_recovered` y similares |
| `grade_is_in_bajo_scale(grade)` | Validación puntual en create |

---

## Archivos clave

### Backend

| Archivo | Responsabilidad |
|---------|-----------------|
| `core/models.py` | `GradeRecovery` |
| `core/recovery_utils.py` | Umbral Bajo / filtros |
| `core/recovery_openapi.py` | `@extend_schema` create + eligible |
| `core/serializers.py` | `GradeRecoverySerializer`, `GradeRecoveryCreateSerializer` |
| `core/scope_mixins.py` | `GradeRecoveryRoleScopeMixin` |
| `core/views.py` | `GradeRecoveryViewSet` |
| `core/bulletin_service.py` | Celda de periodo y Def anual usan la nota efectiva |
| `core/admin.py` | Admin de recuperaciones |
| `core/tests_recovery.py` | Scope, overwrite, fallback, rechazos, boletín |
| `urls.py` | `router.register(..., GradeRecoveryViewSet)` |
| `docs/openapi/schema.json` | Contrato exportado |

### Frontend

| Archivo | Responsabilidad |
|---------|-----------------|
| `features/operations/GradeRecoveriesPage.tsx` | UI listado + modal |
| `features/operations/gradeRecoveriesApi.ts` | Cliente tipado OpenAPI |
| `app/navConfig.ts` | Ítem «Recuperaciones» |
| `app/routeAccess.ts` | Prefijo `/grade-recoveries` (STAFF) |
| `routes/lazyPages.ts` / `AppRoutes.tsx` | Ruta lazy |
| `i18n/locales/es.json` | Claves `gradeRecoveries.*` / `nav.gradeRecoveries` |
| `types/schemas.ts` | Aliases `GradeRecovery`, `GradeRecoveryCreateRequest` |
| `types/openapi.d.ts` | Generado desde schema |

---

## Contrato OpenAPI (obligatorio en cambios futuros)

Cualquier cambio de API de este módulo **debe** actualizar el contrato tipado:

```bash
# 1. Documentar serializers/acciones (extend_schema / extend_schema_serializer)
# 2. Exportar schema
cd backend && bash scripts/export-openapi-schema.sh        # schema.json
# opcional: bash scripts/export-openapi-schema.sh all     # json + yaml

# 3. Regenerar tipos TypeScript
cd ../frontend && bun run generate:api-types
```

### Componentes generados

| Schema OpenAPI | Uso |
|----------------|-----|
| `GradeRecovery` | Respuesta list/detail/create |
| `GradeRecoveryCreateRequest` | Body de `POST /api/grade-recoveries/` |
| `PaginatedGradeRecoveryList` | Listado de historial |
| `PaginatedGradeList` | Respuesta de `eligible` (son `Grade`) |

### Operations

| operationId | Método / path |
|-------------|----------------|
| `grade_recoveries_list` | `GET /api/grade-recoveries/` |
| `grade_recoveries_create` | `POST /api/grade-recoveries/` |
| `grade_recoveries_retrieve` | `GET /api/grade-recoveries/{id}/` |
| `grade_recoveries_eligible_list` | `GET /api/grade-recoveries/eligible/` |

### Patrón de cliente frontend

```ts
import type { components, operations } from '@/types/openapi'

export type GradeRecovery = components['schemas']['GradeRecovery']
export type GradeRecoveryCreateRequest =
  components['schemas']['GradeRecoveryCreateRequest']

export type GradeRecoveriesEligibleParams = NonNullable<
  operations['grade_recoveries_eligible_list']['parameters']['query']
>

export async function createGradeRecovery(
  body: GradeRecoveryCreateRequest,
): Promise<GradeRecovery> {
  const { data } = await apiClient.post<GradeRecovery>(
    '/api/grade-recoveries/',
    body,
  )
  return data
}
```

No tipar a mano cuerpos/respuestas que ya existen en `openapi.d.ts`. Tras regenerar tipos, actualizar aliases en `schemas.ts` y el módulo `gradeRecoveriesApi.ts` si cambian nombres de componentes.

---

## UX docente

1. Sidebar **Evaluación → Recuperaciones** (`/grade-recoveries`).
2. Filtros: año, periodo, grupo (+ defaults de `useTeacherScopeListDefaults` para TEACHER).
3. Grilla: solo elegibles Bajo; columnas de nota numérica y definitiva actual.
4. Acción → modal con:
   - Contexto (estudiante, asignatura, grupo, periodo, nota numérica / definitiva actuales).
   - **Nota a recuperar** → `recovery_grade`.
   - **Descripción de la recuperación presentada** → `description`.
5. Guardar → `POST` + invalidación de queries `grade-recoveries` y `grades`.
6. Checkbox **Ocultar estudiantes con recuperación ya registrada**:
   - Persistido en la URL como `?hide_recovered=true` (mismo patrón que `usePlanningSchemeParam`).
   - Se reenvía al API como query param `hide_recovered` en `eligible`.
   - Constante compartida: `HIDE_RECOVERED_QUERY_KEY` en `gradeRecoveriesApi.ts`.

---

## Tests

```bash
cd backend && pipenv run python manage.py test core.tests_recovery -v2
```

Cobertura mínima esperada:

| Test | Verifica |
|------|----------|
| `test_eligible_lists_only_own_bajo_grades` | Scope docente + filtro Bajo |
| `test_apply_recovery_overwrites_definitive_grade` | Persistencia + overwrite |
| `test_cannot_recover_other_teacher_grade` | `404` fuera de scope |
| `test_cannot_recover_non_bajo_grade` | `400` fuera de Bajo |
| `test_fallback_bajo_max_when_scale_missing` | Fallback `2.99` |
| `test_hide_recovered_excludes_grades_with_recovery` | `hide_recovered=true` oculta grades con historial |
| `test_bulletin_period_cell_uses_recovery_when_present` | Celda de P1 muestra `definitive_grade` |
| `test_bulletin_period_cell_keeps_numerical_without_recovery` | Sin recuperación, la celda sigue siendo `numerical_grade` |
| `test_bulletin_year_def_averages_effective_period_grades` | Def anual = promedio de notas efectivas, no la recuperación suelta |
| `test_bulletin_single_period_def_is_the_recovered_grade` | Boletín de un solo periodo: celda y Def = recuperación |

---

## Checklist para evoluciones futuras

- [ ] ¿El cambio toca request/response o query params? → actualizar `recovery_openapi.py` / serializers con `extend_schema*`.
- [ ] Exportar `schema.json` y regenerar `openapi.d.ts`.
- [ ] Actualizar `gradeRecoveriesApi.ts` / `schemas.ts` / i18n si hay campos nuevos.
- [ ] Mantener scope vía mixins (no filtrar solo en frontend).
- [x] Boletín: por periodo usa `definitive_grade` si existe; Def anual promedia notas efectivas (`bulletin_service.py` + tests en `tests_recovery.py`).
- [ ] `PerformanceSummary` (promedio / puesto del boletín) sigue usando `numerical_grade`; no se recálcula con la recuperación.
- [ ] No usar este flujo para mutar `numerical_grade` (eso sigue siendo `/api/grades/` o apply-suggestion).
- [ ] Ampliar tests de scope si se añaden roles o acciones nuevas.

---

## Relación con otros módulos

| Módulo | Relación con `definitive_grade` |
|--------|----------------------------------|
| Calificaciones (`/grades`) | CRUD manual; puede editar definitiva del **periodo** |
| Nota sugerida / actividades | **No** modifica `definitive_grade` |
| **Recuperaciones** | Única acción de negocio dedicada a recuperación + historial (por periodo) |
| Boletín | Celda del periodo: `definitive_grade` si existe, si no `numerical_grade`. Def anual: promedio de esas notas efectivas |
| Consolidado CSV | Sigue prefiriendo `numerical_grade` (definitiva solo si no hay numérica) |
| Indicadores / nivel | Siguen `numerical_grade` y `performance_level` (la recuperación no los cambia) |
| `PerformanceSummary` | Promedio y puesto del periodo usan `numerical_grade` |
