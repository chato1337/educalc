# Documentación de la API eduCalc

## Acceso a Swagger / OpenAPI

Con el servidor en ejecución:

| Recurso | URL | Descripción |
|---------|-----|-------------|
| **Swagger UI** | http://localhost:8000/api/docs/ | Interfaz interactiva para explorar y probar la API |
| **ReDoc** | http://localhost:8000/api/redoc/ | Documentación alternativa en formato ReDoc |
| **Schema OpenAPI (JSON)** | http://localhost:8000/api/schema/ | Schema en formato JSON (para clientes que consuman la API) |

## Exportar schema para integración con frontend

Para generar un archivo estático del schema OpenAPI (útil para generar clientes TypeScript, React Query, etc.):

### Opción 1: Comando Django

```bash
cd backend

# Exportar en YAML (recomendado para versionado)
python manage.py spectacular --file docs/openapi/schema.yaml --format openapi --validate

# Exportar en JSON
python manage.py spectacular --file docs/openapi/schema.json --format openapi-json --validate
```

### Opción 2: Script de exportación

```bash
cd backend

# YAML (por defecto)
./scripts/export-openapi-schema.sh

# JSON
./scripts/export-openapi-schema.sh json
```

Los archivos se guardan en `backend/docs/openapi/` (crear la carpeta si no existe).

### Datos de prueba (seed)

```bash
cd backend
python manage.py seed_data
```

Crea: institución de referencia (I.E. Agropecuaria Carrizales), campus, año lectivo, grados (PRIMERO–ONCE), escala de valoración (Decreto 1290) y áreas académicas.

### Uso del schema exportado

- **OpenAPI Generator**: Generar cliente TypeScript/JavaScript a partir del schema
- **Swagger Codegen**: Generar SDK para distintos lenguarios
- **Postman/Insomnia**: Importar el archivo JSON/YAML para colecciones
- **Frontend (React/Vue)**: Integrar con herramientas como openapi-typescript, swagger-typescript-api
