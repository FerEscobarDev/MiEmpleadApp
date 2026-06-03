# SPEC: API Actualizar novedades de la Liquidación — id: epic-5.1-api-liquidacion-lectura-novedades/actualizar-liquidacion-api

**Epic:** [Epic 5.1 — API Liquidación lectura y novedades](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo

Ir alimentando las **novedades** del borrador del mes (inasistencias, cantidades de items, montos puntuales y notas) y **recalcular en vivo** el desglose. Solo el empleador puede escribir. Valida las inasistencias (RN-05) y rechaza editar una liquidación cerrada (RN-11). Es la operación `actualizarLiquidacion` del contrato. Devuelve la `Liquidacion` actualizada con el desglose y calendario recalculados.

## Fuera de Scope (NO testear, NO implementar)

- Cerrar / reabrir / eliminar (Epic 5.2). Este spec solo NO debe permitir editar una liquidación ya CERRADA (rechazo `409`); la transición a CERRADA la produce Epic 5.2.
- El congelamiento de valores (RN-09): Epic 5.2. Mientras es borrador, el cálculo usa la configuración vigente.
- El cliente tipado del frontend y cualquier pantalla.
- Inicialización del borrador por `obtenerLiquidacion`: spec hermano (este spec asume que la liquidación se obtiene/crea por su propia lógica si aún no existe, reutilizando la del spec hermano).

## Operaciones del Contrato de API

- **Implementa** (backend): `actualizarLiquidacion` — `operationId` de `docs/02-architecture/api-contract.openapi.yaml`.

Path y método (del contrato, EXACTOS):
- `PUT /api/v1/liquidaciones/{anio}/{mes}` → `actualizarLiquidacion`

Los segmentos `{anio}`/`{mes}` con rutas dinámicas `[anio]/[mes]` (mismo archivo de ruta que `obtenerLiquidacion`).

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

Shape de entrada (resumen del contrato — fuente de verdad: `ActualizarLiquidacionInput` en el OpenAPI):

- `ActualizarLiquidacionInput`: `{ inasistencias?: date[] (YYYY-MM-DD), items?: { itemId: string, cantidad: int >= 0 }[], montosPuntuales?: { descripcion: string, monto: int }[], notas?: string }`.

Salida: `Liquidacion` (mismo shape que `obtenerLiquidacion`).

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`, `mes` en el path; body `ActualizarLiquidacionInput`. |
| Salidas (éxito) | `200` con la `Liquidacion` recalculada (desglose + calendario + novedades). Notas siempre presentes (solo el empleador escribe/lee aquí). |
| Salidas (error) | Liquidación CERRADA → `409` `{ code: "LIQUIDACION_CERRADA" }`. Alguna inasistencia inválida (festivo / no laboral / fuera de contrato) → `409` `{ code: "INASISTENCIA_INVALIDA", details }` (RN-05). Body inválido (Zod: fecha mal formada, `cantidad` negativa/no entera, `monto` no entero, `descripcion` vacía) → `422` `{ code: "VALIDACION", details }`. Mes íntegramente fuera de contrato → `409` `{ code: "MES_FUERA_DE_CONTRATO" }`. Rol empleada (token) → `403` `{ code: "NO_AUTORIZADO" }`. Fallo inesperado → `500`. |
| Efectos secundarios | Reemplaza las novedades persistidas de la liquidación por las del input (las claves presentes); recalcula. Si la liquidación no existe aún para el mes (liquidable), se inicializa BORRADOR antes de aplicar (RN-10). |
| Idempotencia | Sí: el mismo input deja el mismo estado persistido (reemplazo, no acumulación) y la misma respuesta. |

Semántica de reemplazo (set, no append):
- `inasistencias` presente ⇒ las inasistencias persistidas pasan a ser exactamente ese conjunto (deduplicado).
- `items` presente ⇒ los `LiquidacionItem` pasan a ser exactamente esa lista; cada `{itemId, cantidad}` se resuelve a `nombre`/`valorUnitario` desde el catálogo vigente (`ItemAdicional`) para el cálculo en vivo; un `cantidad: 0` se persiste como tal (o se omite — comportamiento consistente verificado por test).
- `montosPuntuales` presente ⇒ reemplaza la lista de montos.
- `notas` presente ⇒ reemplaza el valor; ausente ⇒ no se toca.
- Una clave **ausente** en el input no modifica esa categoría de novedad.

## Reglas de Negocio

- **BR-1 (RN-05, inasistencia válida):** una inasistencia solo es válida en un día **laboral, no festivo y dentro del contrato**. Si alguna fecha del input no lo cumple, la operación falla con `409 INASISTENCIA_INVALIDA` y NO persiste cambios. Fuente: business_requirements.md RN-05.
- **BR-2 (RN-08, recálculo):** tras persistir, el `total` se recalcula con el dominio: subtotalDías + Σ(cantidad × valorUnitario) + Σ montos. Fuente: RN-08.
- **BR-3 (RN-11, liquidación cerrada):** una liquidación en estado CERRADA está **bloqueada** para edición; intentar actualizarla responde `409 LIQUIDACION_CERRADA` y no modifica nada. Fuente: RN-11.
- **BR-4 (RN-10):** una sola liquidación por (empleada, año, mes); actualizar opera sobre esa única fila (la inicializa si falta). Fuente: RN-10.
- **BR-5 (RN-12/RN-13):** solo el empleador puede actualizar; el rol empleada (token) recibe `403 NO_AUTORIZADO`. Fuente: RN-13.
- **BR-6 (mes fuera de contrato):** un mes íntegramente fuera del contrato no es liquidable → `409 MES_FUERA_DE_CONTRATO`. Fuente: §Casos Límite.
- **BR-7 (RN-16):** montos enteros COP.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1 (persistir inasistencias):** `PUT` con `inasistencias` válidas responde `200`; las fechas quedan persistidas y aparecen en `inasistencias` de la respuesta y como `INASISTENCIA` en el calendario; `diasTrabajados` baja en consecuencia (RN-04).
- **AC-2 (persistir items + recálculo, RN-08):** `PUT` con `items: [{itemId, cantidad}]` responde `200`; la respuesta incluye el `LiquidacionItem` con `nombre`/`valorUnitario` resueltos del catálogo y `subtotal = valorUnitario × cantidad`; `desglose.subtotalItems` y `desglose.total` los incorporan.
- **AC-3 (persistir montos puntuales, RN-08):** `PUT` con `montosPuntuales: [{descripcion, monto}]` responde `200`; aparecen en la respuesta y `desglose.subtotalMontosPuntuales`/`total` los suman.
- **AC-4 (notas):** `PUT` con `notas` las persiste y las devuelve (el escritor es empleador).
- **AC-5 (recálculo total, RN-08):** con inasistencias + items + montos combinados, `desglose.total` = subtotalDías (tras inasistencias) + subtotalItems + subtotalMontos, coincidiendo con `calcularDesglose(...)`.
- **AC-6 (inasistencia inválida → 409, RN-05):** `PUT` con una inasistencia en día **no laboral** (o festivo, o fuera de contrato) responde `409` `{ code: "INASISTENCIA_INVALIDA" }` y NO persiste ninguna de las inasistencias del input (estado sin cambios).
- **AC-7 (liquidación cerrada → 409, RN-11):** `PUT` sobre una liquidación en estado CERRADA responde `409` `{ code: "LIQUIDACION_CERRADA" }` y no modifica nada.
- **AC-8 (Zod 422):** `PUT` con `items[].cantidad` negativa (o `monto` no entero, o fecha mal formada, o `descripcion` vacía) responde `422` `{ code: "VALIDACION", details }`.
- **AC-9 (rol empleada → 403, RN-13):** `PUT` con header `X-Acceso-Token` de empleada (sin sesión de empleador) responde `403` `{ code: "NO_AUTORIZADO" }` y no modifica nada.
- **AC-10 (reemplazo idempotente):** dos `PUT` con el mismo body dejan el mismo estado (no se duplican inasistencias/items/montos) y la misma respuesta; el conteo de filas hijas es estable.
- **AC-11 (reemplazo set):** un segundo `PUT` con `inasistencias` distintas reemplaza por completo el conjunto anterior (las viejas desaparecen), no se acumula.
- **AC-12 (mes fuera de contrato → 409):** `PUT` sobre un mes íntegramente fuera de contrato responde `409` `{ code: "MES_FUERA_DE_CONTRATO" }`.
- **AC-13 (JSON malformado):** `PUT` con cuerpo JSON inválido responde `422` `VALIDACION` (no `500`).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1 (clave ausente no borra):** un `PUT` que solo trae `notas` no borra inasistencias/items/montos previos.
- **EC-2 (inasistencia duplicada):** fechas repetidas en `inasistencias` se cuentan una sola vez (deduplicado) en el cálculo y en la persistencia.
- **EC-3 (item con cantidad 0):** se acepta (`200`); su `subtotal` es 0 y no aporta al total; comportamiento de persistencia consistente entre llamadas.
- **EC-4 (todas inasistencias):** registrar inasistencia en todos los días laborales en contrato deja `diasTrabajados` = 0 y `subtotalDias` = 0; total = items + montos.
- **EC-5 (lista vacía explícita):** `inasistencias: []` (o `items: []`) limpia esa categoría (reemplazo por conjunto vacío).

## Superficie de Código Existente (para el implementer)

- Guard de rol — `rechazarSiNoEmpleador(request: Request): Promise<Response | null>` en `src/features/auth/authorize.ts` (devuelve `403 NO_AUTORIZADO` si hay token de empleada y no es empleador; `null` si la escritura está permitida). `resolverRol` / `ContextoRol` también disponibles.
- Validación de inasistencias (dominio, RN-05) — `validarInasistencias(inasistencias: string[], ctx: ContextoInasistencia): string[]` (devuelve las inválidas; vacío ⇒ todas válidas) y `esInasistenciaValida(fecha, ctx): boolean` en `src/features/liquidacion/domain/calculo.ts`, con `ContextoInasistencia = { diasLaborales: DiaSemana[], festivos: string[], fechaInicioContrato: string, fechaFinContrato: string | null }`.
- Dominio del cálculo y calendario — `calcularDesglose(entrada: EntradaDesglose): Desglose` y `construirCalendario(entrada: EntradaCalendario): DiaCalendario[]` (firmas en los specs hermanos). `items` para `calcularDesglose` son `{ valorUnitario, cantidad }[]`; `montosPuntuales` son `{ monto }[]`.
- Catálogo de items (para resolver nombre/valor en vivo) — `buscarItemPorId(itemId: string): Promise<ItemAdicional | undefined>` y/o `listarItems(empleadaId): Promise<ItemAdicional[]>` en `src/features/items-adicionales/data/items-adicionales-repository.ts` (`ItemAdicional = { id, nombre, valorUnitario, ... }`).
- Repositorio de liquidación — `buscarLiquidacionPorMes`, `crearLiquidacion` en `src/features/liquidacion/data/liquidacion-repository.ts`. Extender con persistencia de novedades (reemplazo de `Inasistencia`/`LiquidacionItem`/`MontoPuntual` por `liquidacionId`, p.ej. `reemplazarNovedades(liquidacionId, { inasistencias, items, montosPuntuales, notas? })` usando `deleteMany` + `createMany`/`create` y `update` de `notas`/`estado`). Sin lógica de negocio (solo persistencia).
- Conversión de fechas — `toIsoDate`/`isoToDate` en `src/features/config/application/date-iso.ts`; validación de formato ISO `isIsoDate(value): boolean`.
- Envelope de error — `errorResponse(status, code, message, details?)`, `validationErrorResponse(details)` en `src/features/config/application/api-error.ts`.
- Cliente Prisma único — `db` en `src/lib/db.ts`.
- **Crea:** los métodos `PUT` en `src/app/api/v1/liquidaciones/[anio]/[mes]/route.ts` (junto al `GET` del spec hermano). Firma `(request, context: { params: Promise<{ anio: string, mes: string }> })`.
- **Crea:** esquema Zod `actualizarLiquidacionInputSchema` en `src/features/liquidacion/application/schemas.ts` (`inasistencias` array de fecha ISO; `items` array de `{ itemId: string.min(1), cantidad: int.min(0) }`; `montosPuntuales` array de `{ descripcion: string.min(1), monto: int }`; `notas` string opcional). Estilo: `src/features/config/application/schemas.ts`.
- **Extiende:** servicio `src/features/liquidacion/application/liquidacion-service.ts` con `actualizarLiquidacionDelMes(empleadaId, anio, mes, input): Promise<Result>` que: rechaza mes fuera de contrato (409), inicializa si falta, rechaza si CERRADA (409), valida inasistencias con el dominio (409 si hay inválidas), persiste el reemplazo de novedades, recalcula y arma la `Liquidacion`. Errores de negocio como retorno explícito (conventions.md §6); el handler los mapea a status/code.
- Fixtures (no duplicar): `buildEmpleadaAggregate`, `setupTestDatabase`/`resetDatabase`/`teardownTestDatabase`; cliente `db`. Crear un item del catálogo con `db.itemAdicional.create({ data: { empleadaId, nombre, valorUnitario, color: "", activo: true } })`. Autenticación de empleador/empleada en tests: mock de `obtenerSesionEmpleador` + `generarEnlace` (patrón en `src/app/api/v1/rn13-enforcement.test.ts`). Para sembrar una liquidación CERRADA: `db.liquidacion.create({ data: { empleadaId, anio, mes, estado: "CERRADA" } })`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
