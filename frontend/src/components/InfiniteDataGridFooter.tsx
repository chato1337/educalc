import { Box, Skeleton } from '@mui/material'

import { InfiniteScrollSentinel } from '@/components/InfiniteScrollSentinel'

export type InfiniteDataGridFooterProps = {
  /** `rows.length > 0 && !isLoading` */
  show: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onLoadMore: () => void
}

export function InfiniteDataGridFooter({
  show,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
}: InfiniteDataGridFooterProps) {
  if (!show) return null
  return (
    <Box className="flex flex-col gap-1 px-1">
      {isFetchingNextPage
        ? Array.from({ length: 3 }, (_, i) => (
            <Skeleton
              key={`dg-infinite-skel-${i}`}
              variant="rounded"
              height={36}
              animation="wave"
            />
          ))
        : null}
      <InfiniteScrollSentinel
        onLoadMore={onLoadMore}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
      />
    </Box>
  )
}
