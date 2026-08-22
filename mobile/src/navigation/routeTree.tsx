import { useEffect, useState } from "react"
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom"

import { getErrorMessage } from "@/api/errors"
import { useAuthStore } from "@/auth/authStore"
import { useMeQuery } from "@/features/auth/meApi"
import {
  AccessDeniedScreen,
  BootstrapErrorScreen,
  FaceAuthCallbackScreen,
  LoginScreen,
  SplashScreen,
} from "@/screens"
import {
  TeacherSessionProvider,
  useBootstrapStatus,
  useTeacherSession,
} from "@/session/TeacherSessionContext"
import { isTeacherUser } from "@/types/user"

import { AppShell } from "./AppShell"
import {
  BulletinPage,
  CourseDetailPage,
  CoursesPage,
  GradeActivityPage,
  GroupPage,
  IndicatorsEditorPage,
  IndicatorsReportPage,
  MorePage,
  PeriodGradesPage,
  RecoveriesPage,
  RollCallPage,
  SchemePlanPage,
  SchoolRecordPage,
  StudentProfilePage,
  TodayPage,
} from "./pages"
import { routes } from "./routes"
import { useLogout } from "./useAppNav"

function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  )
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() =>
      setHydrated(true),
    )
    return unsub
  }, [])
  return hydrated
}

function loginRedirect(from?: { pathname: string; search: string }) {
  if (
    from &&
    from.pathname !== routes.login() &&
    from.pathname !== routes.authCallback()
  ) {
    return `${from.pathname}${from.search}`
  }
  return routes.today()
}

function LoginRoute() {
  const hydrated = useAuthHydrated()
  const access = useAuthStore((s) => s.access)
  const location = useLocation()
  if (!hydrated) return <SplashScreen />
  if (access) {
    const from = (location.state as {
      from?: { pathname: string; search: string }
    })?.from
    return <Navigate to={loginRedirect(from)} replace />
  }
  const error = (location.state as { error?: string })?.error
  return <LoginScreen initialError={error} />
}

function FaceAuthCallbackRoute() {
  const hydrated = useAuthHydrated()
  const access = useAuthStore((s) => s.access)
  const navigate = useNavigate()
  if (!hydrated) return <SplashScreen />
  if (access) return <Navigate to={routes.today()} replace />
  return (
    <FaceAuthCallbackScreen
      onError={(message) => {
        navigate(routes.login(), { replace: true, state: { error: message } })
      }}
      onSuccess={() => {
        navigate(routes.today(), { replace: true })
      }}
    />
  )
}

function RequireAuth() {
  const hydrated = useAuthHydrated()
  const access = useAuthStore((s) => s.access)
  const location = useLocation()
  if (!hydrated) return <SplashScreen />
  if (!access) {
    return <Navigate to={routes.login()} replace state={{ from: location }} />
  }
  return <Outlet />
}

function TeacherGate() {
  const access = useAuthStore((s) => s.access)
  const meQuery = useMeQuery(Boolean(access))
  const me = meQuery.data
  const bootstrap = useBootstrapStatus(isTeacherUser(me) ? me : undefined)
  const onLogout = useLogout()

  if (meQuery.isLoading || meQuery.isPending) {
    return <SplashScreen message="Cargando perfil…" />
  }
  if (meQuery.isError || !me) {
    return (
      <BootstrapErrorScreen
        message={getErrorMessage(meQuery.error, "No se pudo leer tu perfil.")}
        onRetry={() => void meQuery.refetch()}
        onLogout={onLogout}
      />
    )
  }
  if (!isTeacherUser(me)) {
    return <AccessDeniedScreen onLogout={onLogout} />
  }
  if (bootstrap.isLoading) {
    return <SplashScreen message="Cargando tus cursos…" />
  }
  if (bootstrap.isError) {
    return (
      <BootstrapErrorScreen
        message={getErrorMessage(
          bootstrap.error,
          "No se pudieron cargar tus cursos.",
        )}
        onRetry={bootstrap.refetch}
        onLogout={onLogout}
      />
    )
  }
  if (!bootstrap.academicYear) {
    return (
      <BootstrapErrorScreen
        message="No hay un año lectivo activo en tu institución. Pide a coordinación que lo configure."
        onRetry={bootstrap.refetch}
        onLogout={onLogout}
      />
    )
  }

  return (
    <TeacherSessionProvider me={me}>
      <Outlet />
    </TeacherSessionProvider>
  )
}

function DirectorGuard() {
  const { isDirector } = useTeacherSession()
  if (!isDirector) return <Navigate to={routes.today()} replace />
  return <Outlet />
}

function RootRedirect() {
  const hydrated = useAuthHydrated()
  const access = useAuthStore((s) => s.access)
  if (!hydrated) return <SplashScreen />
  if (!access) return <Navigate to={routes.login()} replace />
  return <Navigate to={routes.today()} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/auth/callback" element={<FaceAuthCallbackRoute />} />
      <Route element={<RequireAuth />}>
        <Route element={<TeacherGate />}>
          <Route element={<AppShell />}>
            <Route path="today" element={<TodayPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:courseId" element={<CourseDetailPage />} />
            <Route
              path="courses/:courseId/roll-call"
              element={<RollCallPage />}
            />
            <Route
              path="courses/:courseId/activities/:activityId"
              element={<GradeActivityPage />}
            />
            <Route
              path="courses/:courseId/period-grades"
              element={<PeriodGradesPage />}
            />
            <Route
              path="courses/:courseId/recoveries"
              element={<RecoveriesPage />}
            />
            <Route path="courses/:courseId/plan" element={<SchemePlanPage />} />
            <Route
              path="courses/:courseId/students/:studentId"
              element={<StudentProfilePage />}
            />
            <Route
              path="courses/:courseId/students/:studentId/indicators"
              element={<IndicatorsEditorPage />}
            />
            <Route path="more" element={<MorePage />} />
            <Route element={<DirectorGuard />}>
              <Route path="group" element={<GroupPage />} />
              <Route
                path="group/students/:studentId"
                element={<StudentProfilePage />}
              />
              <Route
                path="group/students/:studentId/indicators"
                element={<IndicatorsEditorPage />}
              />
              <Route path="group/bulletin" element={<BulletinPage />} />
              <Route
                path="group/bulletin/:studentId"
                element={<BulletinPage />}
              />
              <Route
                path="group/indicators/:studentId"
                element={<IndicatorsReportPage />}
              />
              <Route
                path="group/school-record/:studentId"
                element={<SchoolRecordPage />}
              />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
