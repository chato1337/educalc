#!/bin/bash
# Exporta el schema OpenAPI de la API para integración con frontend
# Uso: ./scripts/export-openapi-schema.sh [formato]
# Formato: yaml (default) | json

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${BACKEND_DIR}/docs/openapi"
FORMAT="${1:-yaml}"

cd "$BACKEND_DIR"

# Crear directorio de salida si no existe
mkdir -p "$OUTPUT_DIR"

if [ "$FORMAT" = "json" ]; then
    python manage.py spectacular --file "${OUTPUT_DIR}/schema.json" --format openapi-json --validate
    echo "Schema exportado a: ${OUTPUT_DIR}/schema.json"
else
    python manage.py spectacular --file "${OUTPUT_DIR}/schema.yaml" --format openapi --validate
    echo "Schema exportado a: ${OUTPUT_DIR}/schema.yaml"
fi
