# SPEC: API Listar Liquidaciones (historial) — id: epic-5.1-api-liquidacion-lectura-novedades/listar-liquidaciones-api

**Epic:** [Epic 5.1 — API Liquidación lectura y novedades](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo

Exponer el **historial de liquidaciones** de la empleada actual: un listado de todos los meses que tienen una liquidación registrada, cada uno resumido con año, mes, estado y total a pagar. Lectura permitida tanto al rol empleador como al rol empleada. Es la operación `listarLiquidaciones` del contrato.

## Fuera de Scope (NO testear, NO implementar)

- Obtener el detalle de un mes (`obtenerLiquidacion`) y editar novedades (`actualizarLiquidacion`): specs hermanos del mismo epic.
- Cerrar / reabrir / eliminar liquidaciones: Epic 5.2.
- El cálculo del desglose y el calendario coloreado: no se exponen en el resumen (solo el `total`).
- El congelamiento de valores al cerrar (RN-09): Epic 5.2. Aquí, el `total` de un borrador se calcula en vivo con la configuración vigente; el de una cerrada usaría su total congelado (pero el estado CERRADA solo lo produce Epic 5.2, así que en la práctica todas las liquidaciones de este epic son BORRADOR).
- El cliente tipado del frontend y cualquier pantalla.
- Paginación y filtros del historial.

## Operaciones del Contrato de API

- **Implementa** (backend): `listarLiquidaciones` — `operationId` de `docs/02-architecture/api-contract.openapi.yaml`.

Path y método (del contrato, EXACTOS):
- `GET /api/v1/liquidaciones` → `listarLiquidaciones`

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

Shape (resumen del contrato — la fuente de verdad es `LiquidacionResumen` en el OpenAPI):

- `LiquidacionResumen` (salida): `{ anio: int, mes: int (1-12), estado: EstadoLiquidacion ("BORRADOR" | "CERRADA"), total: int (COP) }`.

| Aspecto | Detalle |
|---------|---------|
| Entradas | Ninguna (la empleada se resuelve por la costura de auth; el rol por la capa de autorización). |
| Salidas (éxito) | `200` con `LiquidacionResumen[]`, ordenado por (`anio`, `mes`) descendente (mes más reciente primero). |
| Salidas (error) | Llamador sin identidad válida (ni sesión de empleador ni token de empleada válido) → `401` envelope `{ code: "NO_AUTORIZADO", message }`. Fallo inesperado → `500` envelope `{ code: "ERROR_INTERNO", message }`. |
| Efectos secundarios | Ninguno (operación de lectura pura; no materializa ni inicializa liquidaciones). |
| Idempotencia | Sí. |

Notas de mapeo:
- `total`: para una liquidación BORRADOR se calcula **en vivo** llamando al dominio (`calcularDesglose`) con la configuración vigente de la empleada, los festivos del mes y las novedades persistidas de esa liquidación. El campo `Desglose.total` es el `total` del resumen (RN-08).
- `estado`: se persiste como `String` ("BORRADOR" | "CERRADA"); se serializa tal cual al enum del contrato.

## Reglas de Negocio

- **BR-1 (RN-08):** `total = subtotal días trabajados + Σ(cantidad × valor unitario de items) + Σ(montos puntuales)`. Fuente: business_requirements.md §Reglas de Negocio RN-08. El total del resumen es el del desglose calculado por el dominio.
- **BR-2 (RN-10):** existe **una sola liquidación por (empleada, año, mes)**; el listado contiene a lo sumo un elemento por mes/año. Fuente: business_requirements.md RN-10.
- **BR-3 (RN-12, lectura empleada):** el historial NO incluye notas; `LiquidacionResumen` no tiene campo `notas`, por lo que la privacidad se preserva trivialmente para ambos roles. Fuente: business_requirements.md RN-12.
- **BR-4 (RN-13 / contrato §1):** la lectura está permitida a empleador y empleada; ambos esquemas de autenticación se aceptan. Un llamador sin identidad válida recibe `401`. Fuente: business_requirements.md RN-13; api-contract §1.
- **BR-5 (RN-16):** todos los montos son enteros COP sin decimales.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `GET` sin liquidaciones registradas responde `200` con arreglo vacío `[]`.
- **AC-2:** `GET` con varias liquidaciones registradas responde `200` con un `LiquidacionResumen` por cada una, conformando el DTO (`anio`, `mes`, `estado`, `total`).
- **AC-3 (BR-1 / RN-08):** el `total` de cada resumen refleja el desglose calculado en vivo: para una liquidación BORRADOR con inasistencias e items, `total` coincide con `calcularDesglose(...).total` para esa configuración/mes/novedades.
- **AC-4:** el listado viene ordenado por (`anio`, `mes`) descendente (el mes más reciente primero).
- **AC-5 (BR-4):** una petición autenticada como empleador (sin token de empleada) responde `200` con el historial.
- **AC-6 (BR-4):** una petición autenticada como empleada (header `X-Acceso-Token` válido, sin sesión de empleador) responde `200` con el historial de SU empleada.
- **AC-7 (BR-4):** una petición sin sesión de empleador y con token de empleada inválido responde `401` con envelope `{ code: "NO_AUTORIZADO" }`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** una liquidación sin novedades (sin inasistencias, items ni montos) reporta `total` igual al subtotal por días trabajados del mes completo (los días laborales dentro de contrato × valor-día), nunca `undefined`.
- **EC-2:** el listado contiene solo las liquidaciones de la empleada actual; las de otra empleada (otro empleador) NO aparecen (aislamiento por empleada).

## Superficie de Código Existente (para el implementer)

- Resolución de identidad/rol — llama a: `resolverRol(request: Request): Promise<ContextoRol | null>` en `src/features/auth/authorize.ts`, donde `ContextoRol = { rol: "EMPLEADOR" | "EMPLEADA", empleadaId: string }`. `null` ⇒ sin identidad válida ⇒ `401`.
- Costura single-tenant de respaldo — `getCurrentEmpleadaId(): Promise<string>` en `src/features/auth/current-empleada.ts` (lanza `EmpleadaNoResueltaError`). Preferir `resolverRol` para soportar ambos roles.
- Envelope de error — llama a: `errorResponse(status, code, message, details?): Response` en `src/features/config/application/api-error.ts`. Reutilizar (no duplicar).
- Repositorio de liquidación existente — llama a: `listarLiquidacionesDeEmpleada(empleadaId: string): Promise<Liquidacion[]>` en `src/features/liquidacion/data/liquidacion-repository.ts` (ya ordena por `anio` desc, `mes` desc). El tipo `Liquidacion` de Prisma incluye `{ id, empleadaId, anio, mes, estado, notas, salarioBaseCongelado, diasLaboralesCongelado, totalCongelado }`.
- Configuración de la empleada — llama a: `obtenerConfiguracionDeEmpleada(empleadaId: string): Promise<Configuracion | undefined>` en `src/features/config/data/empleada-repository.ts` (`{ salarioBase: int, diasLaborales: Json }`), y la ficha vía `buscarEmpleadaPorId(empleadaId): Promise<Empleada | undefined>` (`fechaInicioContrato`, `fechaFinContrato: Date | null`).
- Festivos — llama a: `getHolidaysInMonth(year: number, month: number): string[]` en `src/features/liquidacion/domain/festivos.ts` (cadenas YYYY-MM-DD).
- Dominio del cálculo — llama a: `calcularDesglose(entrada: EntradaDesglose): Desglose` en `src/features/liquidacion/domain/calculo.ts`. `EntradaDesglose = { year, month, salarioBase, diasLaborales: DiaSemana[], fechaInicioContrato: string, fechaFinContrato: string | null, festivos: string[], inasistencias: string[], items: {valorUnitario, cantidad}[], montosPuntuales: {monto}[] }`. `Desglose.total` es el total a pagar.
- Conversión de fechas — `toIsoDate(date: Date): string` en `src/features/config/application/date-iso.ts` (Date → "YYYY-MM-DD" anclado a medianoche UTC).
- Cliente Prisma único — `db` en `src/lib/db.ts` (acceso solo desde la capa de persistencia).
- **Crea:** ruta `src/app/api/v1/liquidaciones/route.ts` (GET).
- **Crea:** servicio de aplicación `src/features/liquidacion/application/liquidacion-service.ts` con `listarResumenLiquidaciones(empleadaId: string): Promise<LiquidacionResumen[]>` (orquesta repositorios + dominio; calcula el `total` en vivo por liquidación). Puede crecer en los specs hermanos.
- **Crea (o extiende):** repositorio de novedades en `src/features/liquidacion/data/liquidacion-repository.ts` para leer inasistencias/items/montos de una liquidación (p.ej. `cargarNovedades(liquidacionId): Promise<{ inasistencias: string[], items: {valorUnitario, cantidad}[], montosPuntuales: {monto}[] }>`), vía Prisma. No reimplementar el cálculo (eso vive en el dominio).
- Modelos Prisma `Liquidacion`, `Inasistencia` (`{ liquidacionId, fecha: DateTime }`), `LiquidacionItem` (`{ liquidacionId, itemId?, nombre, valorUnitario, cantidad }`), `MontoPuntual` (`{ liquidacionId, descripcion, monto }`). No requiere cambios de schema.
- Fixtures disponibles (no duplicar): `buildEmpleadaAggregate(overrides?)` en `src/lib/test/factories.ts`; `setupTestDatabase` / `teardownTestDatabase` / `resetDatabase` en `src/lib/test/db-test-setup.ts`; cliente `db` en `src/lib/db.ts`. Para autenticar como empleador/empleada en tests, mockear `obtenerSesionEmpleador` y generar token con `generarEnlace(email, baseUrl)` de `src/features/auth/application/acceso-service.ts` (patrón en `src/app/api/v1/rn13-enforcement.test.ts`). El header de la empleada es `X-Acceso-Token` (`HEADER_ACCESO_TOKEN` en `authorize.ts`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
