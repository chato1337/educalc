#!/usr/bin/env bash
# Exporta el schema OpenAPI de la API para integración con frontend.
#
# Uso:
#   ./scripts/export-openapi-schema.sh           → solo schema.json (lo que usa el frontend)
#   ./scripts/export-openapi-schema.sh yaml      → solo schema.yaml
#   ./scripts/export-openapi-schema.sh all      → json y yaml
#
# Requiere Django/drf-spectacular del entorno del proyecto (pipenv recomendado).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${BACKEND_DIR}/docs/openapi"
# Por defecto JSON: package.json del frontend apunta a ../backend/docs/openapi/schema.json
FORMAT="${1:-json}"

cd "$BACKEND_DIR"

if [[ -f Pipfile ]] && command -v pipenv >/dev/null 2>&1; then
  RUN=(pipenv run python)
else
  RUN=(python3)
fi

mkdir -p "$OUTPUT_DIR"

run_spectacular() {
  local out_path="$1"
  local fmt="$2"
  "${RUN[@]}" manage.py spectacular --file "$out_path" --format "$fmt" --validate
}

case "$FORMAT" in
  json)
    run_spectacular "${OUTPUT_DIR}/schema.json" openapi-json
    echo "Schema exportado a: ${OUTPUT_DIR}/schema.json"
    ;;
  yaml)
    run_spectacular "${OUTPUT_DIR}/schema.yaml" openapi
    echo "Schema exportado a: ${OUTPUT_DIR}/schema.yaml"
    ;;
  all)
    run_spectacular "${OUTPUT_DIR}/schema.json" openapi-json
    run_spectacular "${OUTPUT_DIR}/schema.yaml" openapi
    echo "Schemas exportados a: ${OUTPUT_DIR}/schema.json y ${OUTPUT_DIR}/schema.yaml"
    ;;
  *)
    echo "Formato desconocido: $FORMAT (use json, yaml o all)" >&2
    exit 1
    ;;
esac
