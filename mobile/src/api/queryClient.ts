import { QueryClient } from '@tanstack/react-query'

import { isRetriableWriteError } from '@/api/errors'

export const teacherQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
    mutations: {
      retry: (failureCount, error) =>
        failureCount < 2 && isRetriableWriteError(error),
    },
  },
})
