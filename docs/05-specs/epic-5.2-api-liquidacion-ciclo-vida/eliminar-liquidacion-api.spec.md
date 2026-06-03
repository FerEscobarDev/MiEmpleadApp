# SPEC: API Eliminar Liquidación — id: epic-5.2-api-liquidacion-ciclo-vida/eliminar-liquidacion-api

**Epic:** [Epic 5.2 — API Liquidación ciclo de vida](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo

Eliminar la liquidación de un mes del historial (con todas sus novedades asociadas). Es la operación `eliminarLiquidacion` del contrato. Solo el empleador (RN-13). La confirmación previa es responsabilidad de la UI (RN-19); el endpoint elimina directamente. Si la liquidación no existe, responde `404`.

## Fuera de Scope (NO testear, NO implementar)

- Cerrar / reabrir (`cerrarLiquidacion`, `reabrirLiquidacion`): spec hermano.
- La confirmación de la UI (RN-19): es trabajo de frontend; aquí el `DELETE` elimina sin pedir confirmación.
- El cliente tipado del frontend y cualquier pantalla.

## Operaciones del Contrato de API

- **Implementa** (backend): `eliminarLiquidacion` — `operationId` de `docs/02-architecture/api-contract.openapi.yaml`.

Path y método (del contrato, EXACTOS):
- `DELETE /api/v1/liquidaciones/{anio}/{mes}` → `eliminarLiquidacion`

El handler `DELETE` se añade al `route.ts` existente de `src/app/api/v1/liquidaciones/[anio]/[mes]/` (junto a GET y PUT).

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`, `mes` en el path (enteros). Sin cuerpo. |
| Salidas (éxito) | `204` sin cuerpo. |
| Salidas (error) | Liquidación inexistente para (empleada, anio, mes) → `404 { code: "LIQUIDACION_NO_ENCONTRADA" }`. Token de empleada (rol no empleador) → `403 { code: "NO_AUTORIZADO" }`. Sin identidad válida → `401 { code: "NO_AUTORIZADO" }`. `anio`/`mes` inválidos → `422 { code: "VALIDACION" }`. Fallo inesperado → `500 { code: "ERROR_INTERNO" }`. |
| Efectos secundarios | Borra la fila `Liquidacion` y, en cascada (schema `onDelete: Cascade`), sus `Inasistencia`, `LiquidacionItem` y `MontoPuntual`. El mes deja de aparecer en `listarLiquidaciones`. Funciona también si la liquidación estaba CERRADA. |
| Idempotencia | Sí en efecto, no en código de respuesta: un segundo `DELETE` del mismo mes responde `404` (ya no existe), pero el estado final es el mismo (mes ausente). |

## Reglas de Negocio

- **BR-1 (RN-19 / HU-19):** eliminar una liquidación es una acción del empleador; la confirmación es de la UI. Una liquidación CERRADA también puede eliminarse. Fuente: business_requirements.md RN-19, HU-19; §Casos Límite "Eliminar una liquidación".
- **BR-2 (RN-13, rol):** eliminar es una escritura: solo el empleador. El token de empleada recibe `403`. Fuente: RN-13; api-contract §1.
- **BR-3 (404 si no existe):** si no hay liquidación para ese mes, responde `404` y no falla con 500. Fuente: api-contract `eliminarLiquidacion` (`404 NotFound`).

## Criterios de Aceptación (≥1 test por ID)

- **AC-1 (eliminar OK):** `DELETE /liquidaciones/{anio}/{mes}` sobre un mes con liquidación existente responde `204` sin cuerpo; tras ello `db.liquidacion.count()` para ese mes es 0.
- **AC-2 (desaparece del historial):** tras eliminar, `listarLiquidaciones` ya no incluye ese mes (verificable vía el repositorio o el GET del historial).
- **AC-3 (cascada de novedades):** eliminar un mes con inasistencias/items/montos borra también esas filas asociadas (`db.inasistencia.count()` / `liquidacionItem` / `montoPuntual` para esa liquidación quedan en 0).
- **AC-4 (404 si no existe, BR-3):** `DELETE` de un mes sin liquidación responde `404 { code: "LIQUIDACION_NO_ENCONTRADA" }`.
- **AC-5 (eliminar una CERRADA, BR-1):** una liquidación en estado CERRADA se elimina igualmente (`204`).
- **AC-6 (rol, 403):** `DELETE` con token de empleada responde `403 { code: "NO_AUTORIZADO" }` y NO borra la fila.
- **AC-7 (auth, 401):** sin sesión de empleador y sin token, `DELETE` responde `401 { code: "NO_AUTORIZADO" }`.
- **AC-8 (validación):** `mes` fuera de 1..12 responde `422 { code: "VALIDACION" }`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1 (doble DELETE):** eliminar dos veces el mismo mes → la primera `204`, la segunda `404` (idempotente en efecto).
- **EC-2 (no afecta otros meses):** eliminar un mes no toca las liquidaciones de otros meses de la misma empleada.

## Superficie de Código Existente (para el implementer)

- Resolución de identidad/rol — `resolverRol(request: Request): Promise<ContextoRol | null>` (`ContextoRol = { rol, empleadaId }`) y `rechazarSiNoEmpleador(request: Request): Promise<Response | null>` (403 si token de empleada sin sesión empleador; null si permitido) en `src/features/auth/authorize.ts`. Header de empleada: `HEADER_ACCESO_TOKEN = "X-Acceso-Token"`.
- Envelope de error — `errorResponse(status, code, message, details?): Response` y `validationErrorResponse(details): Response` (422) en `src/features/config/application/api-error.ts`.
- Repositorio de liquidación — `buscarLiquidacionPorMes(empleadaId, anio, mes): Promise<Liquidacion | undefined>` en `src/features/liquidacion/data/liquidacion-repository.ts`. **Crea aquí** `eliminarLiquidacion(liquidacionId): Promise<void>` (un `db.liquidacion.delete`; la cascada del schema borra inasistencias/items/montos). No accedas a Prisma fuera del repositorio.
- Servicio de liquidación — en `src/features/liquidacion/application/liquidacion-service.ts`, **crea** `eliminarLiquidacionDelMes(empleadaId, anio, mes): Promise<EliminarResult>` con Result `{ ok: true }` | `{ ok: false, error: "LIQUIDACION_NO_ENCONTRADA" }`. Busca la fila por mes; si no existe → error; si existe → llama al repositorio para borrarla.
- **Extiende:** `src/app/api/v1/liquidaciones/[anio]/[mes]/route.ts` añadiendo `export async function DELETE(request: Request, context: RouteContext): Promise<Response>`. Reusar `RouteContext` (`{ params: Promise<{ anio: string; mes: string }> }`), `parsearMes`, las constantes de error y el patrón de guard del PUT existente: primero `rechazarSiNoEmpleador` (403), luego `resolverRol` (401), luego `parsearMes` (422), luego delegar al servicio; mapear `LIQUIDACION_NO_ENCONTRADA`→404. Éxito: `new Response(null, { status: 204 })`.
- Convención Next 15: el primer parámetro del Route Handler es `request: Request` (no opcional); `context.params` es una promesa (await). Patrón exacto en el `route.ts` existente.
- Fixtures (no duplicar): `buildEmpleadaAggregate(overrides?)` en `src/lib/test/factories.ts`; `setupTestDatabase`/`teardownTestDatabase`/`resetDatabase` en `src/lib/test/db-test-setup.ts`. Auth en tests: `vi.mock("@/features/auth/application/session-reader", ...)` sobre `obtenerSesionEmpleador` + `generarEnlace` para token de empleada (patrón en `src/app/api/v1/liquidaciones/[anio]/[mes]/route.test.ts` y `actualizar.test.ts`). Para sembrar la liquidación a eliminar, `db.liquidacion.create` (con novedades anidadas para AC-3). El test del DELETE puede ir en un archivo nuevo co-localizado, p. ej. `src/app/api/v1/liquidaciones/[anio]/[mes]/eliminar.test.ts`, importando `DELETE` desde `./route`.
- Modelos (sin cambios de schema): `Liquidacion`, `Inasistencia`, `LiquidacionItem`, `MontoPuntual` tienen `onDelete: Cascade` desde `Liquidacion`. No requiere migración.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
