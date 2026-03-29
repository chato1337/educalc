# Estado de implementación — Frontend administración eduCalc

Documento para **retomar el trabajo sin contexto previo**. Complementa el plan en [plan-frontend-administracion.md](./plan-frontend-administracion.md).

**Última revisión:** Fases 0–13 + **Fase 14 — RBAC en UI:** `roleMatrix.ts` (roles alineados al backend, etiquetas ES `appRoleLabelEs` / `formatRolesListEs`), `navConfig.ts` con `rolesAllowed` y `filterNavSectionsForRole`, `routeAccess.ts`. `AdminLayout`: drawer con ítem activo (`matchPath` + `selected`; prefijo para `/students` y `/groups`), barra con rol en español, y **`AccessDeniedContent`** (panel con mensaje y botón al panel) si la URL no está permitida para el rol en lugar de redirigir en silencio.

---

## Cómo arrancar

1. **Backend** en `http://127.0.0.1:8000` (o ajusta proxy / `VITE_API_BASE_URL`).
2. **Frontend:** desde `frontend/`, `npm run dev` (Vite). Por defecto las peticiones a `/api` se proxifican al backend (ver `vite.config.ts`).
3. **Login:** `/login` — credenciales del usuario Django; la API devuelve JWT (`access`, `refresh`) y `user` con `role`, `institution_id`, etc. (ver `backend/core/auth_views.py`).

**Variables:** copia `.env.example` → `.env` solo si necesitas un origen API explícito (p. ej. despliegue sin proxy).

---

## Checkpoints por fase

| Fase | Estado | Qué quedó hecho |
|------|--------|------------------|
| **0 — Bootstrap** | Hecho | Dependencias: React Router 7, TanStack Query, Zustand, MUI 7 + iconos, Tailwind 4 (`@tailwindcss/vite`), Axios, RHF + Zod + resolvers. Tipos OpenAPI generados en `src/types/openapi.d.ts` (`npm run generate:api-types`). Proveedores en `src/app/providers.tsx`. Alias `@/` → `src/` (Vite + `tsconfig.app.json`). |
| **1 — Auth y shell** | Hecho | `loginApi.ts` (sin ciclo con `apiClient`), `meApi.ts` (`GET /api/auth/me/`). `authStore` con `persist` localStorage (`educalc-auth`). `apiClient` con Bearer + refresh en 401 (`rawClient` para login/refresh). `ProtectedRoute` + `AdminLayout` (Drawer, AppBar, selector de institución, logout). Navegación en `src/app/navConfig.ts`. |
| **2 — Instituciones** | Hecho | `InstitutionsPage`: listado, crear/editar (dialog + RHF/Zod), eliminar. `CampusesPage`: CRUD; listado filtrado por institución seleccionada en barra; formulario con Autocomplete de institución. |
| **3 — Estructura académica** | Hecho (CRUD) | **Pantallas dedicadas** en `src/features/academic-structure/`: `AcademicYearsPage`, `AcademicPeriodsPage`, `GradeLevelsPage`, `GroupsPage`, `AcademicAreasPage`, `SubjectsPage` (tabla + diálogo crear/editar + eliminar, RHF + Zod). Referencias reutilizables: `academicQueries.ts` (`useInstitutionsReference`, `useAcademicYearsQuery`, `useCampusesForInstitution`, `useGradeLevelsQuery`, `useAcademicAreasQuery`). Esas rutas **ya no** usan `GenericListPage` (se quitaron de `resourceConfig.ts`). **Grupos:** filtros por año/sede/nivel; enlace «Ranking» → `/groups/:id/rankings`. |
| **4 — Personas** | Hecho (CRUD) | `src/features/people/`: `TeachersPage`, `ParentsPage`, `UsersPage` (perfil RBAC: usuario Django pk, rol, institución, docente/acudiente opcional), `StudentGuardiansPage`, `GradeDirectorsPage` (filtros año/grupo/docente; formulario con docente, año y grupo del año). Estudiantes: `StudentFormPage` en `/students/new` y `/students/:id/edit`; botones en listado y ficha. Rutas quitadas de `resourceConfig.ts`. |
| **5 — Operación escolar** | Hecho (CRUD) | `src/features/operations/`: `EnrollmentsPage`, `CourseAssignmentsPage`, `GradingScalesPage`, `GradesPage`, `AcademicIndicatorsPage`, `PerformanceSummariesPage`, `AttendancesPage`, `DisciplinaryReportsPage`, `SchoolRecordsPage` (solo POST generar + listado), `AcademicIndicatorsReportsPage` (idem). Hooks compartidos en `operationsQueries.ts`. |
| **6 — Expedientes** | Hecho (generación + lista + consulta compuesta) | Libro final e informes de indicadores en `features/operations/`. **Fase 11:** bloques «Consulta o generación por…» en `SchoolRecordsPage` y `AcademicIndicatorsReportsPage` (`GET /api/school-records/{student}/{year}/`, `GET /api/academic-indicators-reports/{student}/{period}/`). Claves en `queryKeys.ts`: `schoolRecordComposite`, `academicIndicatorsReportComposite`. **Rankings:** `GroupRankingsPage`. |
| **7 — Bulk load y pulido** | Hecho (MVP) | `BulkLoadPage` en `/students/bulk-load` (multipart, muestra JSON de estadísticas según `backend/core/bulk_load.py`). Sin ErrorBoundary global ni e2e; mensajes de error principalmente en pantalla (Alert). |
| **12 — Code splitting** | Hecho | `lazyPages.ts` + `Suspense` (`AdminLayout`, `LoginRoute` en `AppRoutes`). |
| **13 — Hidratación auth** | Hecho | `useAuthStoreHydrated` (`useSyncExternalStore`) en `ProtectedRoute` y `LoginPage`; coexiste con `onRehydrateStorage` en `authStore` (`syncInstitutionFromUser`). |
| **14 — Menú y rutas por rol** | Hecho | Ver párrafo «Última revisión». Incluye pulido UI: sin permiso → `AccessDeniedContent`; rol legible en barra; estado activo en drawer. |

