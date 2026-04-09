import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { APP_NAME } from '@/app/appName'
import { PageHeader } from '@/components/PageHeader'

const shortcuts = [
  { titleKey: 'dashboard.shortcuts.institutions.title', bodyKey: 'dashboard.shortcuts.institutions.body', path: '/institutions' },
  { titleKey: 'dashboard.shortcuts.campuses.title', bodyKey: 'dashboard.shortcuts.campuses.body', path: '/campuses' },
  { titleKey: 'dashboard.shortcuts.students.title', bodyKey: 'dashboard.shortcuts.students.body', path: '/students' },
  { titleKey: 'dashboard.shortcuts.bulkLoad.title', bodyKey: 'dashboard.shortcuts.bulkLoad.body', path: '/bulk-load' },
  { titleKey: 'dashboard.shortcuts.academicYears.title', bodyKey: 'dashboard.shortcuts.academicYears.body', path: '/academic-years' },
  { titleKey: 'dashboard.shortcuts.groups.title', bodyKey: 'dashboard.shortcuts.groups.body', path: '/groups' },
]

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle', { appName: APP_NAME })}
      />
      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shortcuts.map((s) => (
          <Card key={s.path} variant="outlined">
            <CardActionArea onClick={() => navigate(s.path)}>
              <CardContent>
                <Typography variant="subtitle1" component="h2">
                  {t(s.titleKey)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(s.bodyKey)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
