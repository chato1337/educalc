import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconHome, IconBook, IconUsers, IconMenu } from './components'
import {
  LoginScreen,
  FaceAuthCallbackScreen,
  SplashScreen,
  AccessDeniedScreen,
  BootstrapErrorScreen,
  TodayScreen,
  CoursesScreen,
  CourseDetailScreen,
  RollCallScreen,
  GradeActivityScreen,
  PeriodGradesScreen,
  RecoveriesScreen,
  StudentProfileScreen,
  GroupScreen,
  PdfViewerScreen,
  IndicatorsReportScreen,
  SchoolRecordScreen,
  SchemePlanScreen,
  IndicatorsEditorScreen,
  MoreScreen,
  TabletEmptyDetail,
} from './screens'
import { getErrorMessage } from '@/api/errors'
import { teacherQueryClient } from '@/api/queryClient'
import { useAuthStore } from '@/auth/authStore'
import { isFaceAuthCallbackPath } from '@/features/auth/loginApi'
import { useRollCallDraftStore } from '@/features/attendance/rollCallDraftStore'
import { useMeQuery } from '@/features/auth/meApi'
import {
  TeacherSessionProvider,
  useBootstrapStatus,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import {
  phoneShowsTabBar,
  useNavStore,
  type Tab,
} from '@/session/navStore'
import { useSessionPrefsStore } from '@/session/sessionPrefsStore'
import type { AcademicGradesBulletinQuery } from '@/features/groups/gradesBulletinApi'
import { APP_MARK } from '@/app/appName'
import { isTeacherUser } from '@/types/user'

function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  )
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [])
  return hydrated
}

function useBreakpoint() {
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isTablet
}

function logoutSession() {
  teacherQueryClient.clear()
  useSessionPrefsStore.getState().reset()
  useRollCallDraftStore.getState().reset()
  useNavStore.getState().reset()
  useAuthStore.getState().logout()
}

// ─── Phone Tab Bar ────────────────────────────────────────────────────────────

