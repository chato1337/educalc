import { Box, Paper, Tab, Tabs } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import {
  activityGradingNavItems,
  activityGradingTabValue,
} from '@/features/operations/activityGrading/activityGradingNav'
import { PageHeader } from '@/components/PageHeader'

export function ActivityGradingLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const tabValue = activityGradingTabValue(pathname)

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title={t('activityGrading.moduleTitle')}
        subtitle={t('activityGrading.moduleSubtitle')}
      />

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t('activityGrading.moduleNavAria')}
        >
          {activityGradingNavItems.map((item) => (
            <Tab
              key={item.path}
              label={t(item.labelKey)}
              value={item.path}
              component={NavLink}
              to={item.path}
              icon={<item.icon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Paper>

      <Outlet />
    </Box>
  )
}
