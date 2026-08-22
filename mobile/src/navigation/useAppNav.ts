import { useNavigate } from "react-router-dom"

import { teacherQueryClient } from "@/api/queryClient"
import { useAuthStore } from "@/auth/authStore"
import { useRollCallDraftStore } from "@/features/attendance/rollCallDraftStore"
import { useSessionPrefsStore } from "@/session/sessionPrefsStore"

import { parentOf } from "./parentOf"
import { routes } from "./routes"

function hasInternalHistory(): boolean {
  const idx = window.history.state?.idx
  return typeof idx === "number" && idx > 0
}

export function useAppNav() {
  const navigate = useNavigate()

  return {
    go: (to: string) => {
      navigate(to)
    },
    replace: (to: string) => {
      navigate(to, { replace: true })
    },
    back: () => {
      if (hasInternalHistory()) {
        navigate(-1)
        return
      }
      navigate(parentOf(window.location.pathname), { replace: true })
    },
  }
}

export function useLogout() {
  const navigate = useNavigate()
  return () => {
    teacherQueryClient.clear()
    useSessionPrefsStore.getState().reset()
    useRollCallDraftStore.getState().reset()
    useAuthStore.getState().logout()
    navigate(routes.login(), { replace: true })
  }
}
