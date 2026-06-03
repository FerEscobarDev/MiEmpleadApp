# SPEC: Modelo de días del calendario — id: epic-2.2-dominio-calculo-liquidacion/modelo-calendario

**Epic:** Epic 2.2 — Dominio de cálculo de liquidación (ROADMAP Milestone 2)   **Módulo:** architecture.md §2.4 Capa de Dominio (lógica pura)

## Objetivo

Construir, como función pura, el modelo de días del mes para el calendario visual: a cada día del mes se le asigna un único `TipoDiaCalendario` (`TRABAJADO | INASISTENCIA | FESTIVO | NO_LABORAL | FUERA_CONTRATO`) consistente con la configuración de días laborales, el periodo de contrato, los festivos del mes y las inasistencias registradas. El resultado es la lista `DiaCalendario[]` que el epic de API (5.1) serializará para colorear el calendario.

## Fuera de Scope (NO testear, NO implementar)

- El cálculo de montos / `Desglose` — Spec 2.
- El conteo de días y el valor-día — Spec 1.
- Festivos: se reutiliza `getHolidaysInMonth` (Epic 2.1); se reciben como parámetro. NO se reimplementan.
- La asociación de items adicionales a días (`itemsAdicionales` en `DiaCalendario` es opcional en el contrato) — NO entra en este spec; el dominio no la calcula aquí.
- Persistencia, HTTP, colores concretos (los colores son de la UI; el dominio solo da el `tipo`).

## Operaciones del Contrato de API

- **Sin boundary HTTP:** N/A — lógica interna. La salida mapea 1:1 al esquema `DiaCalendario` (api-contract.md §2: `{ fecha: date, tipo: TipoDiaCalendario, itemsAdicionales?: string[] }`); el dominio retorna objetos planos `{ fecha, tipo }`.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `construirCalendario(params)` con: `year`:int; `month`:int 1–12; `diasLaborales`:`DiaSemana[]`; `fechaInicioContrato`:`YYYY-MM-DD`; `fechaFinContrato`:`YYYY-MM-DD\|null`; `festivos`:`YYYY-MM-DD[]` (los del mes); `inasistencias`:`YYYY-MM-DD[]`. |
| Salidas (éxito) | `DiaCalendario[]`: un elemento por cada día del mes (orden ascendente), `{ fecha:string YYYY-MM-DD, tipo: TipoDiaCalendario }`. La longitud = número de días del mes. |
| Salidas (error) | `month` fuera de 1–12 o fecha mal formada → `RangeError` (vía helpers de Spec 1). |
| Efectos secundarios | Ninguno (función pura). |
| Idempotencia | Sí: misma entrada → misma salida, independiente de la zona del proceso. |

### Reglas de precedencia del tipo de día (un solo tipo por día)

Se evalúan en este orden; el primero que aplica determina el tipo:

1. **NO_LABORAL** — el día de la semana NO está en `diasLaborales`. (Un festivo o un día fuera de contrato que cae en día no laboral es irrelevante: prima NO_LABORAL — RN-02/RN-03.)
2. **FUERA_CONTRATO** — es día laboral pero la fecha es anterior a `fechaInicioContrato` o posterior a `fechaFinContrato` (RN-06/RN-07).
3. **FESTIVO** — es día laboral, dentro de contrato, y la fecha está en `festivos` (RN-03: pagado, no descontado; visualmente distinto).
4. **INASISTENCIA** — es día laboral, dentro de contrato, no festivo, y la fecha está en `inasistencias` (RN-04/RN-05).
5. **TRABAJADO** — día laboral, dentro de contrato, no festivo, no inasistencia.

## Reglas de Negocio

- **BR-1 (RN-02):** un día cuyo día de la semana no es laboral ⇒ `NO_LABORAL`, prevalece sobre festivo/contrato/inasistencia. — RN-02.
- **BR-2 (RN-06/RN-07):** días laborales antes del inicio o después del fin del contrato ⇒ `FUERA_CONTRATO` (no se pagan, "gris claro"). — RN-06, RN-07.
- **BR-3 (RN-03):** festivo en día laboral dentro de contrato ⇒ `FESTIVO` (pagado, no descontado). Festivo en día no laboral ⇒ irrelevante (queda `NO_LABORAL` por BR-1). — RN-03.
- **BR-4 (RN-04/RN-05):** una inasistencia registrada en día laboral, en contrato y no festivo ⇒ `INASISTENCIA`. Una "inasistencia" sobre un día no laboral / festivo / fuera de contrato NO produce el tipo `INASISTENCIA` (esos días conservan su tipo por precedencia; la inasistencia ahí es inválida, RN-05). — RN-04, RN-05.
- **BR-5:** todo día laboral, en contrato, no festivo y no inasistente ⇒ `TRABAJADO`.
- **BR-6 (RN-17):** fechas en zona America/Bogotá operadas como cadenas; determinismo independiente de la zona del proceso. — RN-17.

