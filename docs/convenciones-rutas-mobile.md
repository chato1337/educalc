# Convenciones de rutas — app docente (`mobile/`)

**Audiencia:** desarrolladores y agentes de IA que añadan pantallas o flujos en la app docente.  
**Producto:** eduCalc mobile (Vite + React 19 + React Router 7).  
**Última actualización:** agosto 2026.

La URL es la **máquina de estados de navegación**. Recargar, compartir un link o usar atrás del sistema debe restaurar el mismo lugar. No hay store de navegación (el antiguo `navStore` de Zustand ya no existe).

---

## 1. Contrato (obligatorio)

| Capa | Pregunta que responde | Ejemplos |
|------|------------------------|----------|
| **Path** | *¿Dónde está el docente?* Tab + recurso + pantalla. | `/courses/:courseId/roll-call`, `/group/students/:studentId` |
| **Query** | *¿Cómo se ve ese lugar?* No crea una pantalla nueva. | `?section=activities`, `?tab=review`, `?origin=group&date=2026-08-22` |
| **Fuera de la URL** | Contexto de sesión, drafts y UI efímera. | Periodo lectivo, búsqueda, formularios, mes del calendario, drafts de llamado |

Reglas:

1. **Un lugar = un path.** Si el usuario “entra” a otra pantalla, cambia el path. Si solo cambia una pestaña o un filtro de esa pantalla, cambia el query.
2. **IDs en el path, no en el query.** `courseId`, `studentId`, `activityId` son segmentos.
3. **Nombres y display no van en la URL.** `studentName` se resuelve por API (`useStudentQuery` / matrícula).
4. **El periodo lectivo no va en la URL.** Vive en `sessionPrefsStore` (`selectedPeriodId`). Es contexto global, no ubicación.
5. **Nunca construir strings de ruta a mano en pantallas.** Usar builders de `routes` en [`mobile/src/navigation/routes.ts`](../mobile/src/navigation/routes.ts).

---

## 2. Mapa de archivos

| Archivo | Rol |
|---------|-----|
| [`mobile/src/navigation/types.ts`](../mobile/src/navigation/types.ts) | Uniones de tabs/secciones y listas permitidas |
| [`mobile/src/navigation/routes.ts`](../mobile/src/navigation/routes.ts) | Builders `routes.*`, parsers de query, inspectores de path |
| [`mobile/src/navigation/parentOf.ts`](../mobile/src/navigation/parentOf.ts) | Padre canónico cuando no hay historial interno |
| [`mobile/src/navigation/useAppNav.ts`](../mobile/src/navigation/useAppNav.ts) | `go` / `replace` / `back` / `useLogout` |
| [`mobile/src/navigation/pages.tsx`](../mobile/src/navigation/pages.tsx) | Wrappers: leen URL y pasan props a pantallas |
| [`mobile/src/navigation/AppShell.tsx`](../mobile/src/navigation/AppShell.tsx) | Layout phone (stack + tab bar) y tablet (rail + master + detail) |
| [`mobile/src/navigation/routeTree.tsx`](../mobile/src/navigation/routeTree.tsx) | Auth, `TeacherGate`, `DirectorGuard`, `<Routes>` |
| [`mobile/src/navigation/index.ts`](../mobile/src/navigation/index.ts) | API pública del módulo |

Las pantallas de feature (`RollCallScreen`, `GroupScreen`, …) siguen siendo **presentacionales**: reciben valor + callback, no importan el router.

---

## 3. Catálogo de rutas

Defaults de query **se omiten** del string (el parser los aplica al leer). Si el valor no es el default, sí va en la URL.

| Path | Query | Default omitido | Builder |
|------|-------|-----------------|--------|
| `/login` | — | — | `routes.login()` |
| `/auth/callback` | `token` (Face-Auth, se consume y se reemplaza) | — | `routes.authCallback()` |
| `/today` | — | — | `routes.today()` |
| `/courses` | — | — | `routes.courses()` |
| `/courses/:courseId` | `section` | `attendance` | `routes.course(id, { section })` |
| `/courses/:courseId/roll-call` | `origin`, `date` | `origin=subject`; `date` solo si el usuario la elige | `routes.rollCall(id, { origin, date })` |
| `/courses/:courseId/activities/:activityId` | — | — | `routes.gradeActivity(courseId, activityId)` |
| `/courses/:courseId/period-grades` | `tab` | `suggested` | `routes.periodGrades(id, { tab })` |
| `/courses/:courseId/recoveries` | — | — | `routes.recoveries(id)` |
| `/courses/:courseId/plan` | `view` | `estructura` | `routes.schemePlan(id, { view })` |
| `/courses/:courseId/students/:studentId` | `tab` | `grades` | `routes.courseStudent(courseId, studentId, { tab })` |
| `/courses/:courseId/students/:studentId/indicators` | — | — | `routes.courseStudentIndicators(courseId, studentId)` |
| `/group` | `tab`, `pick` | `tab=rollCall`; `pick` solo en informes | `routes.group({ tab, pick })` |
| `/group/students/:studentId` | `tab` | `grades` | `routes.groupStudent(studentId, { tab })` |
| `/group/students/:studentId/indicators` | — | — | `routes.groupStudentIndicators(studentId)` |
| `/group/bulletin` | — | — | `routes.groupBulletin()` |
| `/group/bulletin/:studentId` | — | — | `routes.groupBulletin(studentId)` |
| `/group/indicators/:studentId` | — | — | `routes.groupIndicators(studentId)` |
| `/group/school-record/:studentId` | — | — | `routes.groupSchoolRecord(studentId)` |
| `/more` | — | — | `routes.more()` |
| `/` y `*` | — | redirigen a `/today` o `/login` | — |