---

## Mapa de archivos relevantes

| Área | Ruta |
|------|------|
| Rutas | `src/routes/AppRoutes.tsx`, `src/routes/lazyPages.ts`, `src/routes/ProtectedRoute.tsx` |
| Hooks | `src/hooks/useAuthStoreHydrated.ts` |
| UI transversal | `src/components/RoutePageFallback.tsx`, `src/components/AccessDeniedContent.tsx` |
| API | `src/api/client.ts`, `src/api/rawClient.ts`, `src/api/config.ts`, `src/api/queryKeys.ts`, `src/api/errors.ts` |
| Estado | `src/stores/authStore.ts`, `src/stores/uiStore.ts` |
| Listados genéricos | `src/features/admin/GenericListPage.tsx` (sin entradas en `resourceConfig.ts` por ahora) |
| Operación escolar (CRUD) | `src/features/operations/*.tsx`, `operationsQueries.ts` |
| Estructura académica (CRUD) | `src/features/academic-structure/*.tsx`, `academicQueries.ts` |
| Personas (CRUD) | `src/features/people/*.tsx` |
| Auth UI | `src/features/auth/LoginPage.tsx` |
| Layout + RBAC UI | `src/layouts/AdminLayout.tsx`, `src/app/roleMatrix.ts`, `src/app/routeAccess.ts`, `src/app/navConfig.ts` |
| Tipos reutilizables | `src/types/schemas.ts` (envolturas sobre `openapi.d.ts`), `src/types/user.ts` |

---

## Deuda técnica / siguientes pasos sugeridos

1. **Paginación** si el backend añade page/size a los listados.
2. **Roles (UI):** implementado en Fase 14; mantener `navConfig` / `routeAccess` alineados si cambian permisos en API.
3. **Tests:** Playwright o RTL en flujos críticos (login, crear institución, bulk load).

---

## Regenerar tipos desde OpenAPI

Tras cambios en `backend/docs/openapi/schema.json`:

```bash
cd frontend && npm run generate:api-types
```

---

## Nota sobre dependencias circulares

`authStore` importa solo `loginApi.ts` (usa `rawClient`). `meApi.ts` importa `apiClient` y **no** debe importarse desde `authStore` para evitar el ciclo `client ↔ store`.
