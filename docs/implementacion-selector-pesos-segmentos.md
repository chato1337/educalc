# Implementación: selector multi-divisor de pesos

**Proyecto:** eduCalc  
**Fecha:** Agosto 2026  
**Estado:** Implementado en mobile · Pendiente de portar al admin (`frontend/`)  
**Relacionado con:** [modulo-gestion-calificaciones-por-actividades.md](./modulo-gestion-calificaciones-por-actividades.md), [modulo-planeacion-actividades.md](./modulo-planeacion-actividades.md), [plan-malla-calificacion-actividades.md](./plan-malla-calificacion-actividades.md)

Este documento describe el range con varios selectores (divisores arrastrables) para que se pueda **reutilizar la misma lógica** en el admin sin redescubrir el modelo, las trampas de persistencia ni el contrato de API.

---

## Resumen

Barra horizontal que representa **100%**. Cada tramo es un ítem con peso. Entre tramos hay un handle. Arrastrar el handle `i` mueve peso **solo entre vecinos** (`i` e `i+1`); el total no cambia.

En mobile se usa para **segmentos de un componente** (Evaluaciones / Talleres / …) dentro del plan del docente. El admin puede reutilizar el mismo control en dos sitios:

| Superficie admin | Entidad | Quién edita | Archivo actual (TextField) |
|------------------|---------|-------------|----------------------------|
| Esquema → Estructura | `ComponentSegment.weight_percent` | Docente / staff | `frontend/src/features/operations/GradingSchemeStructurePanel.tsx` |
| Asignatura → Componentes | `SubjectComponent.weight_percent` | Solo admin | `frontend/src/features/academic-structure/SubjectComponentsDialog.tsx` |

Los **componentes de catálogo** son solo lectura para el docente. En mobile el selector **no** los mueve. En admin sí se pueden editar; el mismo widget sirve si la lista suma 100%.

---

## Cuándo mostrarlo

| Condición | UI |
|-----------|----|
| 2+ ítems y suma ≈ 100% (`remaining ≤ 0.01`) | Barra con N−1 handles |
| Hay restante (`remaining > 0.01`) | Flujo actual: chips / formulario / input de peso |
| 1 ítem al 100% | Sin handle. Dejar el input de peso para bajarlo, liberar restante y añadir otro |

Constante de tolerancia (backend y clientes): `WEIGHT_SUM_TOLERANCE = 0.01`.

Mobile:

```ts
canResizeSegmentWeights(segmentCount, remaining)
// true si segmentCount >= 2 && remaining <= 0.01
```

---

## Modelo mental

```
pesos        [25, 25, 50]
fronteras    [25, 50, 100]     // última siempre 100
handles      ↑    ↑            // índices 0 .. n-2
```

Mover el primer handle a 30 → fronteras `[30, 50, 100]` → pesos `[30, 20, 50]`.

No usar `<input type="range">` nativo: un solo thumb. El control es un `div` + pointer events.

---

## Matemática (portable, sin React)

Fuente de verdad actual: `mobile/src/features/grading/planUtils.ts`.

Al portar al admin, **copiar estas funciones tal cual** (o extraerlas a un paquete compartido). No reimplementar el snap a ojo.

| Función | Entrada | Salida |
|---------|---------|--------|
| `boundariesFromWeights(weights)` | `[w0, w1, …]` | Fronteras acumuladas; la última es `100` |
| `weightsFromBoundaries(boundaries)` | Fronteras | Pesos; `weights[i] = boundary[i] − boundary[i−1]` |
| `moveBoundary(boundaries, handleIndex, rawPercent, { minWeight, step })` | Frontera cruda | Nueva lista de fronteras |
| `applyBoundaryMove(items, handleIndex, rawPercent, options)` | Ítems `{ weight }` | Ítems con pesos actualizados |

Reglas de `moveBoundary`:

1. Handle `i` está acotado por el vecino izquierdo + `minWeight` y el derecho − `minWeight`.
2. Snap a `step` (mobile: **5**).
3. Mínimo por tramo (mobile: **5**), igual que el `RangeField` del formulario.
4. Si la grilla no cabe entre vecinos (pesos legacy fuera de 5%), clamp sin forzar snap.

