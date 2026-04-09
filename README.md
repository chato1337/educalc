# eduCalc

Aplicación para **gestión y reportes académicos** en instituciones educativas: API REST con Django, panel de administración en React y modelos de dominio alineados con reportes (calificaciones, asistencia, indicadores, expedientes, etc.).

El repositorio es un **monorepo** con backend, frontend y documentación en la carpeta `docs/`.

## Características principales

- **Backend:** Django REST Framework, autenticación JWT (SimpleJWT), filtros (`django-filter`), esquema **OpenAPI** con Swagger/ReDoc (`drf-spectacular`).
- **Frontend:** React, Vite, Material UI, TanStack Query, React Router, formularios con React Hook Form y Zod, e internacionalizacion con i18next/react-i18next (base en `frontend/src/i18n/locales/es.json`).
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

### Docker (frontend + backend + PostgreSQL)

El proyecto incluye `docker-compose.yml` para desarrollo con hot reload en frontend/backend y base de datos PostgreSQL.

```bash
cp .env.example .env
docker compose up --build
```

Servicios disponibles:

- `http://localhost:5173` — Frontend (Vite)
- `http://localhost:8000` — Backend (Django API)
- `http://localhost:8000/api/docs/` — Swagger UI

Comandos utiles:

```bash
# Levantar en segundo plano
docker compose up -d --build

# Ver logs de todos los servicios
docker compose logs -f

# Bajar servicios
docker compose down

# Bajar y eliminar volumenes (reinicia DB)
docker compose down -v
```

Si ves **No such image: sha256:...** al subir cambios o recrear `backend` / `frontend`, suele ser porque la imagen anterior **ya no existe** (p. ej. `docker image prune`, limpieza en el servidor o otro host). Compose intenta recrear el contenedor apuntando a ese digest y falla.

```bash
docker compose down
docker compose build --no-cache backend frontend
docker compose up -d
```

En el mismo arranque puedes forzar imagen nueva y contenedores nuevos:

```bash
docker compose up -d --build --force-recreate
```

Si aparece el aviso de Docker sobre continuar con la imagen nueva, en modo interactivo puedes confirmar; en scripts usa el flujo de arriba tras un `down` para evitar el estado inconsistente.

Notas:

- El archivo de variables para Docker es el `.env` de la raiz (basado en `.env.example`).
- El frontend llama al API con URL absoluta (`VITE_API_BASE_URL`). En Docker Compose el valor por defecto es `http://localhost:8000` (visto **desde el navegador** en tu máquina, no el hostname interno `backend`).
- Asegura en el backend `CORS_ALLOWED_ORIGINS` con el origen del front (p. ej. `https://tu-dominio.com`) cuando front y API son distintos orígenes. Sin barra final; si usas `www`, debe coincidir exactamente con el `Origin` del navegador.
- En `DJANGO_ALLOWED_HOSTS` incluye el **hostname del API** (p. ej. `api.tudominio.com`), no solo el del front. Si falta, Django puede responder 400 sin cabeceras CORS y el navegador mostrará error de CORS en el preflight.
- Tras nginx/Traefik con HTTPS, suele hacer falta `TRUST_X_FORWARDED_PROTO=true` (y a veces `USE_X_FORWARDED_HOST=true`) en el backend. El proxy debe **reenviar OPTIONS** al upstream (Django), no responder solo 404/405 sin CORS.
- Si usas el admin o sesión con HTTPS, define `CSRF_TRUSTED_ORIGINS` con los orígenes HTTPS del front y del API.
- Si ya tienes `bun dev` o `python manage.py runserver` corriendo localmente, detenlos para evitar conflictos de puertos.

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
# Ajusta VITE_API_BASE_URL si el backend no está en http://127.0.0.1:8000

bun install
bun dev
```

En desarrollo, Vite suele servir en `http://localhost:5173`. Las peticiones van a `VITE_API_BASE_URL` (por defecto `http://127.0.0.1:8000`); el backend debe permitir CORS para el origen del front.

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
- **Frontend i18n (implementacion y convenciones):** `frontend/docs/i18n-implementacion.md`
- **Planes y estado:** `docs/plan-implementacion-carga-masiva-csv.md`, `frontend/docs/ESTADO-IMPLEMENTACION.md`, etc.

## Variables de entorno (resumen)

| Ámbito | Archivo | Variables destacadas |
|--------|---------|----------------------|
| Docker Compose | `.env` (raiz) | Puertos, Postgres, Django, `VITE_API_BASE_URL` (URL del API desde el navegador) |
| Backend | `backend/.env` | `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DB_ENGINE`, credenciales PostgreSQL o `SQLITE_PATH`, JWT, `CORS_ALLOWED_ORIGINS` |
| Frontend | `frontend/.env` | `VITE_APP_NAME`, `VITE_API_BASE_URL` (URL del backend) |

Copia siempre desde los `.env.example` correspondientes y **no subas** `.env` con secretos reales al control de versiones.
