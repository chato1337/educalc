# Plan de implementación: frontend de administración (eduCalc)

Documento de referencia para construir el panel de administración en la carpeta `frontend`, alineado con el contrato **OpenAPI 3.0.3** definido en `backend/docs/openapi/schema.json` (API REST, título *eduCalc API*, versión 1.0.0).

---

## 1. Contexto inicial del proyecto

### 1.1 Estado actual

- **Frontend:** Vite + React 19 + TypeScript con panel de administración implementado (router, MUI, TanStack Query, Zustand, Tailwind). Ver **checkpoints y mapa de archivos** en [ESTADO-IMPLEMENTACION.md](./ESTADO-IMPLEMENTACION.md).
- **Backend:** Django REST; la mayoría de rutas exigen autenticación **JWT** (`Authorization: Bearer <access>`) o **cookie de sesión** (`sessionid` vía `cookieAuth`).

### 1.2 Stack objetivo (capas y responsabilidad)

| Capa | Tecnología | Rol |
|------|------------|-----|
| Estilos utilitarios + layout fino | **Tailwind CSS** | Espaciado, grids, responsive, overrides puntuales sin pelear con MUI. |
| Componentes y theming | **Material UI (MUI)** + **@mui/icons-material** | Formularios, tablas, diálogos, navegación, tema claro/oscuro opcional. |
| Enrutamiento | **React Router** | Rutas públicas (login) vs protegidas (admin), layouts anidados, parámetros `:id`. |
| Datos servidor (cache, loading, errores) | **TanStack Query (React Query)** | `useQuery` / `useMutation`, revalidación, estados de red. |
| Estado global cliente | **Zustand** | Sesión (tokens + usuario), preferencias UI (sidebar, institución activa), flags ligeros. |

**Integración Tailwind + MUI:** usar el preset oficial de MUI para Tailwind v4 (o la guía vigente de MUI 6) para evitar conflictos de `CssBaseline` y reset; aplicar `important: '#root'` en Tailwind solo si hace falta para ganar especificidad en contenedores concretos.

### 1.3 Contrato API (resumen operativo)

- **Base path:** `/api/…`
- **Autenticación:**
  - `POST /api/auth/login/` — público; cuerpo tipo `CustomTokenObtainPairRequest` (`username`, `password`); respuesta `LoginResponse` (`access`, `refresh`, `user` con `role`, `institution_id`, etc.).
  - `POST /api/auth/refresh/` — `TokenRefreshRequest` → `TokenRefresh`.
  - `GET /api/auth/me/` — perfil del usuario autenticado (objeto abierto en el schema; tipar en cliente según respuesta real o extender el schema).
- **Listados:** muchos `GET` soportan filtros por query (`institution`, `academic_year`, `ordering`, `search`, etc., según recurso).
- **Operación destacada:** `POST /api/students/bulk-load/` — `multipart/form-data`, campo `file` (CSV con columnas documentadas en el schema).

---

## 2. Inventario de endpoints por dominio (desde OpenAPI)

Agrupación útil para menú lateral y módulos de pantalla.

| Dominio | Rutas principales | Notas |
|---------|-------------------|--------|
| **Autenticación** | `login`, `refresh`, `me` | Base del guard de rutas y del cliente HTTP. |
| **Institución y sedes** | `institutions`, `campuses` | Filtro global por `institution` en muchos listados. |
| **Estructura académica** | `academic-years`, `academic-periods`, `grade-levels`, `groups`, `academic-areas`, `subjects` | Núcleo del calendario y organización. |
| **Personas y roles** | `students`, `parents`, `teachers`, `users`, `student-guardians`, `grade-directors` | CRUD + relaciones. |
| **Matrícula y asignación** | `enrollments`, `course-assignments` | Enlace estudiante–grupo–materia. |
| **Evaluación** | `grades`, `grading-scales`, `academic-indicators`, `performance-summaries` | Reglas y resultados. |
| **Asistencia y disciplina** | `attendances`, `disciplinary-reports` | Operaciones transaccionales frecuentes. |
| **Expedientes e informes** | `school-records`, `academic-indicators-reports` | Incluye rutas compuestas `{student_id}/{period_id}` y `{student_id}/{academic_year_id}`. |
| **Estudiantes (extra)** | `students/{id}/grades-summary/`, `groups/{id}/students-rankings/` | Vistas de detalle/agregados. |
| **Carga masiva** | `students/bulk-load/` | UI de upload + feedback de estadísticas (schema solo indica descripción genérica en 200). |

Cada recurso con `/{id}/` sigue el patrón REST habitual: `GET` detalle, `PUT`/`PATCH` actualización, `DELETE` según esté expuesto en el schema.

---

## 3. Arquitectura de carpetas propuesta