```ts
export const SEGMENT_WEIGHT_STEP = 5
export const SEGMENT_WEIGHT_MIN = 5

// [25, 25, 50] → [25, 50, 100]
boundariesFromWeights([25, 25, 50])

// handle 0 a 30 → [30, 50, 100] → [30, 20, 50]
applyBoundaryMove(items, 0, 30)
```

Conversión pointer → porcentaje:

```ts
((clientX - barRect.left) / barRect.width) * 100
```

---

## Contrato del componente UI

Referencia: `mobile/src/features/grading/SegmentWeightRange.tsx`.

```ts
type SegmentWeightItem = {
  id: string
  name: string
  weight: number
}

type Props = {
  segments: SegmentWeightItem[]
  minWeight?: number   // default 5
  step?: number        // default 5
  disabled?: boolean
  onChange?: (next: SegmentWeightItem[]) => void   // cada movimiento
  onCommit?: (next: SegmentWeightItem[]) => void | Promise<void>  // soltar / tecla
}
```

El componente es **controlado por props** pero mantiene un **draft local** mientras se arrastra o se guarda. No sincronizar el draft con props en cada render: el padre suele pasar un array nuevo y eso provoca flicker (ver más abajo).

### Interacción

- **Pointer:** `setPointerCapture`, `touch-action: none` en el handle (para no pelear con el scroll).
- **Teclado:** handle es `role="slider"`; `ArrowLeft` / `ArrowRight` ± step; `Home` / `End` a los extremos legales.
- **Labels:** porcentaje siempre; nombre solo si el tramo es ancho (≥ ~18%).
- **Handles:** hermanos del track, no hijos de un `overflow-hidden` (si no, se recortan).

### Persistencia al soltar (no en cada pixel)

1. Draft optimista mientras se arrastra.
2. `onCommit` solo de los ítems cuyo peso cambió (casi siempre 2).
3. Loader overlay hasta que termina el PATCH + invalidación.
4. Si falla: revertir draft y mostrar error.

No hay endpoint bulk. Cada ítem es un `PATCH` independiente. El backend **no** exige suma 100% en cada PATCH (solo 0–100). La suma se valida después (`GET /api/grading-schemes/{id}/validate-weights/`). Un PATCH intermedio puede dejar la suma ≠ 100% un instante; es el contrato actual.

```
PATCH /api/component-segments/{id}/
Body: { "weight_percent": "30.00" }

PATCH /api/subject-components/{id}/   // solo admin; mismo shape de peso
Body: { "weight_percent": "60.00" }
```

Formato: string con 2 decimales (`toFixed(2)`), igual que el resto de pesos.

Mobile hace los PATCH en paralelo:

```ts
Promise.all(updates.map((u) => patchComponentSegment(u.id, { weight_percent: u.weight_percent })))
```

Luego **una sola** invalidación de queries (no invalidar por cada PATCH).

---

## Evitar flicker (obligatorio al portar)

Síntoma: al soltar, la barra vuelve un instante al valor viejo y luego salta al nuevo.

Causa: `mutateAsync` resuelve, `invalidateQueries` es asíncrono, el padre re-renderiza con la **caché vieja**, y un `useEffect([segments])` pisa el draft.

Mitigación (las tres juntas):

1. **No pisar el draft** mientras `saving` o mientras se espera que las props coincidan con el draft (`awaitingServer`). Comparar por valor (`id` + peso ± 0.01), no por identidad del array.
2. **Optimistic cache** en `onMutate`: escribir los nuevos `weight_percent` en el bundle/listado **antes** del refetch. En error, restaurar el snapshot.
3. **Loader** sobre la barra (`saving === true`) y handles deshabilitados hasta `onSettled`. En mobile se espera a que `invalidateQueries` termine para quitar el loader.

Referencia de mutación: `usePatchSegmentWeightsMutation` en `mobile/src/features/grading/gradingApi.ts`.

```ts
onMutate: cancelQueries → snapshot → setQueriesData (pesos nuevos)
onError:  restaurar snapshot
onSettled: await invalidateQueries (grading + segments + schemes)
```

