# Despliegue de MiEmpleadApp en VPS con Docker + Dokploy

> Guía paso a paso para desplegar MiEmpleadApp en un VPS propio con Docker,
> orquestado por **Dokploy** (ADR-002). La base de datos es **SQLite** en un
> **volumen persistente** con **modo WAL**, en **instancia única**.

## 0. Resumen de la arquitectura de despliegue

- **Una sola instancia** (un contenedor). ADR-002 prohíbe escalar horizontalmente
  con múltiples escritores sobre el mismo archivo `.db`. No subas `replicas` > 1.
- **SQLite en volumen persistente**: el archivo `prod.db` (+ `prod.db-wal` /
  `prod.db-shm` del modo WAL) vive en un **named volume** montado en `/data`. Si
  el volumen no está montado, **los datos se pierden en cada redeploy**.
- **Modo WAL**: lo habilita la app al conectarse (`src/lib/db.ts`,
  `PRAGMA journal_mode=WAL`). No requiere configuración extra; solo asegúrate de
  que `DATABASE_URL` apunte a la ruta dentro del volumen.
- **Imagen runtime delgada**: Next.js compila en modo `standalone`
  (`output: "standalone"` en `next.config.mjs`) y el contenedor arranca
  `node server.js`.
- **Migraciones al arrancar**: el entrypoint corre `prisma migrate deploy`
  (idempotente) antes de levantar el servidor.

## 1. Variables de entorno

Configúralas en Dokploy (sección Environment del servicio) o en un `.env`
para el compose. Referencia completa en `.env.example`:

| Variable | Para qué sirve |
|----------|----------------|
| `DATABASE_URL` | Ruta del archivo SQLite. En producción: `file:/data/prod.db` (dentro del volumen). |
| `AUTH_SECRET` | Secreto de Auth.js para firmar la sesión del empleador. Genéralo con `openssl rand -base64 32`. |
| `AUTH_TRUST_HOST` | `true` detrás del reverse-proxy de Dokploy/Traefik (el código ya fija `trustHost`; esto lo refuerza). |
| `NEXT_PUBLIC_BASE_URL` | Dominio público real con HTTPS (p.ej. `https://miempleada.tudominio.com`). Lo usan los enlaces de consulta y los callbacks de Auth.js. |
| `PORT` | Puerto del servidor (default `3000`). |
| `EMPLEADOR_EMAIL` / `EMPLEADOR_PASSWORD` | Solo para el **seed único** de la cuenta del empleador (no hace falta dejarlas tras el seed). |

> **Importante:** `NEXT_PUBLIC_BASE_URL` se embebe en el cliente en build time
> en lo que respecta a variables `NEXT_PUBLIC_*` usadas en componentes; defínela
> al dominio real **antes** de construir la imagen en Dokploy si tu UI la lee en
> cliente. En runtime también la consume el servidor.

## 2. Opción A — Deploy por Git en Dokploy (recomendado)

1. En Dokploy, crea una aplicación de tipo **Docker (Dockerfile)** o **Compose**
   apuntando a este repositorio (rama `main`).
2. Dokploy detecta el `Dockerfile` (o el `docker-compose.yml`) en la raíz.
3. Define las variables de entorno de la sección 1 en la UI de Dokploy.
4. **Monta el volumen persistente**: crea/monta un volumen llamado
   `miempleadapp-data` en la ruta `/data` del contenedor (ya declarado en
   `docker-compose.yml`). Verifica que `DATABASE_URL=file:/data/prod.db`.
5. Lanza el deploy. El entrypoint creará `/data`, aplicará las migraciones y
   levantará el servidor.

## 3. Opción B — Build + push manual de la imagen

```sh
# En tu máquina o CI (requiere Docker):
docker build -t miempleadapp:latest .
docker tag miempleadapp:latest <tu-registry>/miempleadapp:latest
docker push <tu-registry>/miempleadapp:latest
```

Luego, en el VPS, usa el `docker-compose.yml` (apuntando `image:` a tu registry)
o configura Dokploy para usar esa imagen. Asegúrate del volumen `miempleadapp-data`
en `/data`.

```sh
# En el VPS (con las variables exportadas o un .env junto al compose):
docker compose up -d
```

## 4. Reverse-proxy y HTTPS

