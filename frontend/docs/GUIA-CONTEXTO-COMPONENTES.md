# Guía de contexto para nuevos componentes (Frontend)

Esta guía resume decisiones del proyecto para implementar componentes nuevos sin perder consistencia visual, de datos y de UX.

## 1) Stack y convenciones base

- Framework: React + TypeScript + Vite.
- UI: MUI (componentes base) + utilidades Tailwind para layout/spacing.
- Estado remoto: TanStack Query.
- Estado local/global: Zustand (`authStore`, `uiStore`).
- Formularios: React Hook Form + Zod.
- Alias de imports: usar `@/` para `src/`.

## 2) Principio de diseño de componentes

- Priorizar componentes de MUI para colores, tipografias, estados disabled y focus.
- Usar clases utilitarias para estructura (`flex`, `gap`, `max-w-*`, `p-*`) y no para colores fijos.
- Evitar hardcodear colores (`text-gray-*`, `bg-gray-*`): usar tokens del tema (`text.secondary`, `background.default`, `action.hover`).

## 3) Tema (day/night) y contraste

La app ya soporta:

- Modo manual via toggle en `AdminLayout`.
- Deteccion de tema del sistema con `prefers-color-scheme`.
- Reaccion automatica a cambios del sistema en runtime.

Referencias:

- `src/app/providers.tsx`: inicializa `ThemeProvider`, sincroniza clase `dark` y escucha cambios del sistema.
- `src/stores/uiStore.ts`: estado UI persistido (incluye tema).

Reglas:

- Si necesitas color, usa `sx` con tokens MUI.
- Para fondos de paginas, preferir `bgcolor: 'background.default'`.
- Para texto secundario, preferir `color: 'text.secondary'`.
- Verificar contraste en ambos modos (claro/oscuro) antes de cerrar cambios.

## 4) Estructura recomendada de una pagina CRUD

Patron recomendado (ver `src/features/operations/GradesPage.tsx` y otras paginas de `features/operations`):

1. `PageHeader` con titulo/subtitulo.
2. Bloque de filtros en `Paper`.
3. Tabla (`TableContainer` + `Table`) o lista principal.
4. `Dialog` para crear/editar.
5. Mutaciones con invalidacion de query keys.
6. Manejo uniforme de estados:
   - loading: texto o skeleton simple.
   - empty: mensaje "Sin registros."
   - error: `Alert` + `getErrorMessage(error)`.

## 5) Datos y cache (TanStack Query)

- Definir claves en `src/api/queryKeys.ts` y reutilizarlas.
- No duplicar llamadas en componentes si ya existe hook en:
  - `src/features/academic-structure/academicQueries.ts`
  - `src/features/operations/operationsQueries.ts`
- Tras crear/editar/eliminar, invalidar la key correspondiente.
- Mantener `enabled` cuando una query depende de filtros previos (ej: institucion, año, grupo).

## 6) Formularios y validacion

- Esquema Zod cerca del componente o en modulo compartido si se reutiliza.
- Usar `zodResolver`.
- Campos complejos (`Autocomplete`, `Select`) con `Controller`.
- Mensajes de error visibles en `helperText`.
- Evitar logica de negocio dispersa en JSX; extraer helpers para transformaciones.

## 7) Accesibilidad minima obligatoria

- `aria-label` en `IconButton` sin texto visible.
- Labels reales en `TextField`/`Select`.
- Estados disabled explicitos cuando falte contexto (ej: sin año seleccionado).
- No usar solo color para comunicar estado; combinar con texto.

## 8) Navegacion, permisos y layout

- Shell principal: `src/layouts/AdminLayout.tsx`.
- Reglas de acceso:
  - `src/app/roleMatrix.ts`
  - `src/app/navConfig.ts`
  - `src/app/routeAccess.ts`
- Si una ruta no esta permitida, se muestra `AccessDeniedContent` (no redireccion silenciosa).

## 9) Checklist rapido antes de crear PR

- El componente se ve bien en modo claro y oscuro.
- No hay colores hardcodeados que rompan contraste.
- Se usan query keys existentes o se agrega una nueva consistente.
- Errores API pasan por `getErrorMessage`.
- Se agregaron `aria-label`/labels donde aplica.
- `bun run lint` y `bun run build` sin errores.

## 10) Dónde mirar ejemplos

- Layout y barra superior: `src/layouts/AdminLayout.tsx`
- Pantalla con filtros + tabla + dialogo complejo: `src/features/operations/GradesPage.tsx`
- Formularios de personas: `src/features/people/*.tsx`
- Estados de acceso por rol: `src/components/AccessDeniedContent.tsx`
- Carga masiva con resumen de errores: `src/features/bulk/BulkLoadResultSummary.tsx`

