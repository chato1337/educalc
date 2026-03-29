import { Typography } from '@mui/material'
import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: ReactNode
}

export function PageHeader({ title, subtitle }: Props) {
  return (
    <header className="flex flex-col gap-1">
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </header>
  )
}