Dokploy provisiona **Traefik** como reverse-proxy y gestiona los certificados
HTTPS (Let's Encrypt) automáticamente para tu dominio. Configura el dominio del
servicio en Dokploy y deja que Traefik termine TLS. Como la app corre detrás del
proxy, mantén `AUTH_TRUST_HOST=true` para que Auth.js construya correctamente las
URLs de callback.

## 5. Cuenta del empleador

No hay auto-registro público (RN-13): la cuenta del empleador se crea desde las
variables `EMPLEADOR_EMAIL` / `EMPLEADOR_PASSWORD`.

### 5.1. Automático al desplegar (recomendado)

El entrypoint del contenedor ejecuta un **bootstrap idempotente**
(`scripts/bootstrap-empleador.cjs`) tras aplicar las migraciones: si
`EMPLEADOR_EMAIL` y `EMPLEADOR_PASSWORD` están definidas en el entorno del
servicio y aún no existe un empleador con ese email, **lo crea** (contraseña
hasheada con bcrypt + empleada/configuración por defecto). Es seguro en cada
arranque: si la cuenta ya existe, no hace nada; si las variables no están, omite
el alta sin tumbar el servidor.

Por tanto, basta con definir `EMPLEADOR_EMAIL` / `EMPLEADOR_PASSWORD` en Dokploy y
desplegar. Tras el primer arranque puedes **dejarlas o quitarlas** (si las quitas,
el bootstrap simplemente se omite). Para **cambiar la contraseña** más adelante,
no basta cambiar la variable (no se re-crea si el email ya existe): edita el
registro o usa el script manual contra una BD limpia.

### 5.2. Manual (alternativa)

El seed `npm run seed:empleador` usa `tsx` (devDependency), que **no** está en la
imagen de runtime. Dos formas de ejecutarlo contra el `.db` del volumen:

**Opción 1 — contenedor efímero con dev deps (recomendado):**

```sh
# Desde la raíz del repo en el VPS (o en tu máquina con el volumen accesible):
docker run --rm \
  -v miempleadapp-data:/data \
  -e DATABASE_URL="file:/data/prod.db" \
  -e EMPLEADOR_EMAIL="jefe@tudominio.com" \
  -e EMPLEADOR_PASSWORD="una-contraseña-fuerte" \
  -w /app \
  node:20-slim sh -c "git clone <repo> . 2>/dev/null || true; npm ci && npx prisma migrate deploy && npm run seed:empleador"
```

**Opción 2 — localmente contra una copia y luego subir el `.db`:** ejecuta
`npm run seed:empleador` en local con `DATABASE_URL` apuntando a un archivo, y
copia ese `.db` al volumen antes del primer arranque.

El seed es **idempotente por email**: si ya existe un empleador con ese email, no
crea otro.

> Después del seed, **no** necesitas dejar `EMPLEADOR_EMAIL` / `EMPLEADOR_PASSWORD`
> en el entorno del servicio.

## 6. Backup de la base de datos

Backup = **copiar el archivo `.db` (y sus `-wal` / `-shm`)** fuera del volumen,
de forma periódica. Como SQLite corre en WAL, copiar los tres archivos juntos da
un snapshot consistente para esta carga de trabajo de baja concurrencia.

**Cron diario (en el host del VPS), copiando desde el volumen a `/backups`:**

```sh
# /etc/cron.d/miempleadapp-backup
# Cada día a las 03:15, copia prod.db (+ wal/shm) del volumen a /backups con fecha.
15 3 * * * root docker run --rm \
  -v miempleadapp-data:/data:ro \
  -v /backups/miempleadapp:/backup \
  alpine sh -c 'cp -f /data/prod.db /backup/prod-$(date +\%F).db; \
    cp -f /data/prod.db-wal /backup/ 2>/dev/null; \
    cp -f /data/prod.db-shm /backup/ 2>/dev/null; \
    find /backup -name "prod-*.db" -mtime +14 -delete'
```

> Variante más robusta (snapshot transaccional): instalar `sqlite3` y usar
> `sqlite3 /data/prod.db ".backup /backup/prod-$(date +%F).db"`, que respeta el
> WAL sin copiar archivos a medias. La copia simple de los tres archivos es
> suficiente para el volumen y la concurrencia reales de esta app.

## 7. Restricciones y notas operativas

- **Instancia única**: nunca despliegues múltiples réplicas escritoras contra el
  mismo `.db` (ADR-002). El `deploy.replicas: 1` del compose lo refleja.
- **El volumen es el dato**: trata `miempleadapp-data` como el activo crítico.
  Los redeploys recrean el contenedor pero conservan el volumen.
- **Migraciones**: cada deploy corre `prisma migrate deploy`. Para una migración
  nueva, créala en desarrollo (`prisma migrate dev`), commitea
  `prisma/migrations/**` y redeploya.
- **PWA / consulta offline**: el service worker (`/sw.js`) solo se registra en
  producción y cachea la consulta de menú/tareas de la empleada para verla sin
  conexión; no requiere configuración de despliegue adicional.
