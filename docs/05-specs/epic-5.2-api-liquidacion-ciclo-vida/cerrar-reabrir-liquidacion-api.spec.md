# SPEC: API Cerrar / Reabrir Liquidación (congelamiento RN-09) — id: epic-5.2-api-liquidacion-ciclo-vida/cerrar-reabrir-liquidacion-api

**Epic:** [Epic 5.2 — API Liquidación ciclo de vida](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo

Cerrar (aplicar) la liquidación de un mes **congelando** los valores vigentes (salario base, días laborales y los valores unitarios de los items, más el total calculado), y reabrir una liquidación cerrada para volverla a editar. Una vez cerrada, la lectura del mes (`obtenerLiquidacion`, Epic 5.1) **debe** computar el desglose con los valores **congelados**, no con la configuración vigente (RN-09). Reabrir devuelve la liquidación a BORRADOR; volver a cerrarla re-congela los valores vigentes en ese momento. Son las operaciones `cerrarLiquidacion` y `reabrirLiquidacion` del contrato; ambas son solo del empleador (RN-13).

## Fuera de Scope (NO testear, NO implementar)

- Eliminar liquidaciones (`eliminarLiquidacion`): spec hermano `eliminar-liquidacion-api`.
- Cambiar el cálculo del dominio puro (`calcularDesglose`, `construirCalendario`): se reutilizan sin tocar.
- Editar novedades (`actualizarLiquidacion`, Epic 5.1): solo se verifica que sigue rechazando con `409 LIQUIDACION_CERRADA` una liquidación CERRADA y que vuelve a permitir editar tras reabrir (no se reimplementa).
- El cliente tipado del frontend y cualquier pantalla.
- Asociar items a días concretos del calendario (`DiaCalendario.itemsAdicionales`): sigue fuera de scope (igual que en Epic 5.1).

## Operaciones del Contrato de API

- **Implementa** (backend): `cerrarLiquidacion`, `reabrirLiquidacion` — `operationId` de `docs/02-architecture/api-contract.openapi.yaml`.

Paths y métodos (del contrato, EXACTOS):
- `POST /api/v1/liquidaciones/{anio}/{mes}/cierre` → `cerrarLiquidacion`
- `POST /api/v1/liquidaciones/{anio}/{mes}/reapertura` → `reabrirLiquidacion`

Los segmentos `{anio}`/`{mes}` se implementan con rutas dinámicas de Next.js App Router `[anio]/[mes]`, con sub-rutas `/cierre` y `/reapertura` (cada una su propio `route.ts` con un handler `POST`).

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

Shapes (fuente de verdad: `Liquidacion`, `Desglose`, `LiquidacionItem` en el OpenAPI; idénticos a Epic 5.1). El cuerpo de éxito de ambas operaciones es el DTO `Liquidacion` completo (mismo shape que `obtenerLiquidacion`), con el `estado` ya actualizado.

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`, `mes` en el path (enteros). Sin cuerpo de petición. |
| Salidas (éxito) | `cerrarLiquidacion`: `200` con `Liquidacion` (`estado: "CERRADA"`). `reabrirLiquidacion`: `200` con `Liquidacion` (`estado: "BORRADOR"`). |
| Salidas (error) | `cerrarLiquidacion`: `409 { code: "LIQUIDACION_CERRADA" }` si ya está cerrada. `reabrirLiquidacion`: `409 { code: "LIQUIDACION_BORRADOR" }` si ya está en borrador. Ambas: mes inexistente/no inicializado → ver EC-5 (`409 MES_FUERA_DE_CONTRATO` si el mes nunca pudo liquidarse; en caso normal se opera sobre la fila existente o se inicializa). `anio`/`mes` inválidos (no enteros, `mes` ∉ 1..12) → `422 { code: "VALIDACION" }`. Token de empleada (rol no empleador) → `403 { code: "NO_AUTORIZADO" }`. Sin identidad válida → `401 { code: "NO_AUTORIZADO" }`. Fallo inesperado → `500 { code: "ERROR_INTERNO" }`. |
| Efectos secundarios | `cerrarLiquidacion` persiste en la fila `Liquidacion`: `estado = "CERRADA"`, `salarioBaseCongelado` (salario vigente), `diasLaboralesCongelado` (días laborales vigentes, JSON), `totalCongelado` (total calculado en vivo en el momento del cierre). Los `LiquidacionItem` ya guardan su snapshot `nombre`/`valorUnitario` (Epic 5.1); el cierre garantiza que el snapshot persistido refleja los valores vigentes del catálogo. `reabrirLiquidacion` persiste `estado = "BORRADOR"`. (Los campos congelados pueden conservarse o limpiarse al reabrir; el cálculo en borrador vuelve a usar la configuración vigente de cualquier forma.) Operación atómica (transacción) para el cierre. |
| Idempotencia | No: `cerrarLiquidacion` repetida sobre una CERRADA da `409`; `reabrirLiquidacion` repetida sobre una BORRADOR da `409`. |

Notas de congelamiento (RN-09 — núcleo del epic):
- Al **cerrar**, se calcula el desglose en vivo con la configuración vigente (igual que un borrador) y se persisten: `salarioBaseCongelado` = `salarioBase` vigente; `diasLaboralesCongelado` = `diasLaborales` vigentes (JSON); `totalCongelado` = `desglose.total` calculado en ese instante. Los items de la liquidación conservan su `valorUnitario`/`nombre` snapshot (ya persistido por `actualizarLiquidacion`); si el snapshot guardado no estuviera alineado con el catálogo vigente, el cierre lo re-sincroniza al valor vigente.
- Tras el cierre, **leer** el mes (`obtenerLiquidacion`) computa el `desglose` usando `salarioBaseCongelado` y `diasLaboralesCongelado` (no la configuración vigente) y los `valorUnitario` snapshot de los items. Esto garantiza que cambiar luego el salario, los días laborales o el valor de catálogo de un item **no** altera el mes cerrado.
- El `calendario` de un mes cerrado se construye con los `diasLaboralesCongelado` (para que el coloreado refleje la configuración del cierre, no la vigente).
- Una liquidación en **borrador** se sigue calculando en vivo (sin cambios respecto a Epic 5.1).
- `reabrir` devuelve a BORRADOR: las ediciones (Epic 5.1 PUT) vuelven a permitirse y el cálculo vuelve a vivo. Cerrar de nuevo re-congela los valores vigentes en ese momento.

## Reglas de Negocio

- **BR-1 (RN-09, congelamiento):** al cerrar se congelan salario base, días laborales y valores de items; el total del mes cerrado queda fijo. Cambios posteriores en configuración o catálogo NO recalculan un mes cerrado; sí afectan borradores y meses futuros. Fuente: business_requirements.md RN-09; §Casos Límite "Cambio de configuración tras cerrar meses".
- **BR-2 (RN-11, ciclo):** una liquidación está en BORRADOR (editable) o CERRADA (bloqueada). El empleador puede cerrar un borrador, reabrir una cerrada (vuelve a BORRADOR) y volver a cerrarla. Cerrar una ya cerrada o reabrir una ya en borrador es un conflicto de estado (`409`). Fuente: RN-11; §Casos Límite "Reapertura y nuevo cierre".
- **BR-3 (RN-13, rol):** cerrar y reabrir son escrituras: solo el empleador. El token de empleada recibe `403`. Fuente: RN-13; api-contract §1.
- **BR-4 (RN-08, total congelado correcto):** el `totalCongelado` persistido es exactamente el `total` que `calcularDesglose` produce con los datos vigentes en el momento del cierre. Fuente: RN-08.
- **BR-5 (RN-16):** montos enteros COP; `diasLaboralesCongelado` se guarda como JSON (array de `DiaSemana`).
- **BR-6 (re-cierre re-congela):** tras reabrir y cambiar la configuración, un nuevo cierre congela los NUEVOS valores vigentes (no los del cierre anterior). Fuente: §Casos Límite "Reapertura y nuevo cierre".

## Criterios de Aceptación (≥1 test por ID)

- **AC-1 (cierre OK):** `POST /liquidaciones/{anio}/{mes}/cierre` sobre un mes en BORRADOR responde `200` con `estado: "CERRADA"`. La fila persiste `salarioBaseCongelado`, `diasLaboralesCongelado` y `totalCongelado` no nulos; `totalCongelado` = `desglose.total` del cuerpo.
- **AC-2 (RN-09, congelamiento de salario):** cerrar un mes; luego cambiar `salarioBase` en la configuración a un valor distinto; volver a `GET` el mes cerrado → el `desglose` (valorDia, subtotalDias, total) es el del cierre, **idéntico** al de antes del cambio (NO refleja el nuevo salario).
- **AC-3 (RN-09, congelamiento de días laborales):** cerrar un mes; luego cambiar `diasLaborales` en la configuración; `GET` el mes cerrado → `desglose.diasLaboralesMes` y el `calendario` reflejan los días laborales del cierre, no los nuevos.
- **AC-4 (RN-09, congelamiento de valor de item):** un mes con un item (cantidad ≥ 1) se cierra; luego se cambia el `valorUnitario` del item en el catálogo; `GET` el mes cerrado → el `subtotalItems`/`items[].valorUnitario` siguen siendo los del cierre, no el nuevo valor.
- **AC-5 (cierre 409 si ya cerrada, BR-2):** cerrar dos veces el mismo mes → la segunda responde `409 { code: "LIQUIDACION_CERRADA" }`.
- **AC-6 (reapertura OK, RN-11):** `POST /liquidaciones/{anio}/{mes}/reapertura` sobre un mes CERRADO responde `200` con `estado: "BORRADOR"`; la fila queda en BORRADOR.
- **AC-7 (reapertura 409 si ya borrador, BR-2):** reabrir un mes que está en BORRADOR responde `409 { code: "LIQUIDACION_BORRADOR" }`.
- **AC-8 (editar tras reabrir):** tras reabrir, un `PUT` (actualizarLiquidacion) sobre ese mes vuelve a responder `200` (la edición ya no está bloqueada), a diferencia de cuando estaba cerrada.
- **AC-9 (RN-09 ya no aplica tras reabrir → vivo):** cerrar con salario A; reabrir; cambiar salario a B; `GET` → el desglose ahora se calcula en vivo con B (ya no congelado).
- **AC-10 (re-cierre re-congela, BR-6):** cerrar con salario A; reabrir; cambiar salario a B; cerrar de nuevo; `GET` → el desglose queda congelado con B (no con A).
- **AC-11 (rol, cierre 403):** `POST .../cierre` con token de empleada responde `403 { code: "NO_AUTORIZADO" }` y NO cambia el estado.
- **AC-12 (rol, reapertura 403):** `POST .../reapertura` con token de empleada responde `403 { code: "NO_AUTORIZADO" }`.
- **AC-13 (auth):** sin sesión de empleador y sin token, `POST .../cierre` responde `401 { code: "NO_AUTORIZADO" }`.
- **AC-14 (validación):** `mes` fuera de 1..12 en cierre o reapertura responde `422 { code: "VALIDACION" }`.
- **AC-15 (el PUT sobre CERRADA sigue 409):** verificar que `actualizarLiquidacion` (Epic 5.1) sobre un mes cerrado por esta operación sigue devolviendo `409 LIQUIDACION_CERRADA` (no se debilita).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1 (cierre de mes sin novedades):** cerrar un mes en BORRADOR sin inasistencias/items/montos → `200 CERRADA`; `totalCongelado` = subtotalDías del cierre.
- **EC-2 (cierre inicializa si falta):** cerrar un mes liquidable que aún no tiene fila `Liquidacion` la inicializa y la cierra en el mismo paso (`200 CERRADA`, una sola fila). Alternativamente, si se decide exigir que exista, documentarlo; la opción preferida es inicializar-y-cerrar para no exigir un GET previo.
- **EC-3 (congelamiento de total con 0 días):** si al cerrar `diasTrabajados` = 0, `totalCongelado` = Σ items + Σ montos (puede ser 0).
- **EC-4 (reabrir conserva novedades):** reabrir no borra inasistencias/items/montos persistidos; siguen ahí para editarse.
- **EC-5 (mes fuera de contrato):** cerrar/reabrir un mes íntegramente fuera de contrato (sin fila y no liquidable) responde `409 MES_FUERA_DE_CONTRATO` (no inicializa). Reutiliza la decisión de Epic 5.1.

## Superficie de Código Existente (para el implementer)

- Resolución de identidad/rol — `resolverRol(request: Request): Promise<ContextoRol | null>` (`ContextoRol = { rol: "EMPLEADOR" | "EMPLEADA", empleadaId: string }`) y `rechazarSiNoEmpleador(request: Request): Promise<Response | null>` (devuelve `403` si hay token de empleada sin sesión de empleador; `null` si la escritura está permitida) en `src/features/auth/authorize.ts`. Header de empleada: `HEADER_ACCESO_TOKEN = "X-Acceso-Token"`.
- Envelope de error — `errorResponse(status, code, message, details?): Response` y `validationErrorResponse(details): Response` (422, code "VALIDACION") en `src/features/config/application/api-error.ts`.
- Repositorio de liquidación — en `src/features/liquidacion/data/liquidacion-repository.ts`:
  - `buscarLiquidacionPorMes(empleadaId, anio, mes): Promise<Liquidacion | undefined>`
  - `crearLiquidacion(input: { empleadaId, anio, mes, estado?, notas? }): Promise<Liquidacion>`
  - `cargarNovedades(liquidacionId): Promise<NovedadesLiquidacion>` con `NovedadesLiquidacion = { inasistencias: string[], items: { itemId: string | null, nombre, valorUnitario, cantidad }[], montosPuntuales: { id, descripcion, monto }[] }`
  - `reemplazarNovedades(liquidacionId, reemplazo): Promise<void>`
  - Tipo `Liquidacion` (Prisma) ya incluye `estado: string`, `salarioBaseCongelado: number | null`, `diasLaboralesCongelado: Json | null`, `totalCongelado: number | null`. **Crea aquí** funciones nuevas: para persistir el cierre (set estado + campos congelados, atómico, idealmente re-sincronizando snapshots de items con el catálogo vigente) y para la reapertura (set estado BORRADOR). No accedas a Prisma fuera de este repositorio.
- Configuración / ficha — `obtenerConfiguracionDeEmpleada(empleadaId)` (devuelve `{ salarioBase: number, diasLaborales: Json }` o equivalente) y `buscarEmpleadaPorId(empleadaId): Promise<Empleada | undefined>` (`fechaInicioContrato: Date`, `fechaFinContrato: Date | null`) en `src/features/config/data/empleada-repository.ts`.
- Catálogo de items — `listarItems(empleadaId): Promise<ItemAdicional[]>` (`{ id, nombre, valorUnitario, ... }`) en `src/features/items-adicionales/data/items-adicionales-repository.ts`.
- Festivos — `getHolidaysInMonth(year: number, month: number): string[]` en `src/features/liquidacion/domain/festivos.ts`.
- Dominio — `calcularDesglose(entrada: EntradaDesglose): Desglose` y `construirCalendario(entrada): DiaCalendario[]` (firmas en `src/features/liquidacion/domain/calculo.ts` y `calendario.ts`; ya usados por el servicio). `contarDiasLaboralesEnContrato(year, month, diasLaborales, fechaInicioContrato, fechaFinContrato): number` en `dias-laborales.ts` (resultado 0 ⇒ mes fuera de contrato).
- Conversión de fechas — `toIsoDate(date)` / `isoToDate(value)` en `src/features/config/application/date-iso.ts`.
- Servicio de liquidación — en `src/features/liquidacion/application/liquidacion-service.ts`:
  - `obtenerLiquidacionDelMes(empleadaId, anio, mes): Promise<ObtenerLiquidacionResult>` (Result `{ ok: true, liquidacion: LiquidacionDto }` | `{ ok: false, error: "MES_FUERA_DE_CONTRATO" }`). **Ajustar** (RN-09): cuando `row.estado === "CERRADA"`, el desglose/calendario deben computarse con `salarioBaseCongelado` y `diasLaboralesCongelado` de la fila (no con la configuración vigente) y con los `valorUnitario` snapshot de los items (ya es así para items vía `cargarNovedades`). Helper interno `resolverContexto` arma el `ContextoCalculo` vigente; añadir una variante que lo arme desde los valores congelados de una fila CERRADA. `armarDto`/`desgloseDe` ya reciben el contexto como parámetro: pasar el contexto congelado para CERRADA.
  - `listarResumenLiquidaciones(empleadaId)`: idealmente el `total` de una fila CERRADA en el historial debe ser `totalCongelado` (consistente con RN-09); ajustarlo si recalcula en vivo (al menos no debe contradecir el mes cerrado). Mantener verde su test de Epic 5.1.
  - **Crea** `cerrarLiquidacionDelMes(empleadaId, anio, mes): Promise<CerrarResult>` con Result que distinga `{ ok: true, liquidacion }` | `{ ok: false, error: "LIQUIDACION_CERRADA" }` | `{ ok: false, error: "MES_FUERA_DE_CONTRATO" }`. Decide fuera-de-contrato e inicializa si falta (EC-2/EC-5), rechaza si ya CERRADA, calcula el desglose vigente, persiste estado+congelados (transacción del repositorio), y devuelve el DTO `Liquidacion` (estado CERRADA, desglose congelado).
  - **Crea** `reabrirLiquidacionDelMes(empleadaId, anio, mes): Promise<ReabrirResult>` con Result `{ ok: true, liquidacion }` | `{ ok: false, error: "LIQUIDACION_BORRADOR" }` | `{ ok: false, error: "MES_FUERA_DE_CONTRATO" }`. Rechaza si ya BORRADOR; persiste estado BORRADOR; devuelve el DTO recalculado en vivo.
- DTOs ya definidos en el servicio: `LiquidacionDto`, `LiquidacionItemDto`, `MontoPuntualDto`, `Desglose`, `DiaCalendario`.
- **Crea:** Route Handlers:
  - `src/app/api/v1/liquidaciones/[anio]/[mes]/cierre/route.ts` (POST). Firma: `(request: Request, context: { params: Promise<{ anio: string; mes: string }> })`. Reusar el parseo/validación de `[anio]/[mes]` (mes 1..12 → 422). Guard `rechazarSiNoEmpleador` + `resolverRol` (401 si sin identidad). Mapear `LIQUIDACION_CERRADA`→409, `MES_FUERA_DE_CONTRATO`→409. Devolver el DTO con `Response.json(dto, { status: 200 })` (el empleador ve notas; no hace falta `stripNotas` porque solo el empleador llega aquí, pero es seguro devolver íntegro).
  - `src/app/api/v1/liquidaciones/[anio]/[mes]/reapertura/route.ts` (POST). Igual estructura; mapear `LIQUIDACION_BORRADOR`→409.
- Convención Next 15: el Route Handler NO debe declarar el primer parámetro como opcional (ver guía del epic; usar `request: Request` siempre presente). El patrón exacto está en `src/app/api/v1/liquidaciones/[anio]/[mes]/route.ts` (GET/PUT existentes) — copiar `parsearMes`, manejo de `context.params`, y el guard de rol del PUT.
- Fixtures (no duplicar): `buildEmpleadaAggregate(overrides?)` (acepta `fechaInicioContrato`, `fechaFinContrato`, `salarioBase`, `diasLaborales`, `email`) en `src/lib/test/factories.ts`; `setupTestDatabase`/`teardownTestDatabase`/`resetDatabase` en `src/lib/test/db-test-setup.ts`. Autenticación en tests: `vi.mock("@/features/auth/application/session-reader", ...)` sobre `obtenerSesionEmpleador` + `generarEnlace` para el token de empleada (patrón exacto en `src/app/api/v1/liquidaciones/[anio]/[mes]/route.test.ts` y `actualizar.test.ts`). Para cambiar la configuración tras cerrar (RN-09), usar `db.configuracion.update`. Para cambiar el valor de un item, `db.itemAdicional.update`. Para sembrar una liquidación con item/cantidad, `db.liquidacion.create` anidado o un `PUT` previo.
- Modelos (sin cambios de schema): `Liquidacion` ya tiene `salarioBaseCongelado: Int?`, `diasLaboralesCongelado: Json?`, `totalCongelado: Int?`; `LiquidacionItem` ya tiene `nombre`/`valorUnitario` snapshot. No requiere migración nueva.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