function PhoneTabBar({
  activeTab,
  onChange,
  showGroup,
}: {
  activeTab: Tab
  onChange: (t: Tab) => void
  showGroup: boolean
}) {
  const tabs: { id: Tab; icon: ReactNode; label: string }[] = [
    { id: 'today', icon: <IconHome size={22} />, label: 'Hoy' },
    { id: 'courses', icon: <IconBook size={22} />, label: 'Cursos' },
    ...(showGroup ? [{ id: 'group' as Tab, icon: <IconUsers size={22} />, label: 'Mi grupo' }] : []),
    { id: 'more', icon: <IconMenu size={22} />, label: 'Más' },
  ]

  return (
    <nav className="shrink-0 bg-white border-t border-slate-200 safe-area-bottom">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
              activeTab === t.id ? 'text-[#1E3A5F]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.icon}
            <span className="text-[10px] font-semibold">{t.label}</span>
            {activeTab === t.id && (
              <span className="absolute bottom-0 w-10 h-0.5 bg-[#1E3A5F] rounded-full" style={{ position: 'relative', display: 'block', width: 24, height: 2, background: '#1E3A5F', borderRadius: 1, marginTop: 1 }} />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── Tablet Rail ──────────────────────────────────────────────────────────────

function TabletRail({
  activeTab,
  onChange,
  showGroup,
}: {
  activeTab: Tab
  onChange: (t: Tab) => void
  showGroup: boolean
}) {
  const tabs: { id: Tab; icon: ReactNode; label: string }[] = [
    { id: 'today', icon: <IconHome size={22} />, label: 'Hoy' },
    { id: 'courses', icon: <IconBook size={22} />, label: 'Cursos' },
    ...(showGroup ? [{ id: 'group' as Tab, icon: <IconUsers size={22} />, label: 'Mi grupo' }] : []),
    { id: 'more', icon: <IconMenu size={22} />, label: 'Más' },
  ]

  return (
    <nav className="w-[72px] shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 gap-1">
      <div className="flex items-center justify-center mb-4 px-2">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] flex items-center justify-center">
          <span className="text-white font-bold text-xs">{APP_MARK}</span>
        </div>
      </div>

      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-col items-center justify-center gap-1 mx-2 py-3 rounded-xl transition-colors ${
            activeTab === t.id
              ? 'bg-[#EBF2FB] text-[#1E3A5F]'
              : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          {t.icon}
          <span className="text-[9px] font-semibold leading-none">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

function useDirectorCourseId() {
  const { courses, defaultCourseId } = useTeacherSession()
  return courses.find(c => c.isDirectorGroup)?.id ?? defaultCourseId
}

function BulletinScreen({
  studentId,
  onBack,
}: {
  studentId?: string
  onBack: () => void
}) {
  const query = useBulletinQuery(studentId)
  const session = useTeacherSession()
  const director = session.gradeDirectors[0]
  const period = session.periods.find((p) => p.id === session.selectedPeriodId)
  return (
    <PdfViewerScreen
      title={studentId ? 'Boletín' : 'Boletín del grupo'}
      subtitle={[director?.group_name, period?.name].filter(Boolean).join(' · ')}
      query={query}
      onBack={onBack}
    />
  )
}

function useBulletinQuery(studentId?: string | null): AcademicGradesBulletinQuery | null {
  const session = useTeacherSession()
  const yearId = session.academicYear?.id
  const groupId = session.gradeDirectors[0]?.group
  if (!yearId) return null
  if (studentId) {
    return {
      academic_year: yearId,
      student: studentId,
      period_ids: session.selectedPeriodId ?? undefined,
    }
  }
  if (!groupId) return null
  return {
    academic_year: yearId,
    group: groupId,
    period_ids: session.selectedPeriodId ?? undefined,
  }
}

function CourseDetailFromNav({
  courseId,
  onBack,
}: {
  courseId: string
  onBack?: () => void
}) {
  const courseSection = useNavStore((s) => s.courseSection)
  const setCourseSection = useNavStore((s) => s.setCourseSection)
  const openView = useNavStore((s) => s.openView)
  return (
    <CourseDetailScreen
      courseId={courseId}
      section={courseSection}
      onSectionChange={setCourseSection}
      onGoToRollCall={() =>
        openView({ id: 'roll-call', courseId, origin: 'subject' })
      }
      onGoToGradeActivity={(activityId) =>
        openView({ id: 'grade-activity', courseId, activityId })
      }
      onGoToPeriodGrades={() => openView({ id: 'period-grades', courseId })}
      onGoToRecoveries={() => openView({ id: 'recoveries', courseId })}
      onGoToPlan={() => openView({ id: 'scheme-plan', courseId })}
      onSelectStudent={(studentId) =>
        openView({ id: 'student-profile', studentId, courseId })
      }
      onBack={onBack}
    />
  )
}

function ActiveNavView({
  periodId,
  onCourseBack,
}: {
  periodId: string
  onCourseBack?: () => void
}) {
  const view = useNavStore((s) => s.view)
  const openView = useNavStore((s) => s.openView)
  const closeView = useNavStore((s) => s.closeView)
  if (!view) return null

  if (view.id === 'roll-call') {
    return (
      <RollCallScreen
        courseId={view.courseId}
        origin={view.origin}
        onSaved={closeView}
        onBack={closeView}
      />
    )
  }
  if (view.id === 'grade-activity') {
    return (
      <GradeActivityScreen
        courseId={view.courseId}
        activityId={view.activityId}
        onBack={closeView}
        onGoToPeriodGrades={() => openView({ id: 'period-grades', courseId: view.courseId })}
      />
    )
  }
  if (view.id === 'period-grades') {
    return (
      <PeriodGradesScreen
        courseId={view.courseId}
        periodId={periodId}
        onBack={closeView}
        onGoToRecoveries={() =>
          openView({ id: 'recoveries', courseId: view.courseId })
        }
        onGoToPlan={() => openView({ id: 'scheme-plan', courseId: view.courseId })}
      />
    )
  }
  if (view.id === 'scheme-plan') {
    return <SchemePlanScreen courseId={view.courseId} onBack={closeView} />
  }
  if (view.id === 'indicators-editor') {
    return (
      <IndicatorsEditorScreen
        studentId={view.studentId}
        courseId={view.courseId}
        onBack={closeView}
      />
    )
  }
  if (view.id === 'recoveries') {
    return <RecoveriesScreen courseId={view.courseId} onBack={closeView} />
  }
  if (view.id === 'student-profile') {
    return (
      <StudentProfileScreen
        studentId={view.studentId}
        courseId={view.courseId}
        onBack={closeView}
        onEditIndicator={(studentId, courseId) =>
          openView({ id: 'indicators-editor', studentId, courseId })
        }
      />
    )
  }
  if (view.id === 'grades-bulletin') {
    return <BulletinScreen studentId={view.studentId} onBack={closeView} />
  }
  if (view.id === 'indicators-report') {
    return (
      <IndicatorsReportScreen
        studentId={view.studentId}
        studentName={view.studentName}
        onBack={closeView}
      />
    )
  }
  if (view.id === 'school-record') {
    return (
      <SchoolRecordScreen
        studentId={view.studentId}
        studentName={view.studentName}
        onBack={closeView}
      />
    )
  }
  if (view.id === 'course') {
    return <CourseDetailFromNav courseId={view.courseId} onBack={onCourseBack} />
  }
  return null
}

function TodayFromNav() {
  const session = useTeacherSession()
  const openView = useNavStore((s) => s.openView)
  const selectedPeriodId = session.selectedPeriodId ?? ''
  return (
    <TodayScreen
      selectedPeriodId={selectedPeriodId}
      onSelectPeriod={session.setSelectedPeriodId}
      onGoToRollCall={(courseId) =>
        openView({ id: 'roll-call', courseId, origin: 'subject' })
      }
      onGoToGradeActivity={(courseId) =>
        openView({ id: 'course', courseId, section: 'activities' })
      }
      onGoToPeriodGrades={(courseId) => openView({ id: 'period-grades', courseId })}
      onGoToRecoveries={(courseId) =>
        openView({ id: 'recoveries', courseId })
      }
    />
  )
}

function GroupFromNav() {
  const directorCourseId = useDirectorCourseId()
  const openView = useNavStore((s) => s.openView)
  const groupTab = useNavStore((s) => s.groupTab)
  const setGroupTab = useNavStore((s) => s.setGroupTab)
  return (
    <GroupScreen
      tab={groupTab}
      onTabChange={setGroupTab}
      onSelectStudent={(studentId) =>
        openView({ id: 'student-profile', studentId })
      }
      onGoToRollCall={() => {
        if (!directorCourseId) return
        openView({
          id: 'roll-call',
          courseId: directorCourseId,
          origin: 'group',
        })
      }}
      onOpenBulletin={(studentId) => openView({ id: 'grades-bulletin', studentId })}
      onOpenIndicatorsReport={(studentId, studentName) =>
        openView({ id: 'indicators-report', studentId, studentName })
      }
      onOpenSchoolRecord={(studentId, studentName) =>
        openView({ id: 'school-record', studentId, studentName })
      }
    />
  )
}

// ─── Phone Layout ─────────────────────────────────────────────────────────────

function PhoneLayout({ onLogout }: { onLogout: () => void }) {
  const session = useTeacherSession()
  const tab = useNavStore((s) => s.tab)
  const view = useNavStore((s) => s.view)
  const setTab = useNavStore((s) => s.setTab)
  const selectCourse = useNavStore((s) => s.selectCourse)
  const closeView = useNavStore((s) => s.closeView)
  const closeCourse = useNavStore((s) => s.closeCourse)
  const selectedPeriodId = session.selectedPeriodId ?? ''
  const showTabBar = phoneShowsTabBar(tab, view)

  const renderContent = () => {
    if (view) {
      return (
        <ActiveNavView
          periodId={selectedPeriodId}
          onCourseBack={tab === 'courses' ? closeCourse : closeView}
        />
      )
    }
    if (tab === 'today') return <TodayFromNav />
    if (tab === 'courses') {
      return (
        <CoursesScreen
          selectedCourseId={null}
          onSelectCourse={selectCourse}
          selectedPeriodId={selectedPeriodId}
        />
      )
    }
    if (tab === 'group') return <GroupFromNav />
    if (tab === 'more') return <MoreScreen onLogout={onLogout} />
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </div>
      {showTabBar && (
        <PhoneTabBar activeTab={tab} onChange={setTab} showGroup={session.isDirector} />
      )}
    </div>
  )
}

// ─── Tablet Layout ────────────────────────────────────────────────────────────

function TabletLayout({ onLogout }: { onLogout: () => void }) {
  const session = useTeacherSession()
  const tab = useNavStore((s) => s.tab)
  const view = useNavStore((s) => s.view)
  const selectedCourseId = useNavStore((s) => s.selectedCourseId)
  const setTab = useNavStore((s) => s.setTab)
  const selectCourse = useNavStore((s) => s.selectCourse)
  const selectedPeriodId = session.selectedPeriodId ?? ''

  const renderMaster = () => {
    if (tab === 'today') {
      return (
        <div className="h-full overflow-y-auto">
          <TodayFromNav />
        </div>
      )
    }
    if (tab === 'courses') {
      return (
        <div className="h-full overflow-y-auto bg-[#F1F5F9]">
          <CoursesScreen
            selectedCourseId={selectedCourseId}
            onSelectCourse={selectCourse}
            selectedPeriodId={selectedPeriodId}
          />
        </div>
      )
    }
    if (tab === 'group') {
      return (
        <div className="h-full overflow-hidden">
          <GroupFromNav />
        </div>
      )
    }
    if (tab === 'more') {
      return (
        <div className="h-full overflow-y-auto">
          <MoreScreen onLogout={onLogout} />
        </div>
      )
    }
  }

  const renderDetail = () => {
    if (!view) {
      const msgs: Record<Tab, { msg: string; sub: string }> = {
        today: { msg: 'Elige una acción rápida', sub: 'Los atajos de la izquierda abren el detalle aquí' },
        courses: { msg: 'Elige un curso', sub: 'Selecciona una asignatura de la lista para trabajar' },
        group: { msg: 'Elige un estudiante o un informe', sub: 'Ranking, convivencia e informes se abren aquí' },
        more: { msg: 'Información del perfil', sub: 'Selecciona un elemento' },
      }
      const { msg, sub } = msgs[tab]
      return <TabletEmptyDetail message={msg} sub={sub} />
    }
    return <ActiveNavView periodId={selectedPeriodId} />
  }

  return (
    <div className="flex h-full">
      <TabletRail
        activeTab={tab}
        onChange={setTab}
        showGroup={session.isDirector}
      />

      <div className="w-[360px] shrink-0 border-r border-slate-200 flex flex-col overflow-hidden">
        {renderMaster()}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]">
        {renderDetail()}
      </div>
    </div>
  )
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const isTablet = useBreakpoint()
  return isTablet ? (
    <TabletLayout onLogout={onLogout} />
  ) : (
    <PhoneLayout onLogout={onLogout} />
  )
}

function TeacherGate({ onLogout }: { onLogout: () => void }) {
  const access = useAuthStore(s => s.access)
  const meQuery = useMeQuery(Boolean(access))
  const me = meQuery.data
  const bootstrap = useBootstrapStatus(isTeacherUser(me) ? me : undefined)

  if (meQuery.isLoading || meQuery.isPending) {
    return <SplashScreen message="Cargando perfil…" />
  }
  if (meQuery.isError || !me) {
    return (
      <BootstrapErrorScreen
        message={getErrorMessage(meQuery.error, 'No se pudo leer tu perfil.')}
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
        message={getErrorMessage(bootstrap.error, 'No se pudieron cargar tus cursos.')}
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
      <AuthenticatedApp onLogout={onLogout} />
    </TeacherSessionProvider>
  )
}

export default function App() {
  const hydrated = useAuthHydrated()
  const access = useAuthStore(s => s.access)
  const [faceAuthError, setFaceAuthError] = useState('')
  const exchangingFaceAuth = useRef(isFaceAuthCallbackPath())

  useEffect(() => {
    if (access) exchangingFaceAuth.current = false
  }, [access])

  if (!hydrated) {
    return <SplashScreen />
  }
  if (exchangingFaceAuth.current && !access && !faceAuthError) {
    return (
      <FaceAuthCallbackScreen
        onError={(message) => {
          exchangingFaceAuth.current = false
          setFaceAuthError(message)
        }}
      />
    )
  }
  if (!access) {
    return <LoginScreen initialError={faceAuthError} />
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TeacherGate onLogout={logoutSession} />
    </div>
  )
}
