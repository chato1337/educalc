import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  AppBar,
  Autocomplete,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useMemo } from 'react'
import {
  matchPath,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { APP_NAME } from '@/app/appName'
import { filterNavSectionsForRole, navSections } from '@/app/navConfig'
import { requiredRolesForPathname } from '@/app/routeAccess'
import {
  appRoleLabelEs,
  resolvedAppRole,
  roleMayAccess,
} from '@/app/roleMatrix'
import { AccessDeniedContent } from '@/components/AccessDeniedContent'
import { RoutePageFallback } from '@/components/RoutePageFallback'
import { fetchMe } from '@/features/auth/meApi'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { Institution } from '@/types/schemas'

const drawerWidth = 280

/** Rutas con pantallas hijas: el ítem del menú sigue «activo» en subrutas. */
const NAV_PREFIX_MATCH_PATHS = new Set(['/students', '/groups'])

export function AdminLayout() {
  const theme = useTheme()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const drawerOpen = useUiStore((s) => s.drawerOpen)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const setSelectedInstitutionId = useUiStore(
    (s) => s.setSelectedInstitutionId,
  )

  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  })

  const { data: institutions = [] } = useQuery({
    queryKey: queryKeys.institutions(),
    queryFn: async () => {
      const { data } = await apiClient.get<Institution[]>('/api/institutions/')
      return data
    },
  })

  useEffect(() => {
    if (isMobile) setDrawerOpen(false)
  }, [isMobile, setDrawerOpen])

  const effectiveRole = useMemo(
    () => resolvedAppRole(me?.role ?? user?.role),
    [me?.role, user?.role],
  )

  const navSectionsFiltered = useMemo(
    () => filterNavSectionsForRole(navSections, effectiveRole),
    [effectiveRole],
  )

  const requiredRoles = requiredRolesForPathname(location.pathname)
  const routeAllowed = roleMayAccess(
    effectiveRole,
    requiredRoles ?? undefined,
  )
  const routeBlocked = requiredRoles != null && !routeAllowed

  const currentUserLabel = me?.username ?? user?.username ?? 'Usuario'

  const selectedInstitution =
    institutions.find((i) => i.id === selectedInstitutionId) ?? null

  const drawer = (
    <Box className="flex flex-col h-full">
      <Toolbar className="justify-center">
        <Typography variant="h6" noWrap>
          {APP_NAME} Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List component="nav" dense className="flex-1 overflow-auto py-0">
        {navSectionsFiltered.map((section) => (
          <Box key={section.title}>
            <ListItemText
              primary={section.title}
              primaryTypographyProps={{
                className:
                  'px-3 pt-2 pb-0 text-xs font-semibold text-gray-500 uppercase tracking-wide',
              }}
            />
            {section.items.map((item) => {
              const Icon = item.icon
              const linkEnd = !NAV_PREFIX_MATCH_PATHS.has(item.path)
              const navActive =
                matchPath(
                  { path: item.path, end: linkEnd },
                  location.pathname,
                ) != null
              return (
                <ListItemButton
                  key={item.path}
                  component={NavLink}
                  to={item.path}
                  end={linkEnd}
                  selected={navActive}
                  className="rounded-lg mx-1"
                  onClick={() => isMobile && setDrawerOpen(false)}
                >
                  {Icon ? (
                    <ListItemIcon className="min-w-10">
                      <Icon fontSize="small" />
                    </ListItemIcon>
                  ) : null}
                  <ListItemText primary={item.label} />
                </ListItemButton>
              )
            })}
          </Box>
        ))}
      </List>
    </Box>
  )

  return (
    <Box className="flex min-h-screen w-full">
      <AppBar
        position="fixed"
        sx={{
          width: {
            md: drawerOpen
              ? `calc(100% - ${drawerWidth}px)`
              : '100%',
          },
          ml: { md: drawerOpen ? `${drawerWidth}px` : 0 },
        }}
      >
        <Toolbar className="gap-2 flex-wrap">
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label={
              drawerOpen
                ? isMobile
                  ? 'Cerrar menú'
                  : 'Ocultar menú lateral'
                : isMobile
                  ? 'Abrir menú'
                  : 'Mostrar menú lateral'
            }
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="body2" className="flex-1 min-w-[120px]">
            {currentUserLabel}
            <Box component="span" sx={{ opacity: 0.85 }}>
              {` · ${appRoleLabelEs(effectiveRole)}`}
            </Box>
          </Typography>
          <Autocomplete
            size="small"
            className="min-w-[200px] max-w-full flex-1 md:flex-none md:min-w-[260px]"
            options={institutions}
            getOptionLabel={(o) => o.name}
            value={selectedInstitution}
            onChange={(_, v) => setSelectedInstitutionId(v?.id ?? null)}
            renderInput={(params) => renderInstitutionField(params)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
          <IconButton
            color="inherit"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            aria-label="Cerrar sesión"
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="nav" aria-label="Navegación principal">
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            flexShrink: 0,
            // Ancho 0 al cerrar: el docked no debe reservar 280px si el paper ya salió.
            ...(!isMobile && {
              width: drawerOpen ? drawerWidth : 0,
              overflow: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
            }),
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {isMobile ? (
            <Toolbar className="flex justify-end">
              <IconButton
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
              >
                <ChevronLeftIcon />
              </IconButton>
            </Toolbar>
          ) : null}
          {drawer}
        </Drawer>
      </Box>

      {/* Sin margin-left extra: el Drawer persistente ya reserva ancho en la fila flex. */}
      <Box
        component="main"
        className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900"
        sx={{ flexGrow: 1, p: 0, mt: 8 }}
      >
        <Suspense fallback={<RoutePageFallback />}>
          {routeBlocked && requiredRoles ? (
            <AccessDeniedContent
              pathname={location.pathname}
              effectiveRole={effectiveRole}
              requiredRoles={requiredRoles}
              onGoDashboard={() => navigate('/dashboard', { replace: true })}
            />
          ) : (
            <Outlet />
          )}
        </Suspense>
      </Box>
    </Box>
  )
}

function renderInstitutionField(params: AutocompleteRenderInputParams) {
  return (
    <TextField
      {...params}
      label="Institución"
      placeholder="Todas"
      slotProps={{
        htmlInput: {
          ...params.inputProps,
          'aria-label': 'Filtrar por institución',
        },
      }}
    />
  )
}