```
frontend/
├── src/
│   ├── app/                    # providers: QueryClient, ThemeProvider, Router
│   ├── api/
│   │   ├── client.ts           # fetch/axios + interceptors (Bearer, 401 → refresh)
│   │   ├── queryKeys.ts        # fábrica de keys para TanStack Query
│   │   └── endpoints/          # funciones por dominio (thin wrappers)
│   ├── features/
│   │   ├── auth/
│   │   ├── institutions/
│   │   ├── students/
│   │   └── ...                 # un feature por dominio de negocio
│   ├── components/             # compartidos (DataTable, PageHeader, ErrorBoundary)
│   ├── layouts/                # AdminLayout (drawer + app bar), AuthLayout
│   ├── routes/                 # definición de rutas y guards
│   ├── stores/                 # slices Zustand (authStore, uiStore)
│   ├── hooks/                  # useAuth, useInstitutionFilter, etc.
│   └── types/                  # tipos generados o manuales alineados a schemas
├── docs/                       # este plan y futuras guías
└── ...
```

**Principio:** cada `feature` contiene pantallas, formularios y hooks de datos que consumen `api/endpoints` + TanStack Query; Zustand no duplica datos que ya están en caché de React Query salvo lo estrictamente global (tokens, usuario, contexto de institución seleccionada).

---

## 4. Cliente HTTP y sincronización con OpenAPI

1. **Variables de entorno:** `VITE_API_BASE_URL` (ej. `http://localhost:8000`) y uso de `proxy` en Vite en desarrollo si se prefiere mismo origen.
2. **Cliente:** Axios o `fetch` con interceptor: adjuntar `Authorization` desde Zustand o memoria segura; en `401`, intentar `refresh` una vez y reintentar la petición.
3. **Tipos:** opción recomendada — generar tipos desde el schema con **openapi-typescript** apuntando a `backend/docs/openapi/schema.json` (salida `src/types/api.d.ts` o similar) y envolver respuestas en funciones tipadas manualmente donde el schema sea `additionalProperties: {}` (`auth/me`).
4. **Convención de errores:** mapear cuerpos de error DRF a mensajes en Snackbar/Alert de MUI.

---

## 5. React Router

- **Rutas públicas:** `/login`.
- **Rutas protegidas:** bajo `/` o `/admin` con `AdminLayout`.
- **Guard:** si no hay `access` válido (o usuario no cargado), redirigir a `/login`; opcionalmente cargar `me` al iniciar sesión para validar token.
- **Rutas anidadas:** lista `/students`, detalle `/students/:id`, mismo patrón para el resto de recursos.
- **Ruta dedicada:** `/students/bulk-load` o pestaña dentro del módulo estudiantes para el POST multipart.

---

## 6. TanStack Query

- **Query keys:** jerárquicas, por ejemplo `['students', { institutionId, search }]`, `['student', id]`, `['academic-years', { institution }]`.
- **Mutations:** `create` / `update` / `delete` con `onSuccess` que invalide los prefijos afectados (`queryClient.invalidateQueries({ queryKey: ['students'] })`).
- **Listados:** considerar `placeholderData` / `keepPreviousData` si se añade paginación cuando el backend la exponga; hoy muchos endpoints devuelven arreglos completos.
- **Prefetch:** opcional en hover de filas de tabla para detalle.

---

## 7. Zustand

**Stores sugeridos (mínimo viable):**

- **`authStore`:** `access`, `refresh`, `user`, `setSession`, `clearSession`, `hydrate` desde `localStorage` (o `sessionStorage` si no se desea persistencia).
- **`uiStore`:** estado del drawer en móvil, tema claro/oscuro, institución seleccionada para filtrar listados (UUID alineado a `user.institution_id` o selector explícito para roles multi-institución si aplica).

Persistencia con `zustand/middleware` (`persist`) solo para tokens si el equipo acepta el trade-off de seguridad en XSS; alternativa más segura: memoria + refresh cookie solo si el backend lo soporta de forma unificada (hoy el schema prioriza JWT explícito).

---

## 8. UI con MUI + Tailwind

- **Layout admin:** `AppBar` + `Drawer` con lista de navegación por dominio (tabla de la sección 2); iconos de `@mui/icons-material`.
- **Listados:** `DataGrid` (MUI X, si se acepta dependencia extra) o `Table` + paginación manual; columnas alineadas a campos `readOnly` del schema (`*_name`) para evitar N+1 en UI.
- **Formularios:** componentes controlados con **React Hook Form** + resolvers **Zod** (opcional pero recomendado) validando contra reglas del `*Request` del OpenAPI.
- **Tailwind:** contenedores de página (`max-w-*`, `gap-*`), grids responsive; MUI para superficies interactivas.

---

## 9. Fases de implementación

### Fase 0 — Bootstrap (contexto inicial completo)

