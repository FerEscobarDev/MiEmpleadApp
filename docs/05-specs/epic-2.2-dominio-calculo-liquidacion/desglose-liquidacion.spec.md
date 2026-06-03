# SPEC: Desglose de la liquidación y validación de inasistencias — id: epic-2.2-dominio-calculo-liquidacion/desglose-liquidacion

**Epic:** Epic 2.2 — Dominio de cálculo de liquidación (ROADMAP Milestone 2)   **Módulo:** architecture.md §2.4 Capa de Dominio (lógica pura)

## Objetivo

Componer el cálculo completo del **desglose** de una liquidación mensual como función pura: a partir del salario base, días laborales configurados, periodo de contrato, festivos del mes (provistos), inasistencias, items adicionales y montos puntuales, producir el objeto `Desglose` (días laborales del mes, festivos en día laboral, días trabajados, valor-día, subtotal por días, subtotal por items, subtotal por montos puntuales y total). Además, exponer la **validación de inasistencias** (RN-05): una fecha solo es inasistencia válida si es día laboral, no festivo y dentro del periodo de contrato.

## Fuera de Scope (NO testear, NO implementar)

- La construcción del modelo de calendario coloreado (`DiaCalendario[]`, `TipoDiaCalendario`) — Spec 3.
- El conteo de días laborales y el valor-día en sí — ya implementados en `dias-laborales.ts` (Spec 1); este spec los **reutiliza**, no los reimplementa.
- Festivos: se reutiliza `getHolidaysInMonth` del Servicio de Festivos (Epic 2.1); NO se reimplementa.
- Persistencia, HTTP, congelamiento (RN-09), unicidad mes/año (RN-10) — son de los epics de API (5.x).

## Operaciones del Contrato de API

- **Sin boundary HTTP:** N/A — lógica interna. La salida `Desglose` mapea 1:1 al esquema `Desglose` (api-contract.md §2) que el epic 5.1 serializará; el dominio retorna un objeto plano.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

> Resume el esquema `Desglose` del contrato (no lo contradice). Todos los montos son enteros COP. Fechas como `YYYY-MM-DD`.

| Aspecto | Detalle |
|---------|---------|
| Entradas | `calcularDesglose(params)` con: `year`:int 1–12 mes válido; `month`:int; `salarioBase`:int COP ≥0; `diasLaborales`:`DiaSemana[]`; `fechaInicioContrato`:`YYYY-MM-DD`; `fechaFinContrato`:`YYYY-MM-DD\|null`; `festivos`:`YYYY-MM-DD[]` (los del mes, provistos por `getHolidaysInMonth`); `inasistencias`:`YYYY-MM-DD[]`; `items`:`{valorUnitario:int, cantidad:int}[]`; `montosPuntuales`:`{monto:int}[]`. |
| Salidas (éxito) | `Desglose`: `{ diasLaboralesMes:int, festivosEnDiaLaboral:int, diasTrabajados:int, valorDia:int, subtotalDias:int, subtotalItems:int, subtotalMontosPuntuales:int, total:int }`. |
| Salidas (error) | `esInasistenciaValida(fecha, …)` → `boolean`. `validarInasistencias(inasistencias, …)` → lista de fechas inválidas (`YYYY-MM-DD[]`, vacía si todas válidas). `calcularDesglose` cuenta como `diasTrabajados` solo las inasistencias **válidas** que efectivamente reducen días; mes/fecha mal formada → `RangeError` (vía helpers de Spec 1 y festivos). |
| Efectos secundarios | Ninguno (función pura). |
| Idempotencia | Sí: misma entrada → misma salida, independiente de la zona del proceso. |

## Reglas de Negocio

- **BR-1 (RN-01):** `valorDia = round(salarioBase ÷ diasLaboralesMes)` con `diasLaboralesMes` = días laborales del mes completo. Denominador siempre el mes completo. — RN-01. (Reutiliza `calcularValorDia`/`contarDiasLaboralesDelMes` de Spec 1.)
- **BR-2 (RN-03):** los festivos en día laboral se cuentan en `festivosEnDiaLaboral`, están **pagados** (incluidos en el salario) y **NO** se descuentan ni reducen `diasTrabajados`. Un festivo en día no laboral no aporta a `festivosEnDiaLaboral`. — RN-03.
- **BR-3 (RN-04):** `diasTrabajados = (días laborales DENTRO del periodo de contrato en el mes) − (número de inasistencias válidas)`. `subtotalDias = diasTrabajados × valorDia`. Cada inasistencia descuenta exactamente un valor-día. — RN-04.
- **BR-4 (RN-05):** una inasistencia es **válida** solo si la fecha es día laboral **y** no festivo **y** dentro de `[fechaInicioContrato, fechaFinContrato]`. Fechas que no cumplan se consideran inválidas y NO reducen `diasTrabajados`. El dominio expone `esInasistenciaValida`/`validarInasistencias` para rechazarlas. — RN-05.
- **BR-5 (RN-06/RN-07):** los días previos al inicio o posteriores al fin del contrato no se pagan (no entran en `diasTrabajados`); el denominador no cambia. — RN-06, RN-07. (Reutiliza `contarDiasLaboralesEnContrato` de Spec 1.)
- **BR-6 (RN-08):** `total = subtotalDias + subtotalItems + subtotalMontosPuntuales`, donde `subtotalItems = Σ(cantidad × valorUnitario)` y `subtotalMontosPuntuales = Σ(monto)`. — RN-08.
- **BR-7 (RN-16):** todos los montos enteros COP. — RN-16.

## Criterios de Aceptación (≥1 test por ID)

> Mes de referencia: septiembre 2025 (30 días, 26 laborales L–S, sin festivos). Salario 700000 ⇒ `valorDia = 26923`.

