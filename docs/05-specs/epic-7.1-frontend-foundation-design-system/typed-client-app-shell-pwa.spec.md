# SPEC: Cliente tipado del contrato + shell de app + PWA — id: epic-7.1-frontend-foundation-design-system/typed-client-app-shell-pwa

**Epic:** [ROADMAP Epic 7.1 — Frontend Foundation y Design System](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.1 Capa de Presentación](../../02-architecture/architecture.md#21-capa-de-presentación-ui)

## Objetivo
Generar el **cliente tipado** de la UI a partir de `docs/02-architecture/api-contract.openapi.yaml` (tipos con `openapi-typescript` + wrapper delgado `openapi-fetch` apuntando a `/api/v1`), de modo que la UI consuma el backend **solo** por el cliente tipado (nunca URLs a mano). Más el **shell base** de la app (layout/estructura) y el andamiaje **PWA** (manifest + metadatos). No consume datos aún (Milestone 8). Sin lógica de negocio.

## Fuera de Scope (NO testear, NO implementar)
- Tokens (spec A) y componentes/showcase (spec B).
- Implementar pantallas reales del empleador/empleada (Milestone 8).
- Service worker / caché offline completa (Epic 9.1); aquí solo el **manifest** y los metadatos PWA básicos.
- Llamadas reales al backend en runtime (no hay páginas que consuman todavía).

## Operaciones del Contrato de API
- **Consume (genera el cliente de TODAS, no invoca aún):** todas las `operationId` de `api-contract.openapi.yaml` (auth, acceso, empleada, configuración, items, liquidaciones, menú, tareas). El cliente tipado se genera a partir de los `paths` del contrato; ninguna URL se escribe a mano.

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | El archivo OpenAPI `docs/02-architecture/api-contract.openapi.yaml`. |
| Salidas (éxito) | (1) Tipos generados en `src/lib/api/schema.d.ts` (paths/components). (2) Wrapper tipado `src/lib/api/client.ts` que exporta un cliente `openapi-fetch` con `baseUrl: "/api/v1"`. (3) Script `gen:api` en `package.json`. (4) `manifest` PWA + metadatos. |
| Salidas (error) | El cliente expone errores como valor (`{ data, error }` de openapi-fetch), no excepciones, para llamadas 4xx/5xx. |
| Efectos secundarios | Generación de código (build-time); ninguno en runtime en este epic. |
| Idempotencia | `gen:api` es idempotente: re-ejecutar produce el mismo `schema.d.ts` para el mismo contrato. |

## Reglas de Negocio
- **BR-1:** La UI consume el backend **exclusivamente** vía el cliente tipado generado desde el contrato; **prohibido** escribir URLs a mano. — fuente: architecture.md §2.1, §6 (boundaries), navigation_map.md.
- **BR-2:** El cliente apunta a la base `/api/v1` (servers del contrato). — fuente: api-contract.openapi.yaml (`servers`).
- **BR-3:** PWA instalable (Restricción No Funcional). — fuente: business_requirements.md (Restricciones No Funcionales — PWA).
- **BR-4:** Idioma español (Colombia) y moneda COP se mantienen a nivel de app (lang, dirección de formato). — fuente: business_requirements.md (Restricciones No Funcionales).
- **BR-5:** El cliente tipado debe reflejar el **envelope de error único** y los enums del contrato (la generación los deriva automáticamente). — fuente: api-contract.openapi.yaml (`components/schemas/Error`, enums).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Existe un script `gen:api` en `package.json` que ejecuta `openapi-typescript` sobre el contrato y emite el archivo de tipos a `src/lib/api/`.
- **AC-2:** El archivo de tipos generado (`src/lib/api/schema.d.ts`) existe y exporta `paths` que incluyen rutas del contrato (p.ej. `/empleada`, `/liquidaciones/{anio}/{mes}`, `/tareas/cumplimiento`).
- **AC-3:** El wrapper `src/lib/api/client.ts` exporta un cliente creado con `openapi-fetch` tipado por `paths`, con `baseUrl` `/api/v1`.
- **AC-4:** El cliente tipado, al invocar una operación representativa (p.ej. `GET /empleada`) con `fetch` mockeado, dirige la petición al **path correcto** (`/api/v1/empleada`) — verificando que no se escriben URLs a mano sino que el path proviene del contrato.
- **AC-5:** Una operación con parámetro de path (p.ej. `obtenerLiquidacion` → `/liquidaciones/{anio}/{mes}`) construye la URL sustituyendo los parámetros (`/api/v1/liquidaciones/2026/6`) cuando se invoca con `params.path`.
- **AC-6:** Los tipos generados incluyen el componente `Error` (envelope) y los enums (`EstadoLiquidacion`, `TipoDiaCalendario`, `DiaSemana`, `Periodicidad`) — verificable importando los tipos en un archivo de test que compila (type-level assertion) o comprobando su presencia en el archivo generado.
- **AC-7:** Existe `public/manifest.webmanifest` (o `manifest.json`) con `name`, `short_name`, `start_url`, `display: standalone`, `lang: es-CO` y al menos un icono; el `RootLayout`/metadata lo referencia.
- **AC-8:** `next build` produce un build de producción sin exponer la ruta de showcase dev-only y sin romper por la generación de tipos (el `schema.d.ts` se versiona en el repo).

## Edge Cases (los que cambian comportamiento)
- **EC-1:** Re-ejecutar `gen:api` sin cambios en el contrato → `schema.d.ts` idéntico (idempotente).
- **EC-2:** Operación que devuelve `204` (sin cuerpo, p.ej. `revocarEnlaceAcceso`) → el cliente la tipa con `data` vacío/ausente y `error` ausente en éxito.
- **EC-3:** Llamada que el backend respondería 4xx → el cliente retorna `{ error }` (no lanza), con el shape del envelope `Error`.

## Superficie de Código Existente (para el implementer)
- Lee: `docs/02-architecture/api-contract.openapi.yaml` (contrato; fuente del generador).
- Modifica: `package.json` (agrega script `gen:api`).
- Modifica: `src/app/layout.tsx` (referencia al manifest en `metadata`; mantiene `lang="es-CO"` y la fuente del spec A).
- Crea: `src/lib/api/schema.d.ts` (generado por `gen:api`), `src/lib/api/client.ts` (wrapper), `public/manifest.webmanifest`, iconos PWA en `public/` (placeholders válidos).
- Crea (opcional, shell): estructura base de layout reutilizable en `src/components/layout/*` si aporta al shell; NO páginas de Milestone 8.
- Fixtures disponibles: ninguno; el test del cliente mockea `fetch` global.
- Dependencias ya instaladas: `openapi-fetch` (runtime), `openapi-typescript` (dev).
- Convenciones: identificadores en inglés; 2 espacios; comillas dobles en TSX, según ESLint/Prettier en TS; `;` obligatorios; línea ≤100. El cliente y el wrapper viven en `src/lib/api/` (utilidad transversal, kebab-case de archivo no aplica a `.d.ts` generado).
</content>
