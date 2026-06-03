# SPEC: API de Items de Pago Adicional — id: epic-3.2-api-items-adicionales/items-adicionales-api

**Epic:** [Epic 3.2 — API Items de pago adicional](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo

Exponer el CRUD de los **items de pago adicional** del catálogo de configuración de la empleada (ej. "Noche de acompañamiento $20.000"): listar, crear, actualizar y eliminar. Cada item tiene nombre, valor unitario (entero COP), color opcional para el calendario y un indicador `activo`. Los items pertenecen a la empleada actual, resuelta por la costura de autenticación existente.

## Fuera de Scope (NO testear, NO implementar)

- Autenticación/autorización real por rol (RN-13): se difiere a Epic 4.2; se usa la costura `getCurrentEmpleadaId()` tal cual, sin chequeo de rol.
- El uso de items dentro de una liquidación y su **congelamiento** (snapshot de `LiquidacionItem`): pertenece a Epic 5.1; aquí solo se gestiona el catálogo. Editar/eliminar un item del catálogo NO debe alterar snapshots ya creados (se cubre con una aserción de no-regresión, ver AC-9).
- El cliente tipado del frontend y cualquier pantalla.
- Paginación, filtros y ordenamiento avanzado del listado.

## Operaciones del Contrato de API

- **Implementa** (backend): `listarItemsAdicionales`, `crearItemAdicional`, `actualizarItemAdicional`, `eliminarItemAdicional` — `operationId` de `docs/02-architecture/api-contract.openapi.yaml`.

Paths y métodos (del contrato, EXACTOS):
- `GET /api/v1/items-adicionales` → `listarItemsAdicionales`
- `POST /api/v1/items-adicionales` → `crearItemAdicional`
- `PUT /api/v1/items-adicionales/{id}` → `actualizarItemAdicional`
- `DELETE /api/v1/items-adicionales/{id}` → `eliminarItemAdicional`

El segmento `{id}` se implementa con la ruta dinámica de Next.js App Router `[id]`.

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

Shapes (resumen del contrato — la fuente de verdad es `ItemAdicional` / `ItemAdicionalInput` en el OpenAPI):

- `ItemAdicional` (salida): `{ id: string, nombre: string, valorUnitario: int (COP), color: string | null, activo: boolean }`.
- `ItemAdicionalInput` (entrada): `{ nombre: string, valorUnitario: int, color?: string | null, activo?: boolean (default true) }`.

| Aspecto | Detalle |
|---------|---------|
| Entradas | **GET**: ninguna (empleada por costura de auth). **POST/PUT**: body `ItemAdicionalInput`. **PUT/DELETE**: `id` en el path. |
| Salidas (éxito) | **GET** → `200` con `ItemAdicional[]`. **POST** → `201` con el `ItemAdicional` creado. **PUT** → `200` con el `ItemAdicional` actualizado. **DELETE** → `204` sin cuerpo. |
| Salidas (error) | Validación Zod fallida → `422` envelope `{ code: "VALIDACION", message, details }`. `id` inexistente (PUT/DELETE) → `404` envelope `{ code: "ITEM_NO_ENCONTRADO", message }`. Fallo inesperado → `500` envelope `{ code: "ERROR_INTERNO", message }`. |
| Efectos secundarios | POST crea fila `ItemAdicional` de la empleada actual; PUT actualiza sus campos; DELETE la borra. Sin emisión de eventos. |
| Idempotencia | GET sí. POST no (cada llamada crea un item nuevo). PUT sí (mismo body ⇒ mismo estado). DELETE sí en efecto (segunda llamada sobre el mismo id ⇒ `404`). |

Notas de mapeo:
- `valorUnitario`: entero COP, `>= 0`, sin decimales (RN-16). Rechazar no-entero, negativo y tipos no numéricos.
- `color`: opcional en la entrada. En persistencia el modelo `ItemAdicional.color` es `String` no-nulo; cuando la entrada no provee `color` (o es `null`), se persiste cadena vacía `""`. En la salida, una cadena vacía se serializa como `color: null` para conformar el contrato (`color` nullable).
- `activo`: opcional en la entrada con default `true`; siempre presente en la salida.

## Reglas de Negocio

- **BR-1 (RN-08):** los items de pago adicional son conceptos con **valor unitario** entero en COP que luego se cobran por cantidad en la liquidación (`total = ... + Σ(cantidad × valor unitario)`). Fuente: business_requirements.md §Reglas de Negocio RN-08. Aquí solo se gestiona el catálogo de valores unitarios.
- **BR-2 (RN-09):** el **congelamiento** ocurre cuando un item se **usa** dentro de una liquidación (snapshot en `LiquidacionItem`), no al editar el catálogo. Por lo tanto, editar o eliminar un item del catálogo **no** altera retroactivamente los `LiquidacionItem` ya creados. Fuente: business_requirements.md §Reglas de Negocio RN-09; architecture.md §4 (snapshot de `LiquidacionItem`, `itemId` opcional con `onDelete: SetNull`).
- **BR-3 (RN-16):** todos los montos se manejan como **enteros en COP** sin decimales.
- **BR-4 (RN-13, diferida):** la escritura es responsabilidad del rol empleador; la autorización por rol se aplicará en Epic 4.2 sobre la costura de auth, sin reescribir estos handlers. Aquí NO se implementa chequeo de rol.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `GET` sin items registrados responde `200` con un arreglo vacío `[]`.
- **AC-2:** `GET` con items registrados responde `200` con todos los items de la empleada actual, cada uno conformando el DTO `ItemAdicional` (`id`, `nombre`, `valorUnitario`, `color`, `activo`).
- **AC-3:** `POST` con body válido responde `201` con el `ItemAdicional` creado (incluye `id` generado) y queda persistido (verificable con un `GET` posterior).
- **AC-4:** `POST` sin `activo` en el body crea el item con `activo: true` por default.
- **AC-5:** `PUT /{id}` con body válido sobre un item existente responde `200` con el item actualizado y persiste los cambios (round-trip por `GET`).
- **AC-6:** `PUT /{id}` con un `id` inexistente responde `404` con envelope `{ code: "ITEM_NO_ENCONTRADO" }`.
- **AC-7:** `DELETE /{id}` sobre un item existente responde `204` sin cuerpo y el item desaparece del listado.
- **AC-8:** `DELETE /{id}` con un `id` inexistente responde `404` con envelope `{ code: "ITEM_NO_ENCONTRADO" }`.
- **AC-9 (BR-2 / RN-09):** eliminar un item del catálogo que ya fue usado en una liquidación (existe un `LiquidacionItem` con snapshot `nombre`/`valorUnitario`) **no** borra ni altera el `LiquidacionItem`; el snapshot persiste intacto (su `itemId` puede quedar en `null`).
- **AC-10:** `POST` con `nombre` vacío responde `422` con envelope `{ code: "VALIDACION", details }`.
- **AC-11:** `POST` con `valorUnitario` negativo responde `422` `VALIDACION`.
- **AC-12:** `POST` con `valorUnitario` no entero (decimal) responde `422` `VALIDACION`.
- **AC-13:** `POST` con `valorUnitario` de tipo incorrecto (string) responde `422` `VALIDACION`.
- **AC-14:** `POST`/`PUT` con JSON malformado en el cuerpo responde `422` `VALIDACION` (no `500`).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** `POST` con `color` ausente persiste el item y lo devuelve con `color: null` en la salida.
- **EC-2:** `POST` con `color` provisto (ej. `"#FF8800"`) lo persiste y lo devuelve tal cual.
- **EC-3:** `PUT` que cambia `activo` de `true` a `false` se refleja en el listado posterior.

## Superficie de Código Existente (para el implementer)

- Costura de auth — llama a: `getCurrentEmpleadaId(): Promise<string>` en `src/features/auth/current-empleada.ts`. Lanza `EmpleadaNoResueltaError` (`error.name === "EmpleadaNoResueltaError"`) si no hay empleada.
- Envelope de error — llama a: `errorResponse(status: number, code: string, message: string, details?: unknown): Response` y `validationErrorResponse(details: unknown): Response` (devuelve `422`, code `"VALIDACION"`) en `src/features/config/application/api-error.ts`. Constante `CODE_VALIDACION = "VALIDACION"`. **Reutilizar este módulo** (no duplicar el envelope).
- Cliente Prisma único — `db` en `src/lib/db.ts` (acceso solo desde la capa de persistencia).
- Modelo Prisma `ItemAdicional`: `{ id: String @id @default(cuid()), empleadaId: String, nombre: String, valorUnitario: Int, color: String, activo: Boolean @default(true) }`; relación `liquidacionItems`. Modelo `LiquidacionItem`: `{ id, liquidacionId, itemId: String? (onDelete: SetNull), nombre, valorUnitario, cantidad }` (el snapshot sobrevive al borrado del item). No requiere cambios de schema.
- Validación Zod existente como referencia de estilo: `src/features/config/application/schemas.ts` (`z.int().min(0, ...)`, `z.string().min(1, ...)`).
- Crea: ruta `src/app/api/v1/items-adicionales/route.ts` (GET, POST) y `src/app/api/v1/items-adicionales/[id]/route.ts` (PUT, DELETE).
- Crea: servicio de aplicación `src/features/items-adicionales/application/items-adicionales-service.ts` (orquesta repositorio + mapeo DTO; aplica defaults `activo`/`color`).
- Crea: esquemas Zod `src/features/items-adicionales/application/schemas.ts` (`itemAdicionalInputSchema`).
- Crea: repositorio `src/features/items-adicionales/data/items-adicionales-repository.ts` (`listarItems`, `crearItem`, `actualizarItem`, `eliminarItem`, `buscarItemPorId` vía Prisma).
- Fixtures disponibles (no duplicar): `buildEmpleadaAggregate(overrides?)` en `src/lib/test/factories.ts`; `setupTestDatabase` / `teardownTestDatabase` / `resetDatabase` en `src/lib/test/db-test-setup.ts`; cliente `db` en `src/lib/db.ts`. La base SQLite de prueba la provee el `globalSetup` de Vitest (config single-fork, `fileParallelism: false`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
