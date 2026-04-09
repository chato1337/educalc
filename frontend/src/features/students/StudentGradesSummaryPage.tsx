import { Alert, Box, Paper, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'

export function StudentGradesSummaryPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.studentGradesSummary(id ?? ''),
    queryFn: async () => {
      const { data: payload } = await apiClient.get<unknown>(
        `/api/students/${id}/grades-summary/`,
      )
      return payload
    },
    enabled: !!id,
  })

  if (!id) {
    return <Alert severity="warning">{t('studentGradesSummary.invalidId')}</Alert>
  }

  return (
    <Box className="p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col gap-4">
      <PageHeader title={t('studentGradesSummary.title')} />
      <Typography variant="body2">
        <Link to={`/students/${id}`} className="text-blue-600 underline">
          {t('studentGradesSummary.backToStudent')}
        </Link>
      </Typography>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}
      {isLoading ? <Typography>{t('common.loading')}</Typography> : null}

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
