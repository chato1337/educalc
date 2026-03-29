import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { RoutePageFallback } from '@/components/RoutePageFallback'
import { useAuthStoreHydrated } from '@/hooks/useAuthStoreHydrated'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute() {
  const hydrated = useAuthStoreHydrated()
  const access = useAuthStore((s) => s.access)
  const location = useLocation()

  if (!hydrated) {
    return <RoutePageFallback />
  }

  if (!access) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