Valores permitidos:

| Query / tipo | Valores |
|--------------|---------|
| `CourseSection` (`section`) | `attendance` \| `activities` \| `grades` \| `students` |
| `GroupTab` (`tab` en `/group`) | `rollCall` \| `ranking` \| `disciplinary` \| `reports` |
| `ReportPick` (`pick`) | `bulletin` \| `indicators` \| `record` |
| `StudentProfileTab` (`tab` en perfil) | `grades` \| `attendance` \| `indicators` \| `disciplinary` \| `family` |
| `PeriodGradesTab` | `suggested` \| `review` |
| `PlanView` (`view`) | `estructura` \| `calendario` |
| `RollCallOrigin` (`origin`) | `subject` \| `group` |

Un query inválido **no revienta**: el parser cae al default (`parseCourseSection`, `parseGroupTab`, …).

---

## 4. Política de historial

Usar [`useAppNav()`](../mobile/src/navigation/useAppNav.ts):

| Acción | Método | Por qué |
|--------|--------|---------|
| Cambiar tab del rail / tab bar | `replace(routes.today() \| courses() \| group() \| more())` | No apilar tabs |
| Cambiar sección de curso, tab de grupo/perfil/notas, vista de plan, fecha/origen de llamado, picker de informes | `replace(...)` | Mismo lugar, otro query |
| Abrir llamado, actividad, plan, perfil, PDF, curso desde la lista o desde Hoy | `go(...)` | Drill-down; atrás debe volver |
| Botón atrás de la UI | `back()` | Historial interno si existe; si no, `parentOf` |
| Logout | `useLogout()` | Limpia query client, prefs, drafts, auth y `replace('/login')` |
| Face-Auth OK | `replace('/today')` | No dejar `?token=` en el historial |
| Face-Auth error | `replace('/login', { state: { error } })` | |

`back()` mira `history.state.idx` de React Router. Si `idx > 0`, hace `navigate(-1)`. Si el usuario recargó (o aterrizó por deep link), `idx` es 0 y se usa el padre canónico.

### Padres canónicos (`parentOf`)

| Path actual | Padre |
|-------------|-------|
| `/courses/:id/roll-call` | `/courses/:id` (sección asistencia) |
| `/courses/:id/activities/:activityId` | `/courses/:id?section=activities` |
| `/courses/:id/plan` | `/courses/:id?section=activities` |
| `/courses/:id/period-grades` | `/courses/:id?section=grades` |
| `/courses/:id/recoveries` | `/courses/:id?section=grades` |
| `/courses/:id/students/:sid/indicators` | `/courses/:id/students/:sid` |
| `/courses/:id/students/:sid` | `/courses/:id?section=students` |
| `/courses/:id` | `/courses` |
| `/group/students/:sid/indicators` | `/group/students/:sid` |
| `/group/students/:sid` | `/group?tab=ranking` |
| `/group/bulletin`, `/group/bulletin/:sid`, `/group/indicators/:sid`, `/group/school-record/:sid` | `/group?tab=reports` |
| Cualquier otro (incl. tabs raíz) | `/today` |

Si añades una pantalla anidada, **añade su fila en `parentOf` en el mismo PR**. El orden de `matchPath` va de más específico a más general.

---

## 5. Phone vs tablet (misma URL)

El path es idéntico. Solo cambia el layout (`< 768 px` phone, `≥ 768 px` tablet).

**Phone**

- El `<Outlet />` es la pantalla completa.
- Tab bar visible en `/today`, `/courses`, `/group`, `/more` y en `/courses/:courseId` (detalle de curso).
- En el resto (llamado, actividad, perfil, PDFs, …) el tab bar se oculta (`phoneShowsTabBar`).

**Tablet**

- Rail = primer segmento (`today` \| `courses` \| `group` \| `more`).
- Master = lista/atajos de ese tab.
- Detail = `<Outlet />`, o `TabletEmptyDetail` si el path es un tab raíz.
- En `/group/...` el master sigue siendo el grupo: el tab se **infiere** del path (`inferGroupTab` / `inferReportPick`) porque el query de `/group` ya no está.

