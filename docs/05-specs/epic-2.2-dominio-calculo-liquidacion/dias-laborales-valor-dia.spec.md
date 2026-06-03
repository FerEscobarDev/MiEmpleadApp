# SPEC: Días laborales del mes y valor-día — id: epic-2.2-dominio-calculo-liquidacion/dias-laborales-valor-dia

**Epic:** Epic 2.2 — Dominio de cálculo de liquidación (ROADMAP Milestone 2)   **Módulo:** architecture.md §2.4 Capa de Dominio (lógica pura)

## Objetivo

Proveer las funciones puras base del cálculo de liquidación: enumerar los días de un mes calendario, decidir qué día de la semana es laboral según la configuración, contar los días laborales del **mes completo** (denominador, RN-01/RN-02), contar los días laborales **dentro del periodo de contrato** del mes (mes parcial de inicio/fin, RN-06/RN-07) y derivar el **valor-día** entero en COP a partir del salario base y el denominador. Todo determinista, sin IO, recibiendo fechas como cadenas `YYYY-MM-DD` o `año/mes` explícitos.

## Fuera de Scope (NO testear, NO implementar)

- El desglose completo de la liquidación (`Desglose`, subtotales de items/montos, total) — es el Spec 2 de este epic.
- La construcción del modelo de calendario coloreado (`DiaCalendario[]`, `TipoDiaCalendario`) — es el Spec 3.
- El descuento de inasistencias y su validación — Spec 2.
- Festivos: NO se reimplementan; el cálculo de días laborales NO excluye festivos (un festivo en día laboral SÍ cuenta como día laboral pagado, RN-01/RN-03). Las funciones de este spec no necesitan festivos como parámetro.
- Cualquier acceso a base de datos, HTTP, React o `Date.now()` implícito.

## Operaciones del Contrato de API

- **Sin boundary HTTP:** N/A — lógica interna de dominio. Sus salidas alimentan el campo `valorDia` y `diasLaboralesMes` del esquema `Desglose` (api-contract.md §2), pero esta capa retorna valores planos, no respuestas HTTP.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

> Todas las fechas son cadenas `YYYY-MM-DD` (zona America/Bogotá implícita; se opera sobre las cadenas, nunca sobre `Date` local del host — RN-17). El día de la semana se modela con el enum `DiaSemana` del contrato (`LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO`).

| Aspecto | Detalle |
|---------|---------|
| Entradas | `year`: integer (≥1); `month`: integer 1–12; `diasLaborales`: `DiaSemana[]` (subconjunto, sin orden requerido); `salarioBase`: integer COP ≥0; fechas de contrato `fechaInicioContrato`: `YYYY-MM-DD`, `fechaFinContrato`: `YYYY-MM-DD \| null`. |
| Salidas (éxito) | `enumerarDiasDelMes` → `YYYY-MM-DD[]` (todos los días del mes, orden ascendente). `diaSemanaDe` → `DiaSemana`. `esDiaLaboral` → `boolean`. `contarDiasLaboralesDelMes` → integer ≥0 (denominador). `contarDiasLaboralesEnContrato` → integer ≥0 (días laborales del mes que caen dentro de `[inicio, fin]`). `calcularValorDia` → integer COP ≥0. |
| Salidas (error) | `month` fuera de 1–12 → `RangeError`. Cadena de fecha mal formada (no `^\d{4}-\d{2}-\d{2}$`) → `RangeError`. `diasLaboralesMes === 0` en `calcularValorDia` → retorna `0` (no divide por cero; mes sin días laborales no paga). |
| Efectos secundarios | Ninguno (funciones puras). |
| Idempotencia | Sí: misma entrada → misma salida, independiente de la zona horaria del proceso. |

### Política de redondeo del valor-día (DECISIÓN DE NEGOCIO — documentada)

`valor-día = salarioBase ÷ diasLaboralesMes`. Como `salarioBase` y `diasLaboralesMes` son enteros y su cociente puede no ser entero, y RN-16 exige montos enteros en COP, se adopta:

- **El valor-día se redondea a entero COP con redondeo a la mitad hacia arriba (round-half-up: `Math.round`), ANTES de multiplicar por los días.** Es decir, `valorDia = round(salarioBase / diasLaboralesMes)` y los subtotales (Spec 2) se calculan como `diasTrabajados × valorDia` con ese entero ya redondeado.
- Justificación: el esquema `Desglose` del contrato declara `valorDia: integer` y `subtotalDias = diasTrabajados × valorDia`; un valor-día entero es el que ve y entiende el usuario en la UI (es el "precio por día"). Redondear el valor-día (no el subtotal) hace el cálculo transparente y reproducible: el usuario puede multiplicar mentalmente.
- Ejemplo de referencia (business_requirements, mes parcial): `salarioBase = 700000`, mes con 26 días laborales (L–S) ⇒ `valorDia = round(700000 / 26) = round(26923.0769…) = 26923`.

## Reglas de Negocio