---

## Archivos mobile (referencia)

| Archivo | Rol |
|---------|-----|
| `mobile/src/features/grading/planUtils.ts` | Matemática pura + `canResizeSegmentWeights` |
| `mobile/src/features/grading/SegmentWeightRange.tsx` | UI (draft, pointer, teclado, loader) |
| `mobile/src/features/grading/gradingApi.ts` | `patchSegmentWeights` + mutación optimista |
| `mobile/src/features/grading/SchemePlanScreen.tsx` | Cableado: mostrar si 2+ segmentos y suma 100%; lápiz solo-nombre en ese modo |

El `RangeField` de un solo thumb (`mobile/src/components.tsx`) se mantiene para **crear** segmentos o editar cuando hay restante / un solo segmento.

---

## Cómo portarlo al admin

No extraer a un paquete ahora. Al implementar en `frontend/`:

1. Copiar `boundariesFromWeights`, `weightsFromBoundaries`, `moveBoundary`, `applyBoundaryMove` y las constantes `MIN` / `STEP` / `TOLERANCE` a un util del admin (p. ej. `frontend/src/features/operations/weightRangeMath.ts`). No duplicar lógica distinta.
2. Reimplementar la barra con **MUI** (`Box`, `Typography`, `CircularProgress`) manteniendo el mismo contrato `value` / `onChange` / `onCommit`. No hace falta Tailwind.
3. **Segmentos:** insertar el control en `GradingSchemeStructurePanel` por componente, con la misma guarda `segmentos.length >= 2 && remaining ≈ 0`. El diálogo de editar segmento puede dejar de pedir peso en ese modo (solo nombre / descripción).
4. **Componentes de catálogo (opcional, solo admin):** el mismo control en `SubjectComponentsDialog` cuando hay 2+ componentes que ya suman 100%. Aquí el PATCH es `/api/subject-components/{id}/`.
5. Reutilizar `queryKeys` y `patchComponentSegment` / `patchSubjectComponent` ya existentes. Añadir `onMutate` optimista sobre la query que alimenta el panel (`component-segments` o `subject-components`).
6. i18n: el admin usa `useTranslation`. Textos sugeridos: `grading.weightRange.hint` («Arrastra los divisores para repartir el 100%»), `grading.weightRange.saving`, `grading.weightRange.handle` («Divisor entre {{left}} y {{right}}»).
7. No cambiar backend. No hace falta endpoint bulk.

### Checklist de port

- [ ] Matemática copiada, no reescrita
- [ ] Snap 5% y mínimo 5% (o documentar si el admin usa otro step)
- [ ] Commit al soltar, no en cada `pointermove`
- [ ] PATCH solo de los pesos que cambiaron
- [ ] Optimistic cache + rollback
- [ ] Draft no se pisa con props stale
- [ ] Loader durante la petición
- [ ] Hidden si hay restante o hay un solo ítem
- [ ] Validación visual de suma 100% sigue usando `validate-weights`

---

## Qué no hacer

- No poner pesos en `GradingActivity` (promedio simple dentro del segmento).
- No permitir al docente PATCH de `SubjectComponent` desde mobile ni desde el panel de esquema.
- No validar suma 100% en el serializer de un PATCH individual (rompería el update de dos vecinos).
- No usar un slider nativo de dos thumbs: no escala a N segmentos.

---

## Ejemplo de cableado (pseudo)

```tsx
const remaining = 100 - sum(segments.map(s => Number(s.weight_percent)))
const canResize = segments.length >= 2 && remaining <= 0.01

{canResize && (
  <WeightRange
    segments={segments.map(s => ({
      id: s.id,
      name: s.name,
      weight: Number(s.weight_percent),
    }))}
    disabled={busy}
    onCommit={async (next) => {
      const updates = next.filter((item) => {
        const prev = segments.find(s => s.id === item.id)
        return Math.abs(Number(prev?.weight_percent) - item.weight) > 0.01
      })
      if (updates.length === 0) return
      await patchWeights(updates.map(u => ({
        id: u.id,
        weight_percent: u.weight.toFixed(2),
      })))
    }}
  />
)}
```
