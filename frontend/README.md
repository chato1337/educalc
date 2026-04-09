# eduCalc Frontend

Panel de administracion construido con React + TypeScript + Vite.

## Requisitos

- Bun

## Comandos (Bun)

```bash
# Instalar dependencias
bun install

# Desarrollo
bun run dev

# Lint
bun run lint

# Build
bun run build

# Preview de build
bun run preview

# Generar tipos desde OpenAPI del backend
bun run generate:api-types
```

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Ajusta `VITE_API_BASE_URL` si tu backend no corre en `http://127.0.0.1:8000`.

## Notas

- Este frontend usa Bun como gestor de paquetes y runner de scripts.
- El lockfile oficial es `bun.lock`.