- **AC-1 (mes normal completo):** salario 700000, L–S, contrato completo (inicio ≤ 2025-09-01, fin null), sin festivos, sin inasistencias, sin items/montos ⇒ `diasLaboralesMes=26`, `festivosEnDiaLaboral=0`, `diasTrabajados=26`, `valorDia=26923`, `subtotalDias=699998`, `subtotalItems=0`, `subtotalMontosPuntuales=0`, `total=699998`.
- **AC-2 (mes de inicio parcial, RN-06):** contrato inicia 2025-09-15, fin null ⇒ `diasTrabajados=14`, `subtotalDias=376922`, `total=376922`, `diasLaboralesMes=26` (denominador sin cambio).
- **AC-3 (mes de fin parcial, RN-07):** contrato fin 2025-09-15 (inicio ≤ 2025-09-01) ⇒ `diasTrabajados=13`, `subtotalDias=13×26923=349999`, `diasLaboralesMes=26`.
- **AC-4 (mes fuera de contrato):** inicio 2025-10-01 (mes posterior) ⇒ `diasTrabajados=0`, `subtotalDias=0`, y con items/montos en cero ⇒ `total=0`.
- **AC-5 (todas las inasistencias, RN-04):** contrato completo, 26 inasistencias válidas (todos los días laborales del mes) ⇒ `diasTrabajados=0`, `subtotalDias=0`.
- **AC-6 (inasistencias válidas descuentan, RN-04):** contrato completo, 2 inasistencias válidas (ej. 2025-09-02 y 2025-09-03, ambos laborales no festivos) ⇒ `diasTrabajados=24`, `subtotalDias=24×26923=646152`.
- **AC-7 (festivo en día laboral no se descuenta, RN-03):** agosto 2025 (26 laborales L–S), festivos provistos `["2025-08-07","2025-08-18"]` (jueves y lunes, ambos laborales), contrato completo, sin inasistencias ⇒ `festivosEnDiaLaboral=2`, `diasTrabajados=26` (los festivos NO reducen días), `subtotalDias=26×26923`.
- **AC-8 (festivo en día no laboral es irrelevante, RN-03):** un festivo provisto que cae en domingo (ej. fecha domingo del mes) ⇒ NO aporta a `festivosEnDiaLaboral` y no afecta `diasTrabajados`.
- **AC-9 (items y montos, RN-08):** contrato completo sept, sin inasistencias, `items=[{valorUnitario:20000,cantidad:2},{valorUnitario:5000,cantidad:3}]`, `montosPuntuales=[{monto:50000},{monto:30000}]` ⇒ `subtotalItems=55000`, `subtotalMontosPuntuales=80000`, `total = 699998 + 55000 + 80000 = 834998`.
- **AC-10 (validación de inasistencia, RN-05):** `esInasistenciaValida` retorna `true` para un día laboral no festivo dentro de contrato (2025-09-02) y `false` para: un domingo (2025-09-07, no laboral), un festivo (2025-08-07 en agosto), y una fecha fuera de contrato (2025-09-10 si el contrato inicia el 15).
- **AC-11 (validarInasistencias lista las inválidas):** dada una mezcla de fechas válidas e inválidas, `validarInasistencias` retorna exactamente las inválidas y `calcularDesglose` descuenta **solo** las válidas.
- **AC-12 (determinismo/TZ):** los resultados de `calcularDesglose` y `esInasistenciaValida` son estables bajo `process.env.TZ="Asia/Tokyo"`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** inasistencia inválida (festivo, no laboral o fuera de contrato) presente en `inasistencias` ⇒ NO reduce `diasTrabajados` (solo cuentan válidas) y aparece en `validarInasistencias`.
- **EC-2:** `diasLaboralesMes=0` (ningún día laboral configurado) ⇒ `valorDia=0`, `subtotalDias=0`, `total` = items+montos.
- **EC-3:** inasistencias duplicadas (misma fecha dos veces) ⇒ se cuentan una sola vez como día descontado (un día laboral no puede faltarse dos veces).
- **EC-4:** items con `cantidad=0` aportan 0 al subtotal; lista de items/montos vacía ⇒ subtotal 0.

## Superficie de Código Existente (para el implementer)

- Llama a (Spec 1, `src/features/liquidacion/domain/dias-laborales.ts`):
  - `contarDiasLaboralesDelMes(year:number, month:number, diasLaborales:DiaSemana[]): number`
  - `contarDiasLaboralesEnContrato(year:number, month:number, diasLaborales:DiaSemana[], fechaInicioContrato:string, fechaFinContrato:string|null): number`
  - `calcularValorDia(salarioBase:number, diasLaboralesMes:number): number`
  - `esDiaLaboral(isoDate:string, diasLaborales:DiaSemana[]): boolean`
  - `enumerarDiasDelMes(year:number, month:number): string[]`
  - tipo `DiaSemana` (unión de literales).
- Llama a (Epic 2.1, `src/features/liquidacion/domain/festivos.ts`): `getHolidaysInMonth(year:number, month:number): string[]` — el llamador del dominio normalmente provee `festivos` ya calculado; este spec recibe `festivos` como parámetro para mantener la pureza, pero puede usar inclusión por pertenencia a esa lista (`festivos.includes(fecha)`), NO reimplementar la Ley Emiliani.
- Crea: `src/features/liquidacion/domain/calculo.ts` con `calcularDesglose`, `esInasistenciaValida`, `validarInasistencias` y el tipo exportado `Desglose` (y los tipos de entrada `ItemLiquidacion`, `MontoPuntual` o equivalentes). Tipo de entrada agregada (`EntradaDesglose`/params object) a criterio del implementer, consistente con la tabla de Contrato.
- Test co-localizado: `src/features/liquidacion/domain/calculo.test.ts`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
