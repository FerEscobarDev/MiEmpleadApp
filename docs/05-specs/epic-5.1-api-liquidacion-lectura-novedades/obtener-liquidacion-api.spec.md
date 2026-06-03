# SPEC: API Obtener / Inicializar Liquidación del mes — id: epic-5.1-api-liquidacion-lectura-novedades/obtener-liquidacion-api

**Epic:** [Epic 5.1 — API Liquidación lectura y novedades](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo

Seleccionar un mes/año y obtener (o **inicializar como borrador**) su liquidación, con el **desglose** del pago y el **calendario coloreado** del mes. Devuelve también las novedades persistidas (inasistencias, items, montos puntuales) y, solo para el empleador, las notas privadas. Es la operación `obtenerLiquidacion` del contrato. Lectura permitida a empleador y empleada; para la empleada se omiten las notas (RN-12).

## Fuera de Scope (NO testear, NO implementar)

- Editar/registrar novedades (`actualizarLiquidacion`): spec hermano.
- Cerrar / reabrir / eliminar (Epic 5.2). Aquí una liquidación recién inicializada siempre es BORRADOR.
- El congelamiento de valores (RN-09): Epic 5.2. El desglose se calcula en vivo con la configuración vigente.
- Asociar items a días concretos del calendario (`DiaCalendario.itemsAdicionales`): se devuelve sin ese campo (opcional en el contrato); el coloreado por item es trabajo de frontend posterior.
- El cliente tipado del frontend y cualquier pantalla.

## Operaciones del Contrato de API

- **Implementa** (backend): `obtenerLiquidacion` — `operationId` de `docs/02-architecture/api-contract.openapi.yaml`.

Path y método (del contrato, EXACTOS):
- `GET /api/v1/liquidaciones/{anio}/{mes}` → `obtenerLiquidacion`

Los segmentos `{anio}`/`{mes}` se implementan con rutas dinámicas de Next.js App Router `[anio]/[mes]`.

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

Shapes (resumen del contrato — fuente de verdad: `Liquidacion`, `Desglose`, `DiaCalendario`, `LiquidacionItem`, `MontoPuntual` en el OpenAPI):

- `Liquidacion` (salida): `{ anio: int, mes: int, estado: EstadoLiquidacion, desglose: Desglose, calendario: DiaCalendario[], inasistencias: date[] (YYYY-MM-DD), items: LiquidacionItem[], montosPuntuales: MontoPuntual[], notas?: string }`.
- `Desglose`: `{ diasLaboralesMes, festivosEnDiaLaboral, diasTrabajados, valorDia, subtotalDias, subtotalItems, subtotalMontosPuntuales, total }` (todos int COP).
- `DiaCalendario`: `{ fecha: date, tipo: TipoDiaCalendario ("TRABAJADO"|"INASISTENCIA"|"FESTIVO"|"NO_LABORAL"|"FUERA_CONTRATO") }`.
- `LiquidacionItem` (salida): `{ itemId: string, nombre: string, valorUnitario: int, cantidad: int, subtotal: int }`.
- `MontoPuntual` (salida): `{ id?: string, descripcion: string, monto: int }`.

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`, `mes` en el path (enteros). |
| Salidas (éxito) | `200` con `Liquidacion`. Para el rol empleada se omite `notas` (RN-12). |
| Salidas (error) | Mes completamente fuera del periodo de contrato → `409` envelope `{ code: "MES_FUERA_DE_CONTRATO", message }`. `anio`/`mes` inválidos (no enteros, `mes` ∉ 1..12) → `422` `{ code: "VALIDACION", details }`. Sin identidad válida → `401` `{ code: "NO_AUTORIZADO" }`. Fallo inesperado → `500` `{ code: "ERROR_INTERNO" }`. |
| Efectos secundarios | Si NO existe liquidación para (empleada, anio, mes) y el mes es liquidable, se **crea** una fila `Liquidacion` en estado BORRADOR (inicialización, RN-10). Si ya existe, se devuelve la existente SIN duplicar. Mes fuera de contrato NO crea ninguna fila. |
| Idempotencia | Sí: repetir `GET` del mismo mes devuelve la MISMA liquidación (una sola fila, RN-10). |

Notas de cálculo:
- `desglose` y `calendario` se calculan llamando al dominio con: `salarioBase` y `diasLaborales` de la configuración vigente; `fechaInicioContrato`/`fechaFinContrato` de la ficha; `festivos` del mes vía `getHolidaysInMonth`; e `inasistencias` persistidas de la liquidación.
- `LiquidacionItem.subtotal = valorUnitario × cantidad`. Para un borrador, `nombre`/`valorUnitario` reflejan el catálogo vigente del item (o el snapshot persistido si así está guardado); el congelamiento real es Epic 5.2.

## Reglas de Negocio

- **BR-1 (RN-01..RN-08):** el desglose se calcula con el dominio puro: valor-día = salarioBase ÷ días laborales del mes completo; días trabajados = días laborales en contrato − inasistencias válidas; total = subtotalDías + Σ items + Σ montos. Fuente: business_requirements.md RN-01..RN-08.
- **BR-2 (RN-06/RN-07, mes parcial):** en el mes de inicio solo se pagan los días laborales desde `fechaInicioContrato`; en el de fin, hasta `fechaFinContrato`. El denominador sigue siendo el mes completo. El calendario marca los días fuera de contrato como `FUERA_CONTRATO`. Fuente: RN-06/RN-07.
- **BR-3 (RN-10, unicidad/inicialización):** una sola liquidación por (empleada, año, mes). Obtener un mes sin liquidación la inicializa como BORRADOR; re-obtenerlo devuelve esa misma fila, nunca una segunda. Fuente: RN-10; architecture.md §4 (`@@unique([empleadaId, anio, mes])`).
- **BR-4 (mes fuera de contrato):** si el mes es **completamente** anterior al inicio o posterior al fin de contrato (ningún día laboral cae dentro del periodo), responde `409 MES_FUERA_DE_CONTRATO` y no inicializa. Fuente: business_requirements.md §Casos Límite "Mes fuera del contrato"; api-contract `obtenerLiquidacion`.
- **BR-5 (RN-12, notas privadas):** las `notas` se incluyen para el rol empleador y se **omiten** para el rol empleada. Fuente: RN-12.
- **BR-6 (RN-13 / contrato §1):** lectura permitida a ambos roles; sin identidad válida → `401`.
- **BR-7 (RN-16):** montos enteros COP.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1 (mes normal):** `GET /liquidaciones/{anio}/{mes}` para un mes íntegramente dentro del contrato, sin novedades, responde `200` con `estado: "BORRADOR"`, un `desglose` cuyo `diasTrabajados` = días laborales del mes en contrato y `total` = `subtotalDias`, y un `calendario` con un elemento por día del mes.
- **AC-2 (desglose correcto):** para una configuración conocida (ej. salario 700000, L–S, sin festivos relevantes), el `desglose` devuelto coincide campo a campo con `calcularDesglose(...)` para esos datos (reutiliza un ejemplo trabajado del dominio).
- **AC-3 (mes de inicio parcial, RN-06):** para el mes en que inicia el contrato (inicio a mitad de mes), los días previos al inicio aparecen como `FUERA_CONTRATO` en el `calendario`, `diasLaboralesMes` (denominador) es el del mes completo y `diasTrabajados` solo cuenta desde el inicio.
- **AC-4 (mes de fin parcial, RN-07):** para el mes con fecha de fin de contrato a mitad de mes, los días posteriores al fin aparecen `FUERA_CONTRATO` y `diasTrabajados` solo cuenta hasta el fin.
- **AC-5 (inicialización, RN-10):** obtener un mes sin liquidación previa **crea** exactamente una fila `Liquidacion` BORRADOR (verificable: `db.liquidacion.count()` pasa de 0 a 1).
- **AC-6 (idempotencia, RN-10):** obtener el MISMO mes dos veces devuelve la misma liquidación y deja **una sola** fila (`count` = 1), no dos.
- **AC-7 (con novedades persistidas):** una liquidación con inasistencias, items y montos persistidos devuelve esas `inasistencias` (fechas YYYY-MM-DD), `items` (con `subtotal = valorUnitario × cantidad`) y `montosPuntuales`, y el `desglose.total` los incorpora (RN-08).
- **AC-8 (mes fuera de contrato, BR-4):** obtener un mes íntegramente anterior al inicio (o posterior al fin) de contrato responde `409` con `{ code: "MES_FUERA_DE_CONTRATO" }` y NO crea ninguna fila (`count` permanece 0).
- **AC-9 (RN-12, empleada sin notas):** una liquidación con `notas` no nulas, obtenida con token de empleada, responde `200` SIN el campo `notas` en el cuerpo.
- **AC-10 (RN-12, empleador con notas):** la misma liquidación obtenida como empleador incluye `notas` con su valor.
- **AC-11 (validación):** `mes` fuera de 1..12 (ej. 13 o 0) responde `422` `{ code: "VALIDACION" }`.
- **AC-12 (auth):** sin sesión de empleador y con token de empleada inválido, responde `401` `{ code: "NO_AUTORIZADO" }`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1 (inicio y fin en el mismo mes):** contrato que empieza y termina dentro del mismo mes calendario → solo se pagan los días laborales entre inicio y fin (proporcional al mes completo); `200`, no `409`.
- **EC-2 (todas inasistencias):** un mes con inasistencias en todos los días laborales en contrato → `diasTrabajados` = 0 y `subtotalDias` = 0; el `total` puede ser 0 o solo items/montos.
- **EC-3 (festivo en día laboral, RN-03):** un festivo que cae en día laboral aparece como `FESTIVO` en el calendario, se cuenta en `festivosEnDiaLaboral`, y NO se descuenta del pago.
- **EC-4 (mes parcialmente dentro):** un mes con al menos un día laboral dentro del contrato es liquidable (`200`), aunque parte del mes quede fuera.

## Superficie de Código Existente (para el implementer)

- Resolución de identidad/rol — `resolverRol(request: Request): Promise<ContextoRol | null>` en `src/features/auth/authorize.ts` (`ContextoRol = { rol, empleadaId }`); `stripNotas(objeto, rol): Omit<T,"notas"> | T` en el mismo archivo (omite `notas` si `rol === "EMPLEADA"`, copia inmutable). `Rol = "EMPLEADOR" | "EMPLEADA"`. Header de empleada: `HEADER_ACCESO_TOKEN = "X-Acceso-Token"`.
- Envelope de error — `errorResponse(status, code, message, details?)` y `validationErrorResponse(details)` (422, code "VALIDACION") en `src/features/config/application/api-error.ts`.
- Repositorio de liquidación — `buscarLiquidacionPorMes(empleadaId, anio, mes): Promise<Liquidacion | undefined>`, `crearLiquidacion(input: { empleadaId, anio, mes, estado?, notas? }): Promise<Liquidacion>`, en `src/features/liquidacion/data/liquidacion-repository.ts`. Extender ahí la lectura de novedades (inasistencias/items/montos) de una liquidación.
- Configuración / ficha — `obtenerConfiguracionDeEmpleada(empleadaId)` y `buscarEmpleadaPorId(empleadaId): Promise<Empleada | undefined>` (con `fechaInicioContrato: Date`, `fechaFinContrato: Date | null`) en `src/features/config/data/empleada-repository.ts`.
- Festivos — `getHolidaysInMonth(year, month): string[]` en `src/features/liquidacion/domain/festivos.ts`.
- Dominio — `calcularDesglose(entrada: EntradaDesglose): Desglose` en `src/features/liquidacion/domain/calculo.ts` (firma en el spec hermano `listar-liquidaciones-api`); `construirCalendario(entrada: EntradaCalendario): DiaCalendario[]` en `src/features/liquidacion/domain/calendario.ts`, con `EntradaCalendario = { year, month, diasLaborales: DiaSemana[], fechaInicioContrato: string, fechaFinContrato: string | null, festivos: string[], inasistencias: string[] }` y `DiaCalendario = { fecha: string, tipo: TipoDiaCalendario }`. `contarDiasLaboralesEnContrato(year, month, diasLaborales, fechaInicioContrato, fechaFinContrato): number` en `dias-laborales.ts` sirve para decidir si el mes está fuera de contrato (resultado 0 ⇒ ningún día laboral en contrato ⇒ candidato a 409, ver BR-4).
- Conversión de fechas — `toIsoDate(date)` / `isoToDate(value)` en `src/features/config/application/date-iso.ts`.
- Cliente Prisma único — `db` en `src/lib/db.ts`.
- Modelos: `Liquidacion`, `Inasistencia (fecha: DateTime)`, `LiquidacionItem`, `MontoPuntual`. No requiere cambios de schema.
- **Crea:** ruta `src/app/api/v1/liquidaciones/[anio]/[mes]/route.ts` (GET). La firma del Route Handler recibe `(request: Request, context: { params: Promise<{ anio: string, mes: string }> })`; los segmentos llegan como string y deben parsearse/validarse a entero (Next 15 rechaza primer-parámetro opcional, ver guía del epic).
- **Extiende:** servicio `src/features/liquidacion/application/liquidacion-service.ts` con `obtenerLiquidacionDelMes(empleadaId, anio, mes): Promise<LiquidacionDto>` (o un Result que distinga `MES_FUERA_DE_CONTRATO`). Decide fuera-de-contrato, inicializa si falta, carga novedades, llama dominio, arma el DTO `Liquidacion` con `notas`; el handler aplica `stripNotas` según rol.
- Fixtures (no duplicar): `buildEmpleadaAggregate(overrides?)` (acepta `fechaInicioContrato`, `fechaFinContrato`, `salarioBase`, `diasLaborales`, `email`) en `src/lib/test/factories.ts`; `setupTestDatabase`/`teardownTestDatabase`/`resetDatabase`. Autenticación en tests: mock de `obtenerSesionEmpleador` + `generarEnlace` (patrón en `src/app/api/v1/rn13-enforcement.test.ts`). Para sembrar novedades, usar `db.liquidacion.create` con `inasistencias`/`items`/`montosPuntuales` anidados.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