## Criterios de Aceptación (≥1 test por ID)

> Mes de referencia: septiembre 2025 (30 días, L–S laborales; domingos 7, 14, 21, 28 son no laborales).

- **AC-1 (longitud y orden):** `construirCalendario` para septiembre 2025 retorna 30 elementos, `fecha` ascendente de `2025-09-01` a `2025-09-30`.
- **AC-2 (NO_LABORAL):** con L–S, los domingos (`2025-09-07`, `2025-09-14`, `2025-09-21`, `2025-09-28`) tienen `tipo = NO_LABORAL`.
- **AC-3 (FUERA_CONTRATO, RN-06):** contrato inicia `2025-09-15` ⇒ `2025-09-01` (lunes, laboral, antes del inicio) tiene `tipo = FUERA_CONTRATO`; `2025-09-15` (lunes) tiene `tipo = TRABAJADO`.
- **AC-4 (FUERA_CONTRATO fin, RN-07):** contrato fin `2025-09-15` ⇒ `2025-09-16` (martes laboral posterior al fin) tiene `tipo = FUERA_CONTRATO`; `2025-09-15` tiene `tipo = TRABAJADO`.
- **AC-5 (FESTIVO en día laboral, RN-03):** agosto 2025, L–S, contrato completo, `festivos=["2025-08-07","2025-08-18"]` ⇒ `2025-08-07` (jueves) y `2025-08-18` (lunes) tienen `tipo = FESTIVO`.
- **AC-6 (festivo en día no laboral ⇒ NO_LABORAL, RN-03):** septiembre 2025, `festivos=["2025-09-07"]` (domingo) ⇒ `2025-09-07` tiene `tipo = NO_LABORAL` (no `FESTIVO`).
- **AC-7 (INASISTENCIA, RN-04):** septiembre 2025, contrato completo, `inasistencias=["2025-09-16"]` (martes laboral) ⇒ `2025-09-16` tiene `tipo = INASISTENCIA`.
- **AC-8 (TRABAJADO):** septiembre 2025, contrato completo, sin festivos ni inasistencias ⇒ `2025-09-02` (martes) tiene `tipo = TRABAJADO`.
- **AC-9 (precedencia inasistencia inválida sobre día no laboral):** `inasistencias=["2025-09-07"]` (domingo) ⇒ `2025-09-07` sigue siendo `NO_LABORAL`, NO `INASISTENCIA` (RN-05).
- **AC-10 (precedencia festivo > inasistencia):** una fecha que es festivo en día laboral y además figura en `inasistencias` ⇒ `tipo = FESTIVO` (la inasistencia en festivo es inválida, RN-05).
- **AC-11 (mes parcial completo — distribución):** septiembre 2025, L–S, contrato inicia `2025-09-15`, `inasistencias=["2025-09-16"]`, sin festivos ⇒ conteo de tipos: `FUERA_CONTRATO=12`, `NO_LABORAL=4`, `TRABAJADO=13`, `INASISTENCIA=1` (suma 30).
- **AC-12 (determinismo/TZ):** resultados estables bajo `process.env.TZ="Asia/Tokyo"`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** mes completamente fuera de contrato (inicio en un mes posterior) ⇒ todos los días laborales son `FUERA_CONTRATO` y los no laborales `NO_LABORAL`; ningún `TRABAJADO`.
- **EC-2:** `diasLaborales=[]` ⇒ todos los días son `NO_LABORAL`.
- **EC-3:** una inasistencia fuera del mes o fuera de contrato no genera tipo `INASISTENCIA` en ningún día del mes.
- **EC-4:** `month` inválido ⇒ `RangeError`.

## Superficie de Código Existente (para el implementer)

- Llama a (Spec 1, `src/features/liquidacion/domain/dias-laborales.ts`):
  - `enumerarDiasDelMes(year:number, month:number): string[]`
  - `esDiaLaboral(isoDate:string, diasLaborales:DiaSemana[]): boolean`
  - tipo `DiaSemana`.
- Puede reutilizar (Spec 2, `src/features/liquidacion/domain/calculo.ts`): `esInasistenciaValida(fecha:string, ctx:{diasLaborales, festivos, fechaInicioContrato, fechaFinContrato}): boolean` para decidir si un día marcado como inasistencia es realmente del tipo `INASISTENCIA`. No obligatorio, pero evita duplicar la regla RN-05.
- Crea: `src/features/liquidacion/domain/calendario.ts` con `construirCalendario`, el tipo exportado `TipoDiaCalendario` (unión de los 5 literales del contrato, api-contract.md §2) y el tipo `DiaCalendario` (`{ fecha:string, tipo:TipoDiaCalendario }`).
- Test co-localizado: `src/features/liquidacion/domain/calendario.test.ts`.
- Los valores del enum `TipoDiaCalendario` deben coincidir EXACTAMENTE con el contrato: `TRABAJADO | INASISTENCIA | FESTIVO | NO_LABORAL | FUERA_CONTRATO`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
