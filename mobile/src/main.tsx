import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { teacherQueryClient } from "@/api/queryClient"
import { APP_NAME } from "@/app/appName"
import App from "./App"
import "./index.css"

document.title = APP_NAME

function lockViewportZoom() {
  const block = (event: Event) => event.preventDefault()
  ;["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(type, block, { passive: false })
  })
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) event.preventDefault()
    },
    { passive: false },
  )
}

lockViewportZoom()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={teacherQueryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
