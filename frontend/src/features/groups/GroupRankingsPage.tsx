import { Alert, Box, Paper, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'

export function GroupRankingsPage() {
  const { groupId } = useParams<{ groupId: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.groupRankings(groupId ?? ''),
    queryFn: async () => {
      const { data: payload } = await apiClient.get<unknown>(
        `/api/groups/${groupId}/students-rankings/`,
      )
      return payload
    },
    enabled: !!groupId,
  })

  if (!groupId) {
    return <Alert severity="warning">ID de grupo no válido.</Alert>
  }

  return (
    <Box className="p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col gap-4">
      <PageHeader title="Ranking de estudiantes (grupo)" />
      <Typography variant="body2">
        <Link to="/groups" className="text-blue-600 underline">
          ← Listado de grupos
        </Link>
        {' · '}
        Ruta API:{' '}
        <code className="text-xs bg-gray-100 px-1 rounded">
          GET /api/groups/{'{id}'}/students-rankings/
        </code>
      </Typography>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}
      {isLoading ? <Typography>Cargando…</Typography> : null}

      {data !== undefined && !isLoading ? (
        <Paper className="p-4 overflow-auto">
          <pre className="text-sm whitespace-pre-wrap break-words m-0">
            {JSON.stringify(data, null, 2)}
          </pre>
        </Paper>
      ) : null}
    </Box>
  )
}
