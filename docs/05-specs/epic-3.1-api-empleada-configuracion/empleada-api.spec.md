# SPEC: API Empleada — id: epic-3.1-api-empleada-configuracion/empleada-api

**Epic:** Epic 3.1 (API Empleada y Configuración) — `docs/04-roadmap/ROADMAP.md`
**Módulo:** §2.2 Frontera (Route Handlers), §2.3 Aplicación, §2.5 Persistencia — `docs/02-architecture/architecture.md`

## Objetivo
Exponer la ficha de la empleada por la frontera HTTP: leer la ficha (`obtenerEmpleada`) y crear/actualizar la ficha y las fechas de contrato (`actualizarEmpleada`). La entrada se valida con Zod en la frontera; la persistencia reutiliza el repositorio de Epic 1.2. La resolución de "la empleada del empleador actual" se hace por una costura (seam) marcada que el Epic 4.2 cableará a la sesión real.

## Fuera de Scope (NO testear, NO implementar)
- Autenticación/autorización real (Auth.js, token de empleada, rol RN-13): NO se implementa aquí. Solo se deja la costura `getCurrentEmpleadaId()` con TODO referenciando Epic 4. NO escribir tests que bloqueen un chequeo de auth falso.
- Configuración (`salarioBase`, `diasLaborales`): la cubre el spec hermano `configuracion-api`.
- Cálculo o destacado del cumpleaños en UI (RN-20): aquí solo se persiste/devuelve `fechaNacimiento`, que es la base del recordatorio. La UI de cumpleaños es Fase 8.
- Generación del cliente tipado de frontend.

## Operaciones del Contrato de API
> Fuente de verdad: `docs/02-architecture/api-contract.openapi.yaml` (+ `api-contract.md`). NO redefinir shapes aquí.
- **Implementa** (backend): `obtenerEmpleada` (GET `/api/v1/empleada`), `actualizarEmpleada` (PUT `/api/v1/empleada`).
- DTO involucrado: `Empleada` = `{ nombre: string, fechaNacimiento: date, fechaInicioContrato: date, fechaFinContrato?: date|null }`. Envelope de error único: `Error` = `{ code, message, details? }`.

## Contrato (machine-readable)

### `obtenerEmpleada` — GET `/api/v1/empleada`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Ninguna (la empleada se resuelve por la costura `getCurrentEmpleadaId()`). |
| Salidas (éxito) | `200` con body `Empleada` (`fechaNacimiento`/`fechaInicioContrato`/`fechaFinContrato` como string `YYYY-MM-DD`; `fechaFinContrato` `null` si no hay fin). |
| Salidas (error) | No existe ficha para la empleada resuelta → `404` con envelope `{ code: "EMPLEADA_NO_ENCONTRADA", message }`. |
| Efectos secundarios | Ninguno (lectura). |
| Idempotencia | Sí. |

### `actualizarEmpleada` — PUT `/api/v1/empleada`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Body JSON validado con Zod contra el DTO `Empleada`: `nombre` string no vacío; `fechaNacimiento`, `fechaInicioContrato` strings `YYYY-MM-DD` válidos; `fechaFinContrato` opcional, string `YYYY-MM-DD` o `null`. |
| Salidas (éxito) | `200` con body `Empleada` (la ficha persistida, fechas como `YYYY-MM-DD`). |
| Salidas (error) | Entrada inválida (Zod) → `422` con envelope `{ code: "VALIDACION", message, details }` (`details` lleva los issues de Zod). JSON malformado en el body → `422` mismo envelope. |
| Efectos secundarios | Crea o actualiza (upsert) la ficha `Empleada` de la empleada resuelta vía la capa de aplicación → repositorio. |
| Idempotencia | Sí (PUT: el mismo body produce el mismo estado). |

## Reglas de Negocio
- **BR-1 (RN-13):** solo el empleador escribe la ficha. En este epic la autorización real NO existe; se deja la costura `getCurrentEmpleadaId()` con TODO(Epic 4) para que la frontera de escritura aplique el rol después SIN reescribir el handler. No se debe simular un chequeo de rol. Fuente: business_requirements.md RN-13.
- **BR-2 (RN-20):** la ficha incluye `fechaNacimiento`, base del recordatorio de cumpleaños; debe persistirse y devolverse fielmente en round-trip. Fuente: business_requirements.md RN-20.
- **BR-3 (§5.4 architecture):** toda la entrada de escritura se valida con Zod en la frontera; la autoridad de validación está en el backend, no en la UI.
- **BR-4 (§2.2/§6 architecture, conventions §4):** el Route Handler NO contiene lógica de negocio ni accede a Prisma directamente; delega en la capa de aplicación, que usa el repositorio (cliente Prisma único `lib/db`).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** `GET /api/v1/empleada` con una empleada existente (creada vía factory) responde `200` y un body cuyo shape conforma `Empleada`: `nombre` igual al persistido, `fechaNacimiento`/`fechaInicioContrato` como string `YYYY-MM-DD`, `fechaFinContrato` presente (string o `null`).
- **AC-2:** `GET /api/v1/empleada` cuando la empleada resuelta no tiene ficha responde `404` con envelope `{ code: "EMPLEADA_NO_ENCONTRADA", message }`.
- **AC-3:** `PUT /api/v1/empleada` con body válido (`nombre`, `fechaNacimiento`, `fechaInicioContrato`, `fechaFinContrato` null) responde `200` y devuelve la `Empleada` actualizada con esos valores; un `GET` posterior devuelve los mismos datos (round-trip por la base SQLite real).
- **AC-4:** `PUT /api/v1/empleada` con `nombre` vacío responde `422` con envelope `{ code: "VALIDACION", message, details }`.
- **AC-5:** `PUT /api/v1/empleada` con una fecha malformada (ej. `fechaNacimiento: "10-05-1990"` o `"no-es-fecha"`) responde `422` con envelope `VALIDACION`.
- **AC-6:** `PUT /api/v1/empleada` con `fechaFinContrato` provista (string `YYYY-MM-DD`) persiste y devuelve esa fecha; el round-trip la conserva.

