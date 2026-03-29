# eduCalc

Aplicación para **gestión y reportes académicos** en instituciones educativas: API REST con Django, panel de administración en React y modelos de dominio alineados con reportes (calificaciones, asistencia, indicadores, expedientes, etc.).

El repositorio es un **monorepo** con backend, frontend y documentación en la carpeta `docs/`.

## Características principales

- **Backend:** Django REST Framework, autenticación JWT (SimpleJWT), filtros (`django-filter`), esquema **OpenAPI** con Swagger/ReDoc (`drf-spectacular`).
- **Frontend:** React, Vite, Material UI, TanStack Query, React Router, formularios con React Hook Form y Zod.
- **Base de datos:** PostgreSQL o SQLite (configurable por variables de entorno).
- **Carga masiva:** endpoints de carga por CSV documentados en OpenAPI; plantillas y planes en `docs/`.
- **Control de acceso:** perfiles de usuario con roles (p. ej. administrador, coordinador, docente, acudiente) y alcance por institución.

## Estructura del proyecto

| Ruta | Contenido |
|------|-----------|
| `backend/` | Proyecto Django (`manage.py`, `settings.py`, app `core` con modelos, vistas API, carga masiva). |
| `backend/docs/openapi/` | Esquemas OpenAPI exportados (JSON/YAML) para clientes y tipos TypeScript. |
| `frontend/` | SPA de administración (Vite + React). |
| `docs/` | Análisis de entidades, planes de implementación, CSV de ejemplo para bulk load, documentación de API. |

## Requisitos previos

- **Python** 3.9+ (el `Pipfile` fija 3.9; puedes usar una versión compatible con el lockfile).
- **pipenv** (recomendado) o entorno virtual + dependencias equivalentes al `Pipfile`.
- **Node.js** y **bun** o **npm** (el frontend usa `bun` en los scripts habituales; también puedes usar `npm install` / `npm run dev`).
- **PostgreSQL** (opcional; si no, usa `DB_ENGINE=sqlite` en el `.env` del backend).

## Puesta en marcha

### Backend

```bash
cd backend
cp .env.example .env
# Edita .env: SECRET_KEY, base de datos, CORS, etc.

pipenv install
pipenv shell
python manage.py migrate
python manage.py createsuperuser   # el perfil se crea con rol administrador si es superusuario
python manage.py runserver
```

La API queda disponible por defecto en `http://127.0.0.1:8000/`. Rutas útiles:

- `http://127.0.0.1:8000/api/docs/` — Swagger UI  
- `http://127.0.0.1:8000/api/redoc/` — ReDoc  
- `http://127.0.0.1:8000/api/schema/` — esquema OpenAPI (JSON)

Para regenerar el esquema estático usado por el frontend:

```bash
cd backend
./scripts/export-openapi-schema.sh        # YAML
./scripts/export-openapi-schema.sh json   # JSON
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Opcional: VITE_APP_NAME, VITE_API_BASE_URL (si no usas el proxy de Vite)

bun install
bun dev
```

En desarrollo, Vite suele servir en `http://localhost:5173` y **proxifica** `/api` al backend (`vite.config.ts`), de modo que puedes dejar `VITE_API_BASE_URL` vacío.

Generar tipos TypeScript a partir del OpenAPI del backend:

```bash
cd frontend
bun run generate:api-types
```

### Compilación del frontend

```bash
cd frontend
bun run build
```

## Documentación

- **API (Swagger, exportación del schema, CORS):** [`docs/api-documentacion.md`](docs/api-documentacion.md)
- **Modelos y referencia de dominio:** `docs/analisis-entidades-reporte-academico.md` (citado en el código del backend)
- **Planes y estado:** `docs/plan-implementacion-carga-masiva-csv.md`, `frontend/docs/ESTADO-IMPLEMENTACION.md`, etc.

## Variables de entorno (resumen)

| Ámbito | Archivo | Variables destacadas |
|--------|---------|----------------------|
| Backend | `backend/.env` | `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DB_ENGINE`, credenciales PostgreSQL o `SQLITE_PATH`, JWT, `CORS_ALLOWED_ORIGINS` |
| Frontend | `frontend/.env` | `VITE_APP_NAME`, `VITE_API_BASE_URL` (opcional si usas proxy en dev) |

Copia siempre desde los `.env.example` correspondientes y **no subas** `.env` con secretos reales al control de versiones.
