import { Box, Paper, Tab, Tabs } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import {
  ACTIVITY_GRADING_BASE,
  activityGradingNavItems,
  activityGradingTabValue,
} from '@/features/operations/activityGrading/activityGradingNav'
import { PageHeader } from '@/components/PageHeader'

export function ActivityGradingLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const tabValue = activityGradingTabValue(pathname)
  const fullWidth = pathname.startsWith(`${ACTIVITY_GRADING_BASE}/grade-grid`)

  return (
    <Box
      className={
        fullWidth
          ? 'p-4 md:p-6 w-full flex flex-col gap-4 overflow-hidden box-border'
          : 'p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4'
      }
      sx={
        fullWidth
          ? { height: 'calc(100dvh - var(--app-bar-height, 64px))' }
          : undefined
      }
    >
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={t('activityGrading.moduleTitle')}
          subtitle={t('activityGrading.moduleSubtitle')}
        />
      </Box>

      <Paper sx={{ width: '100%', flexShrink: 0 }}>
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

      <Box
        className={
          fullWidth ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : undefined
        }
      >
        <Outlet />
      </Box>
    </Box>
  )
}
