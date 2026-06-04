# syntax=docker/dockerfile:1
# Imagen de producción de MiEmpleadApp (Epic 9.1 / ADR-002).
# Multi-stage: deps -> builder -> runner. El runner corre el servidor Next.js
# standalone como usuario no-root y aplica las migraciones Prisma al arrancar.

ARG NODE_VERSION=20-slim

# ============================================================
# Stage 1: deps — instala dependencias con el lockfile (cacheable)
# ============================================================
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# openssl es requerido por los engines de Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ============================================================
# Stage 2: builder — genera el cliente Prisma y compila Next (standalone)
# ============================================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Genera el cliente Prisma y compila Next en modo standalone.
RUN npx prisma generate
RUN npm run build

# Poda devDependencies dejando SOLO las de producción. Conserva el CLI de Prisma
# y su árbol transitivo completo (@prisma/config → effect/c12/…), necesario para
# `prisma migrate deploy` en el runner, además del cliente generado (.prisma).
RUN npm prune --omit=dev

# ============================================================
# Stage 3: runner — runtime mínimo, no-root
# ============================================================
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# PORT y HOSTNAME los consume el server.js del standalone; PORT es configurable
# desde el compose / Dokploy (default 3000).
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario no-root.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Artefactos del build standalone (incluye server.js y el subconjunto de node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma para aplicar migraciones al arrancar: schema, migraciones y el árbol de
# node_modules de producción (CLI + @prisma/config y sus deps transitivas como
# `effect`, el cliente/engine generado en .prisma, y @prisma/client). Se copia el
# node_modules de producción ya podado para que `prisma migrate deploy` resuelva
# todas sus dependencias (el cherry-pick por carpetas dejaba fuera `effect` y cía).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Script de arranque: crea el directorio del volumen, migra y lanza el server.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
