import { useEffect, useRef, useState } from "react"
import type { Course, PerformanceLevel } from "./data"
import { ActivitiesSection } from "@/features/grading/ActivitiesSection"
import { GradesSummarySection } from "@/features/grades/GradesSummarySection"
import { StudentsSection } from "@/features/students/StudentsSection"
import {
  summarizeAttendances,
  useAttendancesQuery,
} from "@/features/attendance/attendancesApi"
import { formatLongDate, todayIso } from "@/session/periodUtils"
import {
  IconCalendar,
  IconPencil,
  IconClipboard,
  IconStar,
  IconAlert,
  IconRefresh,
  IconDocument,
  IconLogout,
  IconChevronRight,
  IconLock,
  IconBook,
  LevelChip,
  Avatar,
  SectionHeader,
  Card,
  EmptyState,
  Pill,
  CourseBadge,
} from "./components"
import { getErrorMessage } from "@/api/errors"
import { useAuthStore } from "@/auth/authStore"
import {
  buildFaceAuthLoginUrl,
  fetchFaceAuthConfig,
  type FaceAuthConfig,
} from "@/features/auth/loginApi"
import {
  useSessionCourse,
  useTeacherSession,
} from "@/session/TeacherSessionContext"
import { APP_NAME } from "@/app/appName"
import type { CourseSection } from "@/navigation"

// ─── Login ────────────────────────────────────────────────────────────────────