- **BR-1 (RN-01):** valor-día = salario mensual base ÷ total de días laborales del **mes calendario completo**. El denominador es SIEMPRE el mes completo, incluso en meses parciales de inicio/fin. — fuente: business_requirements.md §Reglas de Negocio RN-01.
- **BR-2 (RN-02):** los días laborales son los días de la semana configurados como laborales (`diasLaborales`); los demás (ej. domingo) no cuentan ni se pagan. — RN-02.
- **BR-3 (RN-03):** un festivo que cae en día laboral SÍ se cuenta dentro del denominador (está incluido en el salario, se paga, no se descuenta). El conteo de días laborales NO excluye festivos. — RN-03/RN-01.
- **BR-4 (RN-06):** en el mes de inicio del contrato, solo los días laborales **desde `fechaInicioContrato` en adelante** están dentro del contrato; los previos quedan fuera. El denominador (BR-1) no cambia. — RN-06.
- **BR-5 (RN-07):** en el mes de fin del contrato, solo los días laborales **hasta `fechaFinContrato` inclusive** están dentro del contrato; los posteriores quedan fuera. `fechaFinContrato = null` ⇒ sin límite superior. El denominador no cambia. — RN-07.
- **BR-6 (RN-16/RN-17):** montos enteros en COP; fechas en zona America/Bogotá operadas como cadenas, sin depender de la zona del proceso. — RN-16, RN-17.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `enumerarDiasDelMes(2025, 9)` retorna las 30 cadenas `2025-09-01`…`2025-09-30` en orden ascendente; `enumerarDiasDelMes(2025, 2)` retorna 28 días (febrero no bisiesto) y `enumerarDiasDelMes(2024, 2)` retorna 29 (bisiesto).
- **AC-2:** `diaSemanaDe("2025-09-15")` retorna `LUNES`; `diaSemanaDe("2025-09-14")` retorna `DOMINGO`.
- **AC-3:** con `diasLaborales = [LUNES…SABADO]`, `esDiaLaboral("2025-09-14", diasLaborales)` es `false` (domingo) y `esDiaLaboral("2025-09-15", diasLaborales)` es `true` (lunes).
- **AC-4 (BR-1, BR-2):** `contarDiasLaboralesDelMes(2025, 9, [LUNES…SABADO])` retorna `26` (denominador del mes completo). Para `diasLaborales = [LUNES…VIERNES]` en el mismo mes retorna `22`.
- **AC-5 (BR-3):** `contarDiasLaboralesDelMes(2025, 8, [LUNES…SABADO])` retorna `26` aunque agosto 2025 tenga festivos en día laboral (7 jueves, 18 lunes): el conteo NO los excluye.
- **AC-6 (BR-4):** `contarDiasLaboralesEnContrato(2025, 9, [LUNES…SABADO], fechaInicio="2025-09-15", fechaFin=null)` retorna `14` (días laborales del 15 al 30).
- **AC-7 (BR-5):** `contarDiasLaboralesEnContrato(2025, 9, [LUNES…SABADO], fechaInicio≤"2025-09-01", fechaFin="2025-09-15")` retorna el número de días laborales del 1 al 15 inclusive = `13`. (1–15 sept 2025: domingos 7 y 14 caen fuera ⇒ 13 laborales L–S.)
- **AC-8 (BR-1, política de redondeo):** `calcularValorDia(700000, 26)` retorna `26923` (round(26923.0769)). `calcularValorDia(700000, 22)` retorna `31818` (round(31818.18)). `calcularValorDia(600000, 24)` retorna `25000` (exacto).
- **AC-9:** el contrato completo en el mes (inicio ≤ primer día, fin = null o ≥ último día) hace `contarDiasLaboralesEnContrato == contarDiasLaboralesDelMes` (ej. mes completo sept 2025 ⇒ ambos `26`).
- **AC-10 (BR-6, determinismo):** todas las funciones anteriores producen los mismos resultados con `process.env.TZ = "Asia/Tokyo"` que con la zona por defecto.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** mes completamente fuera del contrato (inicio posterior al último día del mes, o fin anterior al primer día) ⇒ `contarDiasLaboralesEnContrato` retorna `0`.
- **EC-2:** `diasLaboralesMes = 0` (ningún día de la semana configurado como laboral, o mes hipotético sin días laborales) ⇒ `calcularValorDia(salario, 0)` retorna `0` (no lanza, no divide por cero).
- **EC-3:** `month` fuera de 1–12 ⇒ `RangeError` (consistente con `getHolidaysInMonth`). Fecha de contrato mal formada ⇒ `RangeError`.
- **EC-4:** inicio y fin de contrato dentro del mismo mes ⇒ `contarDiasLaboralesEnContrato` cuenta solo los laborales en `[inicio, fin]` inclusive (ej. inicio 2025-09-15, fin 2025-09-20 ⇒ días laborales L–S del 15 al 20 = 15,16,17,18,19,20 menos ningún domingo = 6, pero 21 es domingo y queda fuera ⇒ 6).

## Superficie de Código Existente (para el implementer)

- Reutiliza (NO reimplementa): nada de festivos es necesario en este spec.
- Crea: `src/features/liquidacion/domain/dias-laborales.ts` con las funciones `enumerarDiasDelMes`, `diaSemanaDe`, `esDiaLaboral`, `contarDiasLaboralesDelMes`, `contarDiasLaboralesEnContrato`, `calcularValorDia`, y un tipo exportado `DiaSemana` (unión de literales string igual al enum del contrato) reutilizable por Specs 2 y 3.
- Patrón de fechas de referencia (mismo enfoque que `festivos.ts`): validar formato con `^\d{4}-\d{2}-\d{2}$`, operar sobre componentes año/mes/día parseados de la cadena, usar `Date.UTC(...).getUTCDay()` para el día de la semana (estable e independiente de la zona del proceso). NO usar `new Date("YYYY-MM-DD")` con parsing local.
- Test co-localizado: `src/features/liquidacion/domain/dias-laborales.test.ts` (convención `*.test.ts`, conventions.md §1/§2).
- Constante de orden de días: el enum `DiaSemana` del contrato (api-contract.md §2).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