- Instalar: `react-router-dom`, `@tanstack/react-query`, `zustand`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`, Tailwind + integración con Vite, y opcionalmente `axios`, `openapi-typescript`, `react-hook-form`, `zod`, `@hookform/resolvers`.
- Configurar proveedores en `main.tsx` / `app/providers.tsx`: `QueryClientProvider`, `ThemeProvider` + `CssBaseline`, `BrowserRouter`.
- Añadir scripts npm: `generate:api-types` si se usa openapi-typescript.

### Fase 1 — Autenticación y shell

- Pantalla login (MUI) → `POST /api/auth/login/` → guardar tokens y usuario en Zustand.
- Cliente HTTP con refresh en cadena.
- `GET /api/auth/me/` tras login o al arrancar app hidratada.
- `AdminLayout` con menú y zona de contenido (`<Outlet />`).

### Fase 2 — Núcleo institucional

- CRUD o listado/edición de **Institutions** y **Campuses**; conectar selector de institución al resto de queries.

### Fase 3 — Estructura académica

- **Academic years**, **periods**, **grade levels**, **groups**, **academic areas**, **subjects** (orden sugerido por dependencias FK en formularios).

### Fase 4 — Personas

- **Students** (lista, detalle, formulario), **Teachers**, **Parents**, **Users**, relaciones **student-guardians**, **grade-directors**.

### Fase 5 — Operación escolar

- **Enrollments**, **course-assignments**, **grades**, **grading-scales**, **academic-indicators**, **attendances**, **disciplinary-reports**, **performance-summaries**.

### Fase 6 — Expedientes e informes

- **School records** y **academic indicators reports**, incluyendo rutas con parámetros compuestos del schema.
- Vistas **grades-summary** y **students-rankings** como pantallas de solo lectura o exportación.

### Fase 7 — Carga masiva y pulido

- UI **bulk-load** CSV con progreso y resumen de respuesta.
- Manejo global de errores, empty states, accesibilidad (labels, foco en diálogos), y pruebas e2e opcionales (Playwright).

---

## 10. Criterios de calidad y seguridad

- No loguear tokens; sanitizar mensajes de error en producción.
- CSP y XSS: si se persiste JWT en `localStorage`, reforzar higiene de dependencias y evitar `dangerouslySetInnerHTML`.
- **Roles:** el login y `GET /api/auth/me/` incluyen `role` (`ADMIN`, `COORDINATOR`, `TEACHER`, `PARENT`). La app filtra el menú (`navConfig` + `filterNavSectionsForRole`) y bloquea rutas por prefijo (`routeAccess` + `AdminLayout` → redirección a `/dashboard`).

---

## 11. Referencias en el repositorio

- Contrato OpenAPI: `backend/docs/openapi/schema.json`
- Ejemplo CSV bulk load: `docs/bulk_load_students.csv`
- Documentación API (si se mantiene al día): `docs/api-documentacion.md`

---

## 12. Checkpoints de implementación (seguimiento)

El detalle fase por fase, comandos de arranque, mapa de archivos y deuda técnica vive en **[ESTADO-IMPLEMENTACION.md](./ESTADO-IMPLEMENTACION.md)**. Actualízalo al cerrar cada hito para que otro agente o desarrollador pueda continuar sin contexto previo.

### Fase 8 (ampliación) — CRUD estructura académica

Implementado: reemplazo de listados genéricos por pantallas con formularios (años lectivos, períodos, niveles, grupos, áreas, materias) en `frontend/src/features/academic-structure/`. Ver tabla de checkpoints en ESTADO-IMPLEMENTACION.md.

### Fase 9 (ampliación) — CRUD personas

Implementado: `frontend/src/features/people/` (docentes, acudientes, usuarios/perfiles, relación estudiante–acudiente, coordinadores de grado) y `StudentFormPage` (`/students/new`, `/students/:id/edit`). Detalle en ESTADO-IMPLEMENTACION.md.

### Fase 10 (ampliación) — CRUD operación escolar

Implementado: `frontend/src/features/operations/` (matrículas, asignaciones docente–curso, escalas de valoración, calificaciones, indicadores académicos, resúmenes de desempeño, asistencia, reportes disciplinarios; generación de libro final e informes de indicadores alineados a `POST` del backend). Ver ESTADO-IMPLEMENTACION.md.

### Fase 11 (ampliación) — Consultas compuestas expedientes

Implementado: en `SchoolRecordsPage` y `AcademicIndicatorsReportsPage`, formulario que llama a los `GET` con path `student_id` + `academic_year_id` / `period_id` del OpenAPI; resultado en pantalla e invalidación del listado. Ver ESTADO-IMPLEMENTACION.md.

### Fase 12 (ampliación) — Code splitting por ruta

Implementado: `React.lazy` para todas las pantallas de feature (`src/routes/lazyPages.ts`); `Suspense` en el `Outlet` de `AdminLayout` y en `/login`; `RoutePageFallback`. Ver ESTADO-IMPLEMENTACION.md.

### Fase 13 (ampliación) — Hidratación del auth persistido

Implementado: `useAuthStoreHydrated` (`useSyncExternalStore` + API `persist` de Zustand) en `ProtectedRoute` y `LoginPage` para no evaluar `access` hasta terminar de leer `localStorage`. Ver ESTADO-IMPLEMENTACION.md.

---

*Última actualización del plan: alineado al schema OpenAPI del repositorio; implementación base del admin descrita en ESTADO-IMPLEMENTACION.md.*
