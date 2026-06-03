# SPEC: Consulta offline (PWA) — id: epic-9-1-consulta-offline-despliegue/pwa-offline

**Epic:** Epic 9.1 (ROADMAP §Milestone 9)   **Módulo:** architecture.md §2.1 Capa de Presentación (UI)

## Objetivo
Permitir que la empleada consulte la última información de menú y tareas vista aunque
quede sin conexión. La app instalable (PWA) cachea el "app shell" de consulta y las
respuestas de los endpoints de lectura, sirviéndolas desde caché cuando la red no
responde. También se corrige el favicon ausente (la app responde 404 a `/favicon.ico`).

## Fuera de Scope (NO testear, NO implementar)
- Caché o reintento offline de **mutaciones** (`marcarTarea`): el alcance es solo consulta de lectura.
- Sincronización en segundo plano (Background Sync) o push notifications.
- Registro del service worker en desarrollo: el SW se registra **solo** en producción.
- Caché de rutas del rol empleador (configuración, liquidar, menú-edición, etc.).
- Generación de iconos nuevos: ya existen `public/icons/icon-192.png` y `icon-512.png`.

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
- **Consume** (lectura, vía caché en runtime): `obtenerMenu` (`GET /menu`), `obtenerTareasDelDia` (`GET /tareas/dia`), `obtenerRutinaTareas` (`GET /tareas/rutina`). El SW solo cachea respuestas `GET`; no redefine shapes.
- **Sin boundary HTTP nuevo:** el SW es infraestructura del cliente; no agrega operaciones al contrato.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

Lógica pura testeable: una función que decide la **estrategia de caché** de una petición.

| Aspecto | Detalle |
|---------|---------|
| Entradas | `request`: `{ method: string, url: string }` (subconjunto inspeccionable de `Request`) |
| Salidas (éxito) | `CacheStrategy`: `"network-first"` (GET de los 3 endpoints de consulta) \| `"app-shell"` (navegación a `/consulta/...` y assets del shell) \| `"network-only"` (todo lo demás: mutaciones, otros métodos, otras rutas) |
| Salidas (error) | N/A — función total, nunca lanza; entradas inválidas → `"network-only"` |
| Efectos secundarios | Ninguno (función pura, sin acceso a `caches`/`fetch`) |
| Idempotencia | Sí — misma entrada, misma salida |

## Reglas de Negocio
- **BR-1:** "Consulta sin conexión (deseable)": la empleada debe poder ver la última info de menú y tareas sin conexión — fuente: business_requirements.md §Restricciones No Funcionales de Negocio.
- **BR-2:** Solo lectura para la empleada (RN-13): no se cachean ni reproducen escrituras offline.
- **BR-3:** El SW se registra **únicamente** cuando `NODE_ENV === "production"` para evitar assets obsoletos en dev — fuente: decisión de proceso del epic.
- **BR-4:** Las peticiones que no sean `GET` nunca se sirven desde caché (`network-only`).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Un `GET` a `/api/v1/menu` resuelve estrategia `network-first`.
- **AC-2:** Un `GET` a `/api/v1/tareas/dia` resuelve estrategia `network-first`.
- **AC-3:** Un `GET` a `/api/v1/tareas/rutina` resuelve estrategia `network-first`.
- **AC-4:** Un `POST` a `/api/v1/tareas/cumplimiento` (marcarTarea) resuelve `network-only` (no se cachea la mutación).
- **AC-5:** Una navegación `GET` a `/consulta/abc123` resuelve estrategia `app-shell`.
- **AC-6:** Un `GET` a una ruta del empleador (`/api/v1/configuracion`) resuelve `network-only` (no es endpoint de consulta).
- **AC-7:** Existe `public/manifest.webmanifest` válido con name, short_name, start_url, display=standalone, lang=es-CO e icons (ya cubierto por `src/app/manifest.test.ts`; no regresionar).
- **AC-8:** Existe un favicon servible (la app deja de responder 404 a `/favicon.ico`).
- **AC-9:** Existe el archivo del service worker (`public/sw.js`) y un módulo de registro que solo lo registra en producción.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** `GET /api/v1/menu/configuracion` (ruta del empleador que empieza igual que `/menu`) → `network-only` (debe hacer match exacto del endpoint de consulta, no prefijo laxo).
- **EC-2:** URL con query string (`/api/v1/tareas/dia?fecha=2026-06-03`) → `network-first` (se ignora el query al clasificar).
- **EC-3:** Método en minúsculas o mixto (`get`) → tratado como GET (case-insensitive).
- **EC-4:** URL no parseable / vacía → `network-only` (sin lanzar).

## Superficie de Código Existente (para el implementer)
- Crea: `resolveCacheStrategy(request)` en `src/lib/pwa/cache-strategy.ts` — firma: `(request: { method: string; url: string }) => CacheStrategy`; `type CacheStrategy = "network-first" | "app-shell" | "network-only"`.
- Crea: `public/sw.js` (service worker hand-written, sin build step). Implementa la misma clasificación que `resolveCacheStrategy` (la lógica vive duplicada en JS plano porque el SW corre fuera del bundle; el test certifica la versión TS, el SW la espeja).
- Crea: `src/components/pwa/service-worker-registrar.tsx` — componente cliente que registra `/sw.js` solo si `process.env.NODE_ENV === "production"` y `"serviceWorker" in navigator`. Montado en `src/app/layout.tsx`.
- Crea: `src/app/icon.svg` (o favicon equivalente) — icono teal con "M" para resolver el 404 de favicon. Next App Router sirve `src/app/icon.*` como `<link rel=icon>`.
- Modifica: `src/app/layout.tsx` — monta `<ServiceWorkerRegistrar />`.
- Endpoints de consulta (paths bajo `/api/v1`): `obtenerMenu`=`/menu`, `obtenerTareasDelDia`=`/tareas/dia`, `obtenerRutinaTareas`=`/tareas/rutina` (api-contract.openapi.yaml).
- Fixtures disponibles: ninguno específico; usar datos inline en el test.
</content>
</invoke>
