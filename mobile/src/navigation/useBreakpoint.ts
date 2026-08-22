import { useEffect, useState } from "react"

export function useBreakpoint() {
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return isTablet
}
