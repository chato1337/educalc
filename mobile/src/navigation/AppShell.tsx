import type { ReactNode } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { APP_MARK } from "@/app/appName"
import { IconBook, IconHome, IconMenu, IconUsers } from "@/components"
import { CoursesScreen, MoreScreen, TabletEmptyDetail } from "@/screens"
import { useTeacherSession } from "@/session/TeacherSessionContext"

import { GroupPage, TodayPage } from "./pages"
import {
  courseIdFromPathname,
  isTabRootPath,
  phoneShowsTabBar,
  routes,
  tabFromPathname,
} from "./routes"
import type { Tab } from "./types"
import { useAppNav, useLogout } from "./useAppNav"
import { useBreakpoint } from "./useBreakpoint"

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
    { id: "today", icon: <IconHome size={22} />, label: "Hoy" },
    { id: "courses", icon: <IconBook size={22} />, label: "Cursos" },
    ...(showGroup
      ? [
          {
            id: "group" as Tab,
            icon: <IconUsers size={22} />,
            label: "Mi grupo",
          },
        ]
      : []),
    { id: "more", icon: <IconMenu size={22} />, label: "Más" },
  ]

  return (
    <nav className="shrink-0 bg-white border-t border-slate-200 safe-area-bottom">
      <div className="flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
              activeTab === t.id
                ? "text-[#1E3A5F]"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.icon}
            <span className="text-[10px] font-semibold">{t.label}</span>
            {activeTab === t.id && (
              <span
                className="absolute bottom-0 w-10 h-0.5 bg-[#1E3A5F] rounded-full"
                style={{
                  position: "relative",
                  display: "block",
                  width: 24,
                  height: 2,
                  background: "#1E3A5F",
                  borderRadius: 1,
                  marginTop: 1,
                }}
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}

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
    { id: "today", icon: <IconHome size={22} />, label: "Hoy" },
    { id: "courses", icon: <IconBook size={22} />, label: "Cursos" },
    ...(showGroup
      ? [
          {
            id: "group" as Tab,
            icon: <IconUsers size={22} />,
            label: "Mi grupo",
          },
        ]
      : []),
    { id: "more", icon: <IconMenu size={22} />, label: "Más" },
  ]

  return (
    <nav className="w-[72px] shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 gap-1">
      <div className="flex items-center justify-center mb-4 px-2">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] flex items-center justify-center">
          <span className="text-white font-bold text-xs">{APP_MARK}</span>
        </div>
      </div>

      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-col items-center justify-center gap-1 mx-2 py-3 rounded-xl transition-colors ${
            activeTab === t.id
              ? "bg-[#EBF2FB] text-[#1E3A5F]"
              : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          }`}
        >
          {t.icon}
          <span className="text-[9px] font-semibold leading-none">
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  )
}

function tabPath(tab: Tab): string {
  if (tab === "courses") return routes.courses()
  if (tab === "group") return routes.group()
  if (tab === "more") return routes.more()
  return routes.today()
}

function PhoneLayout() {
  const session = useTeacherSession()
  const { pathname } = useLocation()
  const { replace } = useAppNav()
  const tab = tabFromPathname(pathname)
  const showTabBar = phoneShowsTabBar(pathname)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
      {showTabBar && (
        <PhoneTabBar
          activeTab={tab}
          onChange={(next) => replace(tabPath(next))}
          showGroup={session.isDirector}
        />
      )}
    </div>
  )
}

function TabletLayout() {
  const session = useTeacherSession()
  const { pathname } = useLocation()
  const { go, replace } = useAppNav()
  const onLogout = useLogout()
  const tab = tabFromPathname(pathname)
  const selectedCourseId = courseIdFromPathname(pathname)
  const selectedPeriodId = session.selectedPeriodId ?? ""
  const tabRoot = isTabRootPath(pathname)

  const renderMaster = () => {
    if (tab === "today") {
      return (
        <div className="h-full overflow-hidden">
          <TodayPage />
        </div>
      )
    }
    if (tab === "courses") {
      return (
        <div className="h-full overflow-y-auto bg-[#F1F5F9]">
          <CoursesScreen
            selectedCourseId={selectedCourseId}
            onSelectCourse={(courseId) => go(routes.course(courseId))}
            selectedPeriodId={selectedPeriodId}
          />
        </div>
      )
    }
    if (tab === "group") {
      return (
        <div className="h-full overflow-hidden">
          <GroupPage />
        </div>
      )
    }
    if (tab === "more") {
      return (
        <div className="h-full overflow-y-auto">
          <MoreScreen onLogout={onLogout} />
        </div>
      )
    }
  }

  const renderDetail = () => {
    if (tabRoot) {
      const msgs: Record<Tab, { msg: string; sub: string }> = {
        today: {
          msg: "Elige una acción rápida",
          sub: "Los atajos de la izquierda abren el detalle aquí",
        },
        courses: {
          msg: "Elige un curso",
          sub: "Selecciona una asignatura de la lista para trabajar",
        },
        group: {
          msg: "Elige un estudiante o un informe",
          sub: "Ranking, convivencia e informes se abren aquí",
        },
        more: {
          msg: "Información del perfil",
          sub: "Selecciona un elemento",
        },
      }
      const { msg, sub } = msgs[tab]
      return <TabletEmptyDetail message={msg} sub={sub} />
    }
    return <Outlet />
  }

  return (
    <div className="flex h-full">
      <TabletRail
        activeTab={tab}
        onChange={(next) => replace(tabPath(next))}
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

export function AppShell() {
  const isTablet = useBreakpoint()
  return isTablet ? <TabletLayout /> : <PhoneLayout />
}
