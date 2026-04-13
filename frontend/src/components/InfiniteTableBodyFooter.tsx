import { Skeleton, TableCell, TableRow } from '@mui/material'

import { InfiniteScrollSentinel } from '@/components/InfiniteScrollSentinel'

export type InfiniteTableBodyFooterProps = {
  columnCount: number
  hasRows: boolean
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onLoadMore: () => void
  /** Placeholder rows while the next page loads (default 3). */
  skeletonRows?: number
}

/**
 * Skeleton rows while `isFetchingNextPage`, plus the infinite-scroll anchor row.
 * Use at the end of `<TableBody>` after data rows.
 */
export function InfiniteTableBodyFooter({
  columnCount,
  hasRows,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  skeletonRows = 3,
}: InfiniteTableBodyFooterProps) {
  if (!hasRows || isLoading || columnCount < 1) return null

  return (
    <>
      {isFetchingNextPage
        ? Array.from({ length: skeletonRows }, (_, i) => (
            <TableRow key={`infinite-skeleton-${i}`}>
              {Array.from({ length: columnCount }, (_, j) => (
                <TableCell key={j} sx={{ py: 1.25 }}>
                  <Skeleton
                    variant="rounded"
                    height={20}
                    animation="wave"
                    sx={{ borderRadius: 0.5 }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))
        : null}
      <TableRow>
        <TableCell colSpan={columnCount} sx={{ border: 0, p: 0 }}>
          <InfiniteScrollSentinel
            onLoadMore={onLoadMore}
            hasMore={hasNextPage}
            isLoadingMore={isFetchingNextPage}
          />
        </TableCell>
      </TableRow>
    </>
  )
}