export function LoginScreen({ initialError = "" }: { initialError?: string }) {
  const login = useAuthStore((s) => s.login)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [faceAuth, setFaceAuth] = useState<FaceAuthConfig | null>(null)
  const [faceAuthRedirecting, setFaceAuthRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchFaceAuthConfig()
      .then((config) => {
        if (!cancelled) setFaceAuth(config)
      })
      .catch(() => {
        if (!cancelled)
          setFaceAuth({ enabled: false, web_url: null, app_id: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !pass) {
      setError("Ingresa usuario y contraseña.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await login(user.trim(), pass)
    } catch (err) {
      setError(getErrorMessage(err, "Usuario o contraseña incorrectos."))
    } finally {
      setLoading(false)
    }
  }

  const handleFaceAuthLogin = () => {
    if (!faceAuth) return
    const url = buildFaceAuthLoginUrl(faceAuth)
    if (!url) {
      setError("Face-Auth no está disponible en este momento.")
      return
    }
    setFaceAuthRedirecting(true)
    window.location.assign(url)
  }

  const faceAuthEnabled = Boolean(faceAuth?.enabled)

  return (
    <div className="min-h-screen bg-[#1E3A5F] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <IconBook size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-blue-200 text-sm mt-1">
            Registro Escolar · Docente
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-2xl"
        >
          <h2 className="text-base font-semibold text-slate-800 mb-5">
            Iniciar sesión
          </h2>

          {faceAuthEnabled ? (
            <div className="mb-5">
              <button
                type="button"
                disabled={faceAuthRedirecting}
                onClick={handleFaceAuthLogin}
                className="w-full h-11 rounded-lg bg-[#1E3A5F] text-white font-semibold text-sm hover:bg-[#2D5A8E] disabled:opacity-60 transition-colors"
              >
                {faceAuthRedirecting
                  ? "Redirigiendo…"
                  : "Iniciar sesión con Face-Auth"}
              </button>
              <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                o con usuario y contraseña
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="usuario@colegio.edu.co"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-xs">
              <IconAlert size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`mt-5 w-full h-11 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors ${
              faceAuthEnabled
                ? "border border-slate-300 text-slate-800 hover:bg-slate-50"
                : "bg-[#1E3A5F] text-white hover:bg-[#2D5A8E]"
            }`}
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  )
}

export function FaceAuthCallbackScreen({
  onError,
  onSuccess,
}: {
  onError: (message: string) => void
  onSuccess: () => void
}) {
  const loginWithFaceAuthToken = useAuthStore((s) => s.loginWithFaceAuthToken)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")

    if (!token) {
      onError(
        "No se recibió el token de autenticación. Vuelve a iniciar sesión.",
      )
      return
    }

    void loginWithFaceAuthToken(token)
      .then(() => onSuccess())
      .catch((err) => {
        onError(
          getErrorMessage(
            err,
            "No se pudo completar el inicio de sesión biométrico.",
          ),
        )
      })
  }, [loginWithFaceAuthToken, onError, onSuccess])

  return <SplashScreen message="Validando identidad…" />
}

export function SplashScreen({ message = "Cargando…" }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#1E3A5F] flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-12 h-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      <p className="text-sm text-blue-100">{message}</p>
    </div>
  )
}

export function AccessDeniedScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Esta app es solo para docentes
        </h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Tu usuario no tiene perfil de docente. Entra al panel de
          administración o pide a coordinación que te vincule.
        </p>
        <button
          onClick={onLogout}
          className="mt-5 w-full h-11 rounded-lg bg-[#1E3A5F] text-white font-semibold text-sm"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export function BootstrapErrorScreen({
  message,
  onRetry,
  onLogout,
}: {
  message: string
  onRetry: () => void
  onLogout: () => void
}) {
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          No se pudo cargar tu sesión
        </h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
        <button
          onClick={onRetry}
          className="mt-5 w-full h-11 rounded-lg bg-[#1E3A5F] text-white font-semibold text-sm"
        >
          Reintentar
        </button>
        <button
          onClick={onLogout}
          className="mt-2 text-sm text-slate-500 hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function CourseNotFound({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader title="Curso" onBack={onBack} />
      <EmptyState
        icon={<IconBook size={24} />}
        title="Curso no encontrado"
        body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
      />
    </div>
  )
}

// ─── Today (Home) ─────────────────────────────────────────────────────────────

interface TodayProps {
  selectedPeriodId: string
  onSelectPeriod: (id: string) => void
  onGoToRollCall: (courseId: string) => void
  onGoToGradeActivity: (courseId: string) => void
  onGoToPeriodGrades: (courseId: string) => void
  onGoToRecoveries: (courseId: string) => void
  onOpenCourse: (courseId: string) => void
}

export function TodayScreen({
  selectedPeriodId,
  onSelectPeriod,
  onGoToRollCall,
  onGoToGradeActivity,
  onGoToPeriodGrades,
  onGoToRecoveries,
  onOpenCourse,
}: TodayProps) {
  const session = useTeacherSession()
  const period = session.periods.find((p) => p.id === selectedPeriodId)
  const courseId = session.defaultCourseId
  const defaultCourse = session.courses.find((c) => c.id === courseId)
  const pending = session.kpis?.grades_period
  const directorLabel = session.gradeDirectors[0]
    ? `Director · ${session.gradeDirectors[0].group_name}`
    : "Director"
  const courseSub = defaultCourse
    ? `${defaultCourse.subject_name} · ${defaultCourse.group_name}`
    : "Elige un curso"

  const go = (fn: (id: string) => void) => {
    if (!courseId) return
    session.setLastCourseAssignmentId(courseId)
    fn(courseId)
  }

  const quickActions = [
    {
      icon: <IconCalendar size={22} />,
      label: "Llamar a lista",
      sub: courseSub,
      color: "bg-[#EBF2FB] text-[#1E3A5F]",
      onClick: () => go(onGoToRollCall),
    },
    {
      icon: <IconPencil size={22} />,
      label: "Calificar",
      sub: defaultCourse ? defaultCourse.subject_name : "Actividades",
      color: "bg-emerald-50 text-emerald-800",
      onClick: () => go(onGoToGradeActivity),
    },
    {
      icon: <IconClipboard size={22} />,
      label: "Notas del periodo",
      sub: period?.name ?? "Periodo",
      color: "bg-amber-50 text-amber-800",
      onClick: () => go(onGoToPeriodGrades),
    },
    {
      icon: <IconRefresh size={22} />,
      label: "Recuperaciones",
      sub: "Estudiantes en Bajo",
      color: "bg-red-50 text-red-800",
      onClick: () => go(onGoToRecoveries),
    },
  ]

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-[#F1F5F9]">
      {/* Header */}
      <div className="shrink-0 bg-white px-4 pt-4 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-slate-500">Buenos días,</p>
            <h1 className="text-lg font-bold text-slate-900">
              {session.firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {session.isDirector && <Pill color="blue">{directorLabel}</Pill>}
            <Avatar name={session.displayName} size="sm" />
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {session.periods.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPeriod(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                p.id === selectedPeriodId
                  ? "bg-[#1E3A5F] text-white"
                  : p.active
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {p.shortName}
              {p.active && p.id !== selectedPeriodId && (
                <span className="ml-1 w-1 h-1 rounded-full bg-blue-400 inline-block" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {session.truncated && (
          <div className="px-3.5 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
            Se muestran 2000 cursos; hay más asignaciones.
          </div>
        )}
        {session.courses.length === 0 && (
          <EmptyState
            icon={<IconBook size={24} />}
            title="Aún no tienes cursos asignados"
            body="Pide a coordinación que te vincule a un grupo."
          />
        )}

        {pending && pending.pending_slots > 0 && courseId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
              <IconAlert size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Notas pendientes —{" "}
                {pending.academic_period_name || period?.name}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {pending.pending_students} estudiante
                {pending.pending_students === 1 ? "" : "s"} sin nota oficial (
                {pending.filled_slots}/{pending.expected_slots} casillas)
              </p>
            </div>
            <button
              onClick={() => go(onGoToPeriodGrades)}
              className="text-xs font-semibold text-amber-700 shrink-0 hover:underline"
            >
              Ver
            </button>
          </div>
        )}

        {session.courses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-0.5">
              Acciones rápidas
            </p>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className={`${a.color} rounded-xl p-4 text-left hover:opacity-90 active:scale-[0.98] transition-all`}
                >
                  <div className="mb-3">{a.icon}</div>
                  <p className="text-sm font-semibold leading-tight">
                    {a.label}
                  </p>
                  <p className="text-xs opacity-70 mt-0.5">{a.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {session.courses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-0.5">
              Mis cursos ·{" "}
              {new Date().toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </p>
            <div className="space-y-2">
              {session.courses.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    session.setLastCourseAssignmentId(c.id)
                    onOpenCourse(c.id)
                  }}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-slate-300 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center p-3.5 gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EBF2FB] flex items-center justify-center shrink-0">
                      <span className="text-[#1E3A5F] font-bold text-xs">
                        {c.group_name}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {c.subject_name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {c.group_grade_level_name} · {c.campus_name}
                      </p>
                    </div>
                    {c.isDirectorGroup && <Pill color="blue">Director</Pill>}
                    <IconChevronRight size={16} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Courses ──────────────────────────────────────────────────────────────────

interface CoursesProps {
  selectedCourseId: string | null
  onSelectCourse: (id: string) => void
  selectedPeriodId: string
}

export function CoursesScreen({
  selectedCourseId,
  onSelectCourse,
}: CoursesProps) {
  const session = useTeacherSession()
  const period = session.periods.find((p) => p.id === session.selectedPeriodId)
  const yearLabel = session.academicYear?.year ?? "—"

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9]">
      <div className="bg-white px-4 py-3 border-b border-slate-200">
        <h1 className="text-base font-bold text-slate-900">Mis cursos</h1>
        <p className="text-xs text-slate-500">
          Año {yearLabel}
          {period ? ` · ${period.name}` : ""}
        </p>
      </div>

      {session.truncated && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          Se muestran 2000 cursos; hay más asignaciones.
        </div>
      )}

      <div className="p-4 space-y-2">
        {session.courses.length === 0 && (
          <EmptyState
            icon={<IconBook size={24} />}
            title="Aún no tienes cursos asignados"
            body="Pide a coordinación que te vincule a un grupo."
          />
        )}
        {session.courses.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              session.setLastCourseAssignmentId(c.id)
              onSelectCourse(c.id)
            }}
            className={`w-full text-left rounded-xl border transition-all ${
              selectedCourseId === c.id
                ? "bg-[#EBF2FB] border-blue-300"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center p-4 gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                  selectedCourseId === c.id
                    ? "bg-[#1E3A5F] text-white"
                    : "bg-[#EBF2FB] text-[#1E3A5F]"
                }`}
              >
                {c.group_name}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {c.subject_name}
                  </p>
                  {c.emphasis && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      {c.emphasis}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {c.group_grade_level_name} · {c.campus_name}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {c.isDirectorGroup && <Pill color="blue">Director</Pill>}
                </div>
              </div>
              <IconChevronRight size={16} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Course Detail ────────────────────────────────────────────────────────────

interface CourseDetailProps {
  courseId: string
  section: CourseSection
  onSectionChange: (s: CourseSection) => void
  onGoToRollCall: () => void
  onGoToGradeActivity: (actId: string) => void
  onGoToPeriodGrades: () => void
  onGoToRecoveries: () => void
  onGoToPlan: () => void
  onSelectStudent: (id: string) => void
  onBack?: () => void
}

export function CourseDetailScreen({
  courseId,
  section,
  onSectionChange,
  onGoToRollCall,
  onGoToGradeActivity,
  onGoToPeriodGrades,
  onGoToRecoveries,
  onGoToPlan,
  onSelectStudent,
  onBack,
}: CourseDetailProps) {
  const course = useSessionCourse(courseId)
  if (!course) return <CourseNotFound onBack={onBack} />
  const tabs: { id: CourseSection; label: string }[] = [
    { id: "attendance", label: "Asistencia" },
    { id: "activities", label: "Actividades" },
    { id: "grades", label: "Notas" },
    { id: "students", label: "Estudiantes" },
  ]

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 -ml-1"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {course.subject_name} · {course.group_name}
            </p>
            <p className="text-xs text-slate-500">
              {course.campus_name} · {course.academic_year_year}
            </p>
          </div>
          {course.isDirectorGroup && <Pill color="blue">Director</Pill>}
          <button
            type="button"
            onClick={onGoToPlan}
            className="text-xs font-semibold text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50"
          >
            Plan
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-t border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onSectionChange(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                section === t.id
                  ? "border-[#1E3A5F] text-[#1E3A5F]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {section === "attendance" && (
          <AttendanceSection course={course} onGoToRollCall={onGoToRollCall} />
        )}
        {section === "activities" && (
          <ActivitiesSection
            course={course}
            onGoToGradeActivity={onGoToGradeActivity}
            onGoToPlan={onGoToPlan}
          />
        )}
        {section === "grades" && (
          <GradesSummarySection
            course={course}
            onGoToPeriodGrades={onGoToPeriodGrades}
            onGoToRecoveries={onGoToRecoveries}
          />
        )}
        {section === "students" && (
          <StudentsSection course={course} onSelectStudent={onSelectStudent} />
        )}
      </div>
    </div>
  )
}

function AttendanceSection({
  course,
  onGoToRollCall,
}: {
  course: Course
  onGoToRollCall: () => void
}) {
  const session = useTeacherSession()
  const period = session.periods.find((p) => p.id === session.selectedPeriodId)
  const date = todayIso()
  const attendancesQuery = useAttendancesQuery(
    course.groupId && session.selectedPeriodId
      ? {
          group: course.groupId,
          academic_period: session.selectedPeriodId,
          generalOnly: true,
        }
      : null,
  )
  const rows = attendancesQuery.data ?? []
  const summary = summarizeAttendances(rows)

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={onGoToRollCall}
        className="w-full bg-[#1E3A5F] text-white rounded-xl p-4 text-left hover:bg-[#2D5A8E] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <IconCalendar size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Llamar a lista hoy</p>
            <p className="text-xs text-blue-200 truncate">
              {formatLongDate(date)} · Por asignatura
            </p>
          </div>
          <IconChevronRight size={16} />
        </div>
      </button>

      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Acumulado {period?.shortName ?? "del periodo"}
        </p>
        {attendancesQuery.isLoading ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Cargando acumulado…
          </p>
        ) : attendancesQuery.isError ? (
          <p className="text-sm text-red-600 text-center py-2">
            {getErrorMessage(
              attendancesQuery.error,
              "No se pudo cargar el acumulado.",
            )}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-mono text-2xl font-bold text-emerald-600">
                {summary.withoutAbsences}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Sin faltas</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-amber-600">
                {summary.excused}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Con excusa (CE)</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-red-600">
                {summary.unexcused}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Sin excusa (SE)</p>
            </div>
          </div>
        )}
      </Card>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Estudiantes con faltas
        </p>
        {summary.withAbsences.length === 0 && !attendancesQuery.isLoading && (
          <p className="text-sm text-slate-400 px-1">
            Nadie tiene faltas en este periodo.
          </p>
        )}
        <div className="space-y-1">
          {summary.withAbsences.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 flex items-center px-3.5 py-3 gap-3"
            >
              <Avatar name={s.student_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {s.student_name}
                </p>
              </div>
              {(s.excused_absences ?? 0) > 0 && (
                <span className="font-mono text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {s.excused_absences} CE
                </span>
              )}
              {(s.unexcused_absences ?? 0) > 0 && (
                <span className="font-mono text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                  {s.unexcused_absences} SE
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { RollCallScreen } from "@/features/attendance/RollCallScreen"
export { GradeActivityScreen } from "@/features/grading/GradeActivityScreen"
export { SchemePlanScreen } from "@/features/grading/SchemePlanScreen"
export { PeriodGradesScreen } from "@/features/grades/PeriodGradesScreen"
export { RecoveriesScreen } from "@/features/recoveries/RecoveriesScreen"
export { StudentProfileScreen } from "@/features/students/StudentProfileScreen"
export { IndicatorsEditorScreen } from "@/features/students/IndicatorsEditorScreen"
export { GroupScreen } from "@/features/groups/GroupScreen"
export { PdfViewerScreen } from "@/features/groups/PdfViewerScreen"
export { IndicatorsReportScreen } from "@/features/groups/IndicatorsReportScreen"
export { SchoolRecordScreen } from "@/features/groups/SchoolRecordScreen"

// ─── More ─────────────────────────────────────────────────────────────────────

interface MoreProps {
  onLogout: () => void
}

export function MoreScreen({ onLogout }: MoreProps) {
  const session = useTeacherSession()
  const email = session.teacher?.email || session.me.email
  const year = session.academicYear
  const scaleCodes = new Set(["SP", "AL", "BS", "BJ"])

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9]">
      <div className="bg-white px-4 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Avatar name={session.displayName} size="lg" />
          <div>
            <p className="font-bold text-slate-900">{session.displayName}</p>
            <p className="text-xs text-slate-500">{email}</p>
            {session.institutionName && (
              <p className="text-xs text-slate-500 mt-0.5">
                {session.institutionName}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Card className="divide-y divide-slate-100">
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 mb-0.5">Año lectivo</p>
            <p className="text-sm font-semibold text-slate-900">
              {year
                ? `${year.year}${year.is_active ? " · Activo" : ""}`
                : "Sin año lectivo"}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 mb-2">Periodos</p>
            <div className="flex gap-2 flex-wrap">
              {session.periods.length === 0 && (
                <p className="text-xs text-slate-400">
                  No hay periodos para este año.
                </p>
              )}
              {session.periods.map((p) => (
                <div
                  key={p.id}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                    p.active
                      ? "bg-[#1E3A5F] text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <div>{p.shortName}</div>
                  <div className="font-normal opacity-70 text-[10px]">
                    {p.start}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="divide-y divide-slate-100">
          <div className="px-4 py-3 flex items-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1">
              Escala de valoración
            </p>
          </div>
          {session.gradingScales.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">
              No hay escala configurada para tu institución.
            </p>
          )}
          {[...session.gradingScales]
            .sort((a, b) => Number(b.min_score) - Number(a.min_score))
            .map((item) => {
              const code = item.code as PerformanceLevel
              return (
                <div
                  key={item.id}
                  className="flex items-center px-4 py-2.5 gap-3"
                >
                  {scaleCodes.has(item.code) ? (
                    <LevelChip level={code} />
                  ) : (
                    <span className="text-xs font-semibold text-slate-700">
                      {item.name}
                    </span>
                  )}
                  <span className="font-mono text-sm text-slate-600">
                    {item.min_score} – {item.max_score}
                  </span>
                </div>
              )
            })}
        </Card>

        <Card className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Mis asignaciones
          </p>
          <p className="text-sm text-slate-700">
            {session.courses.length} curso
            {session.courses.length === 1 ? "" : "s"}
            {session.isDirector
              ? ` · Director de ${session.gradeDirectors.map((d) => d.group_name).join(", ")}`
              : ""}
          </p>
        </Card>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-red-100 text-red-600 hover:bg-red-50 transition-colors"
        >
          <IconLogout size={18} />
          <span className="text-sm font-semibold">Cerrar sesión</span>
        </button>
      </div>
    </div>
  )
}

// ─── Tablet: Split detail empty state ────────────────────────────────────────

export function TabletEmptyDetail({
  message = "Elige un curso para comenzar",
  sub = "Tus cursos aparecen en el panel izquierdo",
}: {
  message?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
        <IconBook size={32} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500">{message}</p>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  )
}
