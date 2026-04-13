import type { GridSortModel } from '@mui/x-data-grid'

/**
 * Sincroniza `sortModel` del DataGrid con el query param `ordering` del backend
 * (p. ej. `student__full_name`, `-generated_at`).
 *
 * `gridFieldToApiField`: campo `field` de la columna → segmento sin prefijo `-`.
 */
export function createServerSortHandlers(
  gridFieldToApiField: Record<string, string>,
) {
  function orderingToSortModel(ordering: string): GridSortModel {
    if (!ordering) return []
    const desc = ordering.startsWith('-')
    const key = desc ? ordering.slice(1) : ordering
    const field = Object.keys(gridFieldToApiField).find(
      (f) => gridFieldToApiField[f] === key,
    )
    if (!field) return []
    return [{ field, sort: desc ? 'desc' : 'asc' }]
  }

  function sortModelToOrdering(model: GridSortModel): string {
    const item = model[0]
    if (!item?.sort) return ''
    const apiKey = gridFieldToApiField[item.field]
    if (!apiKey) return ''
    return item.sort === 'desc' ? `-${apiKey}` : apiKey
  }

  return { orderingToSortModel, sortModelToOrdering }
}
