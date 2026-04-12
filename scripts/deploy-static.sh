#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"

case "${ENVIRONMENT}" in
  staging)
    TARGET_DIR="/home/vpsroot/apps/project-dev/html"
    COMPOSE_FILE="/home/vpsroot/apps/project-dev/docker-compose.yml"
    ;;
  prod)
    TARGET_DIR="/home/vpsroot/apps/project-prod/html"
    COMPOSE_FILE="/home/vpsroot/apps/project-prod/docker-compose.yml"
    ;;
  *)
    echo "Usage: $0 <staging|prod>"
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"
if command -v npm >/dev/null 2>&1; then
  npm ci
  npm run build
else
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "${ROOT_DIR}:${ROOT_DIR}" \
    --workdir "${ROOT_DIR}" \
    node:20-bookworm \
    bash -lc 'npm ci && npm run build'
fi

mkdir -p "${TARGET_DIR}"
rsync -az --delete "${ROOT_DIR}/dist/" "${TARGET_DIR}/"

docker compose -f "${COMPOSE_FILE}" up -d --force-recreate

echo "Frontend deployed to ${ENVIRONMENT}"
