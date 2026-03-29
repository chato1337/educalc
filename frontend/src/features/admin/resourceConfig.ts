export type ResourceListConfig = {
  /** Segmento de ruta bajo `/` (ej. `academic-years` → `/academic-years`). */
  path: string
  title: string
  apiPath: string
  /** Añade `?institution=<uuid>` si hay institución seleccionada en la barra. */
  institutionParam?: boolean
  /** Campo de búsqueda → `?search=`. */
  search?: boolean
}

/** Recursos que aún usan listado genérico (vacío: todo tiene pantalla dedicada). */
export const resourceListConfigs: ResourceListConfig[] = []

export function getResourceConfig(
  pathSegment: string,
): ResourceListConfig | undefined {
  return resourceListConfigs.find((c) => c.path === pathSegment)
}