Los atajos de **Hoy** navegan a los **mismos paths de curso** (`/courses/:id/roll-call`, etc.). En tablet el rail pasa a Cursos; el historial permite volver a Hoy.

---

## 6. Auth y guards

```
/login, /auth/callback     → públicos
RequireAuth                → sin token → /login (guarda `state.from`)
TeacherGate                → bootstrap; no-docente → AccessDenied
DirectorGuard              → `/group…` si no es director → /today
/ y *                      → /today o /login
```

Tras login, si había `state.from`, se restaura ese path (deep link). Face-Auth sigo yendo a `/today` (el callback no hereda `from`).

IDs inválidos o fuera de alcance: **no redirigir a Hoy**. Mostrar la pantalla “no encontrado” de la feature (`CourseNotFound`, perfil 404) con CTA `back()`. Un redirect silencioso rompe el deep link.

---

## 7. Qué no va en la URL

| Estado | Dónde vive |
|--------|------------|
| Periodo lectivo (`selectedPeriodId`) | `sessionPrefsStore` |
| Último curso (`lastCourseAssignmentId`) | `sessionPrefsStore` |
| Drafts de llamado | `rollCallDraftStore` |
| Búsqueda de estudiantes | `useState` local |
| Formularios (convivencia, indicadores, segmentos) | `useState` local |
| Mes del calendario del plan | `useState` local |
| Token Face-Auth | se lee una vez y se saca de la URL |

---

## 8. Cómo añadir una pantalla nueva

Checklist. No saltes el builder ni `parentOf`.

1. **¿Path o query?**  
   - Nueva pantalla (el usuario “entra”) → path.  
   - Pestaña/filtro de una pantalla existente → query + parser + default omitido.

2. **Builder** en `routes.ts` y, si aplica, valor en `types.ts` + `parseX` + default.

3. **Ruta** en `routeTree.tsx`. Si es de director de grupo, dentro de `DirectorGuard`.

4. **Page wrapper** en `pages.tsx`: `useParams` / `useSearchParams` → props. Navegación solo con `useAppNav` + `routes.*`.

5. **`parentOf`**: una entrada más específica que sus hermanas.

6. **Pantalla presentacional:** props controladas opcionales (`tab` / `onTabChange`) para no acoplarla al router.

7. **Historial:** `replace` si es el mismo lugar; `go` si es drill-down.

8. **Deep link:** recargar la URL nueva debe pintar la misma UI. ID inválido → empty/404 de la feature, no `/today`.

9. **Hosting:** Vite ya hace fallback en `dev`. En preview/prod hace falta `try_files` (o equivalente) a `index.html`, igual que el admin.

### Ejemplo mínimo

```ts
// 1. builder
schemeExport: (courseId: string) => `/courses/${courseId}/export`,

// 2. parentOf (antes del match genérico /courses/:courseId)
const exp = matchPath("/courses/:courseId/export", pathname)
if (exp?.params.courseId) {
  return routes.course(exp.params.courseId, { section: "grades" })
}

// 3. desde otra pantalla
const { go } = useAppNav()
go(routes.schemeExport(courseId))
```

No hagas esto:

```ts
navigate(`/courses/${id}/export`)           // string suelto
openView({ id: "export", courseId: id })    // navStore ya no existe
setSearchParams({ studentName: "Ana" })     // display no es ubicación
```

---

## 9. Patrones que ya están resueltos

Copia estos, no inventes un segundo router.

| Necesidad | Precedente |
|-----------|------------|
| Drill-down desde Hoy y desde el curso al mismo path | `TodayPage` → `routes.rollCall(id)` / `CourseDetailPage` → lo mismo |
| Query controlado en una pantalla | `PeriodGradesPage` (`tab`), `RollCallPage` (`origin`, `date`), `SchemePlanPage` (`view`) |
| Perfil con dos orígenes (curso vs grupo) | `StudentProfilePage` elige `routes.courseStudent` o `routes.groupStudent` |
| Picker que no es pantalla propia | `/group?tab=reports&pick=bulletin` |
| Master tablet que pierde el query al entrar a un hijo | `inferGroupTab` / `inferReportPick` |
| Logout que no deja basura de sesión | `useLogout` |

El admin (`frontend/`) usa React Router por su cuenta y **no comparte** este catálogo. No reutilices paths de coordinación (`/activity-grading/...`) en mobile.

---

## 10. Criterio de hecho (al revisar un PR de navegación)

- Recargar la URL deja al docente en el mismo lugar.
- Atrás de la UI y atrás del sistema coinciden (o, tras refresh, caen en `parentOf`).
- Hoy, Cursos y Grupo abren llamado / perfil / PDFs por **los mismos paths**.
- Periodo y drafts no aparecen en la URL.
- No hay concatenación de paths fuera de `routes.ts`.
