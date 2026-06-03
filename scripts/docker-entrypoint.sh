#!/bin/sh
# Entrypoint del contenedor de producción (Epic 9.1 / ADR-002).
# 1) Asegura el directorio del archivo SQLite (volumen persistente).
# 2) Aplica las migraciones Prisma (idempotente: prisma migrate deploy).
# 3) Lanza el servidor Next.js standalone.
set -e

# DATABASE_URL viene como "file:/data/prod.db" (ruta dentro del volumen montado).
# Extraemos la ruta del archivo y aseguramos que su directorio exista (EC-1).
DB_PATH="$(printf '%s' "${DATABASE_URL:-file:/data/prod.db}" | sed -e 's#^file:##')"
DB_DIR="$(dirname "$DB_PATH")"
mkdir -p "$DB_DIR"

echo "[entrypoint] Aplicando migraciones Prisma (migrate deploy)…"
# prisma migrate deploy es idempotente: no falla si ya están aplicadas (EC-2).
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Iniciando servidor Next.js standalone en el puerto ${PORT:-3000}…"
exec node server.js
