# Implementacion de i18n en frontend

Esta guia documenta como quedo implementada la internacionalizacion (i18n) en el frontend, usando de momento solo recursos en espanol.

## Stack i18n utilizado

- `i18next`
- `react-i18next`
- Recurso principal: `src/i18n/locales/es.json`

## Archivos clave

- Inicializacion i18n: `src/i18n/index.ts`
- Sincronizacion de idioma en providers: `src/app/providers.tsx`
- Persistencia de idioma: `src/stores/uiStore.ts`
- Resource file de traducciones: `src/i18n/locales/es.json`

## Convenciones de llaves

- Se usa namespace por modulo/pantalla, por ejemplo:
  - `login.*`
  - `adminLayout.*`
  - `students.*`
  - `grades.*`
  - `bulkLoadHub.*`
- Para textos reutilizables se usa `common.*` (`save`, `cancel`, `delete`, `loading`, `none`, etc.).
- En navegacion se usan llaves en configuracion (`nav.*`) en vez de labels hardcodeados.

## Patron recomendado en componentes

1. Importar hook:

```ts
import { useTranslation } from 'react-i18next'
```

2. Obtener funcion de traduccion:

```ts
const { t } = useTranslation()
```

3. Reemplazar literales de UI por `t(...)`:

- `title`, `subtitle`, `label`, `aria-label`
- textos en `Button`, `Alert`, `Dialog`, `TableCell`, etc.

4. Para interpolaciones:

```ts
t('students.detailPrefix', { id })
```

## Idioma por defecto y persistencia

- Idioma por defecto: `es`.
- Fallback: `es`.
- El idioma se persiste en el store de UI (`uiStore`) para mantener preferencia entre sesiones.

## Checklist para nuevos cambios

- No dejar textos visibles hardcodeados en JSX.
- Agregar llaves nuevas en `es.json` en el namespace correcto.
- Reutilizar `common.*` cuando aplique.
- Incluir `aria-label` traducido en icon buttons y controles sin texto.
- Correr lint/build antes de cerrar cambios.

## Alcance actual

- La implementacion esta lista para escalar a multiples idiomas.
- Actualmente solo existe el recurso `es.json`.
- Para agregar un idioma nuevo:
  1. crear `src/i18n/locales/<lang>.json`,
  2. registrarlo en `src/i18n/index.ts`,
  3. habilitar selector de idioma si se requiere en UI.