## Edge Cases (los que cambian comportamiento)
- **EC-1:** body con JSON malformado (no parseable) → `422` envelope `VALIDACION` (no `500`).
- **EC-2:** `fechaFinContrato` omitido (campo ausente) → se persiste como `null` y la respuesta lo devuelve `null`.
- **EC-3:** `PUT` ejecutado dos veces con el mismo body válido → segundo `PUT` también `200` con el mismo resultado (idempotente, upsert).

## Superficie de Código Existente (para el implementer)
- Repositorio existente (Epic 1.2) — `src/features/config/data/empleada-repository.ts`:
  - `buscarEmpleadaPorEmpleador(empleadorId: string): Promise<Empleada | undefined>`
  - `obtenerConfiguracionDeEmpleada(empleadaId: string): Promise<Configuracion | undefined>`
  - `crearEmpleadorConEmpleada(input: CrearEmpleadorConEmpleadaInput): Promise<EmpleadorConEmpleada>`
  - Tipos Prisma: `Empleada = { id, empleadorId, nombre, fechaNacimiento: Date, fechaInicioContrato: Date, fechaFinContrato: Date | null }`.
  - NOTA: el repositorio actual NO tiene un método para actualizar/upsert solo la ficha Empleada por `empleadaId`. El implementer debe AÑADIR al repositorio una función de persistencia de la ficha (ej. `actualizarFichaEmpleada(empleadaId, datos): Promise<Empleada>`) usando el cliente único `db` (`@/lib/db`), respetando §2.5 (solo persistencia toca Prisma). Las fechas se guardan como `DateTime`.
- Cliente Prisma único — `src/lib/db.ts`: export `db` (`PrismaClient`). NINGÚN otro módulo instancia Prisma.
- Crea (nuevos):
  - `src/app/api/v1/empleada/route.ts` — Route Handlers `GET` y `PUT` (frontera). Importa Zod, el servicio de aplicación y la costura de auth. Devuelve `Response`/`NextResponse` JSON. Loggea errores de frontera (conventions §6).
  - `src/features/config/application/empleada-service.ts` — servicio de aplicación: `obtenerEmpleada(empleadaId)` y `guardarEmpleada(empleadaId, datos)`; orquesta repositorio; convierte entre `Date` (persistencia) y string `YYYY-MM-DD` (DTO de la frontera) — el mapeo a DTO puede vivir aquí o en un mapper del feature, pero NO en el handler.
  - Costura de auth — `src/features/auth/current-empleada.ts` (o similar bajo `src/features/auth/`): `getCurrentEmpleadaId(): Promise<string>` con un TODO(Epic 4.2) explícito. Para este epic single-tenant resuelve la única empleada existente en la base (ej. `db.empleada.findFirst`). Marcar claramente que Epic 4 lo reemplaza por la sesión real. NO implementar chequeo de rol falso.
  - Helper de envelope de error — `src/features/config/application/` o `src/lib/`: una utilidad para construir el envelope `{ code, message, details? }` y mapearlo a `Response` con el status correcto (reutilizable por el spec hermano).
  - Esquemas Zod — junto al handler o en un módulo `*-schema.ts` del feature `config`: esquema del DTO `Empleada` de entrada (PUT).
- Fixtures disponibles (NO duplicar): `src/lib/test/factories.ts` → `buildEmpleadaAggregate(overrides)`; `src/lib/test/db-test-setup.ts` → `setupTestDatabase`, `resetDatabase`, `teardownTestDatabase`. Los tests de integración corren en un solo worker (ver `vitest.config.ts`); reusar el patrón de `empleada-repository.test.ts` (beforeAll/afterAll/beforeEach).
- Invocar el handler en tests: importar la función `GET`/`PUT` del módulo `route.ts` y llamarla con un `Request` construido a mano (`new Request("http://localhost/api/v1/empleada", { method, body })`), evitando levantar el server.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés/español según conventions.md §8.*
