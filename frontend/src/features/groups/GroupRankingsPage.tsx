import { Alert, Box, Paper, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'

export function GroupRankingsPage() {
  const { t } = useTranslation()
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
    return <Alert severity="warning">{t('groupRankings.invalidGroupId')}</Alert>
  }

  return (
    <Box className="p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('groupRankings.title')}
        subtitle={t('groupRankings.subtitle')}
      />
      <Typography variant="body2">
        <Link to="/groups" className="text-blue-600 underline">
          {`← ${t('groupRankings.groupsList')}`}
        </Link>
      </Typography>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}
      {isLoading ? <Typography>{t('groupRankings.loading')}</Typography> : null}

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
