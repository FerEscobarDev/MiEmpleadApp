# SPEC: Despliegue VPS Docker/Dokploy — id: epic-9-1-consulta-offline-despliegue/despliegue-docker

**Epic:** Epic 9.1 (ROADMAP §Milestone 9)   **Módulo:** architecture.md §DevOps; ADR-002

## Objetivo
Preparar (NO ejecutar) los artefactos para desplegar MiEmpleadApp en un VPS con Docker
gestionado por Dokploy: imagen runtime delgada del servidor Next.js standalone, volumen
persistente para el archivo SQLite (modo WAL), aplicación de migraciones al arrancar,
backup por copia del `.db` y documentación paso a paso en español. Instancia única.

## Fuera de Scope (NO testear, NO implementar)
- Ejecutar `docker build`/`docker push`/`docker compose up`: solo se producen archivos.
- Desplegar en ningún VPS ni tocar infraestructura real.
- CI/CD pipeline (`devops.ci_cd: none`).
- Migrar a Postgres o a múltiples réplicas escritoras (prohibido por ADR-002).

## Operaciones del Contrato de API
- N/A — configuración/infraestructura, sin boundary HTTP nuevo.

## Contrato (machine-readable)
Entregables (archivos), no símbolos de código:

| Aspecto | Detalle |
|---------|---------|
| Entradas | Variables de entorno: `AUTH_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`, `AUTH_TRUST_HOST`, `EMPLEADOR_EMAIL`, `EMPLEADOR_PASSWORD`, `PORT` |
| Salidas (éxito) | `next.config.mjs` con `output: "standalone"`; `Dockerfile`; `.dockerignore`; `docker-compose.yml`; `.env.example` actualizado; `docs/06-deployment/DEPLOY.md` |
| Salidas (error) | N/A |
| Efectos secundarios | Ninguno en build/test; en deploy real: migraciones aplicadas y `.db` en volumen |
| Idempotencia | `prisma migrate deploy` es idempotente; el seed es idempotente por email |

## Reglas de Negocio
- **BR-1:** SQLite en **volumen persistente** Docker; sin él, los datos se pierden en cada redeploy — ADR-002.
- **BR-2:** **Modo WAL** habilitado (ya lo hace `src/lib/db.ts`); confirmar que `DATABASE_URL` apunta a la ruta del volumen — ADR-002.
- **BR-3:** **Instancia única** (una réplica), sin escalado horizontal con múltiples escritores — ADR-002.
- **BR-4:** **Backup** por copia periódica del `.db` (+ `-wal`/`-shm`) — ADR-002.
- **BR-5:** `trustHost` ya está activo en el código de Auth.js; documentar `AUTH_TRUST_HOST` y el reverse-proxy HTTPS (Dokploy/Traefik).

## Criterios de Aceptación (verificación estática, no docker build)
- **AC-1:** `next.config.mjs` exporta `output: "standalone"`.
- **AC-2:** `next build` sigue verde y emite `.next/standalone` (incluye `server.js`).
- **AC-3:** Existe un `Dockerfile` multi-stage (deps → builder → runner) que: corre como usuario no-root, expone un `PORT` configurable, arranca `node server.js` del standalone, y aplica el schema al arrancar (`prisma migrate deploy`).
- **AC-4:** Existe `.dockerignore` que excluye `node_modules`, `.next`, `.git`, `*.db*`, `*.png`, etc.
- **AC-5:** Existe `docker-compose.yml` con: 1 servicio app, `deploy.replicas: 1` (o equivalente single-instance), un **named volume** montado en el directorio del `.db`, y las env vars requeridas; `DATABASE_URL` apunta a la ruta del volumen.
- **AC-6:** `.env.example` documenta toda variable requerida con una línea de explicación cada una, incluida `NEXT_PUBLIC_BASE_URL` y la nota `AUTH_TRUST_HOST`.
- **AC-7:** Existe `docs/06-deployment/DEPLOY.md` (español) con pasos: build/deploy en Dokploy, set de env vars, montaje del volumen, seed único (`npm run seed:empleador`), `NEXT_PUBLIC_BASE_URL` al dominio real, nota HTTPS/reverse-proxy, cron de backup, nota trustHost y restricción de instancia única.
- **AC-8:** Consistencia interna Dockerfile↔compose↔.env (mismo PORT, misma ruta de `DATABASE_URL` que el mount del volumen): revisión estática.

## Edge Cases
- **EC-1:** El directorio del volumen no existe al primer arranque → la entrada del contenedor crea el directorio antes de migrar (`mkdir -p`).
- **EC-2:** Migraciones ya aplicadas → `prisma migrate deploy` no falla (idempotente).
- **EC-3:** Prisma necesita su engine en el runner standalone → copiar `node_modules/.prisma` y/o el cliente generado al runner, o ejecutar `prisma generate` en build (documentar el enfoque elegido).

## Superficie de Código Existente (para el implementer)
- Modifica: `next.config.mjs` (actual: `{ reactStrictMode: true }`) → añade `output: "standalone"`.
- Modifica: `.env.example` (actual: DATABASE_URL, AUTH_SECRET, EMPLEADOR_EMAIL/PASSWORD) → añade `NEXT_PUBLIC_BASE_URL`, `AUTH_TRUST_HOST`, `PORT`.
- Crea: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docs/06-deployment/DEPLOY.md`.
- Script de seed: `npm run seed:empleador` → `tsx scripts/seed-empleador.ts` (lee `EMPLEADOR_EMAIL`/`PASSWORD`; idempotente por email).
- Cliente Prisma: `src/lib/db.ts` ya hace `PRAGMA journal_mode=WAL`.
- Migraciones existentes: `prisma/migrations/20260603030033_init`.
- Auth: `trustHost` ya activo en la config de Auth.js (NextAuth v5).
</content>
