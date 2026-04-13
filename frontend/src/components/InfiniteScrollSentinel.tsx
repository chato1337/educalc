import { useEffect, useRef } from 'react'

type Props = {
  /** Called when the sentinel enters the viewport (guard with hasMore / loading in parent). */
  onLoadMore: () => void
  hasMore: boolean
  /** True while the next page request is in flight. */
  isLoadingMore: boolean
  rootMargin?: string
}

/**
 * Renders an invisible anchor; when it intersects the viewport, requests the next page.
 * Place directly after scrollable table rows or list items.
 */
export function InfiniteScrollSentinel({
  onLoadMore,
  hasMore,
  isLoadingMore,
  rootMargin = '120px',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (hit && !isLoadingMore) onLoadMore()
      },
      { root: null, rootMargin, threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, onLoadMore, rootMargin])

  return <div ref={ref} className="h-px w-full shrink-0" aria-hidden />
}
