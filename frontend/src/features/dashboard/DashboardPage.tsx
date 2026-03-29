import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import { APP_NAME } from '@/app/appName'
import { PageHeader } from '@/components/PageHeader'

const shortcuts = [
  { title: 'Instituciones', path: '/institutions', body: 'Alta y edición de instituciones' },
  { title: 'Sedes', path: '/campuses', body: 'Campus filtrados por institución' },
  { title: 'Estudiantes', path: '/students', body: 'Listado y detalle' },
  {
    title: 'Carga masiva CSV',
    path: '/bulk-load',
    body: 'Todos los POST */bulk-load/ del OpenAPI (multipart file)',
  },
  { title: 'Años lectivos', path: '/academic-years', body: 'Estructura académica' },
  { title: 'Grupos', path: '/groups', body: 'Listado genérico con filtro' },
]

export function DashboardPage() {
  const navigate = useNavigate()

  return (
    <Box className="p-4 md:p-6 max-w-5xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title="Inicio"
        subtitle={`Panel de administración enlazado a la API ${APP_NAME} (OpenAPI en backend/docs/openapi/schema.json).`}
      />
      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shortcuts.map((s) => (
          <Card key={s.path} variant="outlined">
            <CardActionArea onClick={() => navigate(s.path)}>
              <CardContent>
                <Typography variant="subtitle1" component="h2">
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.body}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
