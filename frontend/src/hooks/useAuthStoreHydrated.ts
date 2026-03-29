import { useSyncExternalStore } from 'react'

import { useAuthStore } from '@/stores/authStore'

function subscribe(onStoreChange: () => void) {
  return useAuthStore.persist.onFinishHydration(onStoreChange)
}

function getSnapshot() {
  return useAuthStore.persist.hasHydrated()
}

/** SSR / generación estática: asumimos no hidratado hasta el cliente. */
function getServerSnapshot() {
  return false
}

/**
 * Indica si el slice persistido de `authStore` ya se aplicó desde `localStorage`.
 * Hasta entonces `access`/`user` están en valores iniciales y no deben usarse para redirigir.
 */
export function useAuthStoreHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
