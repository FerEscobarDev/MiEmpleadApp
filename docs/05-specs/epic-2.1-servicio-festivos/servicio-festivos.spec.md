# SPEC: Servicio de Festivos (Ley Emiliani) — id: epic-2.1-servicio-festivos/servicio-festivos

**Epic:** [Epic 2.1 — Servicio de Festivos (Ley Emiliani)](../../04-roadmap/ROADMAP.md)   **Módulo:** [§2.7 Servicio de Festivos](../../02-architecture/architecture.md#27-servicio-de-festivos-ley-emiliani)

## Objetivo

Exponer un servicio puro y determinista que responda, para un mes/año dados, cuáles fechas son festivos colombianos **observados** (ya aplicada la Ley Emiliani, que traslada ciertos festivos al lunes siguiente), y que permita preguntar si una fecha concreta es festivo. Las fechas se manejan en zona horaria America/Bogotá representadas como cadenas `YYYY-MM-DD`, sin depender de la zona horaria de la máquina anfitriona. Este servicio es el insumo de festivos que consumirá el dominio de liquidación (RN-03) sin que en ningún punto se hardcodeen festivos a mano.

## Decisión de librería (justificación, requerida por arquitectura §6 y conventions §4)

Se elige **`colombian-holidays`** (npm, versión `^5`, licencia MIT, mantenida — última publicación 2026-03, tipos `dist/index.d.ts` incluidos, única dependencia `pascua` para el cálculo de Pascua). Está especializada en el calendario colombiano e implementa la Ley Emiliani.

**Hallazgo crítico de semántica (debe respetarse en la implementación y los tests):** cada festivo que retorna la librería tiene dos campos de fecha:
- `celebrationDate`: la fecha **observada** (tras aplicar Ley Emiliani — el lunes trasladado cuando corresponde). **Esta es la fecha en que efectivamente no se trabaja** y la que importa para RN-03.
- `date`: la fecha **original/litúrgica** sin trasladar.

Ejemplo verificado empíricamente: San José 2025 → `date = 2025-03-19` (miércoles, litúrgico), `celebrationDate = 2025-03-24` (lunes, observado). El servicio DEBE exponer **`celebrationDate`**. Usar `date` sería incorrecto para el negocio.

Se descartó `date-holidays` (genérica multipaís, más pesada: dependencias `js-yaml`, `lodash`, `date-holidays-parser`) por no aportar valor frente a la opción especializada, y `colombia-holidays@0.0.1` por inmadurez. No se hardcodean festivos: la lista proviene íntegramente de la librería.

## Fuera de Scope (NO testear, NO implementar)

- El conteo de días laborales (L–S) y el cálculo de liquidación (eso es Epic 2.2). Este servicio solo dice **qué fechas son festivas**, no si caen en día laboral ni su efecto monetario.
- Cualquier acceso a base de datos, HTTP, Server Actions o componentes React.
- Lectura de la fecha "hoy" del sistema: el año/mes siempre se reciben como parámetros.
- Festivos de países distintos a Colombia.
- Cacheo, memoización o persistencia.
- Validación de rango histórico extremo de la librería (años fuera de 1583–4099); fuera de uso real de la app.

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)

N/A — lógica interna pura (Capa de Dominio / Servicio de Festivos). Sin boundary HTTP.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

### Función `getHolidaysInMonth`

| Aspecto | Detalle |
|---------|---------|
| Entradas | `year`: number (entero, ej. 2025); `month`: number (entero 1–12, donde 1 = enero) |
| Salidas (éxito) | `string[]` — fechas festivas **observadas** de ese mes en formato `YYYY-MM-DD`, **ordenadas ascendentemente** y **sin duplicados**. Para meses sin festivos: `[]` |
| Salidas (error) | `month` fuera de 1–12 → lanza `RangeError` (entrada inválida = error inesperado de programación, no de negocio; conventions §6) |
| Efectos secundarios | Ninguno (función pura) |
| Idempotencia | Sí — misma entrada ⇒ misma salida, independiente de la zona horaria de la máquina y de la fecha actual |

### Función `isHoliday`

| Aspecto | Detalle |
|---------|---------|
| Entradas | `isoDate`: string en formato exacto `YYYY-MM-DD` (fecha en zona America/Bogotá) |
| Salidas (éxito) | `boolean` — `true` si esa fecha es un festivo colombiano observado (post-Emiliani); `false` en caso contrario |
| Salidas (error) | `isoDate` que no cumple el formato `YYYY-MM-DD` → lanza `RangeError` |
| Efectos secundarios | Ninguno (función pura) |
| Idempotencia | Sí — determinista e independiente de la zona horaria de la máquina |

> Nota de implementación (no es código): `isHoliday` debe derivar su respuesta de la **misma fuente de fechas observadas** que `getHolidaysInMonth` (las cadenas `YYYY-MM-DD` de `celebrationDate`), comparando cadenas — NO debe delegar en la función `isHoliday(Date)` de la librería, porque esa recibe un `Date` y puede derivar a otro día según la zona horaria del host. El objetivo es comportamiento determinista y parametrizado (architecture §6, conventions §3).

## Reglas de Negocio

- **BR-1:** Los festivos colombianos se calculan aplicando la **Ley Emiliani**, que traslada ciertos festivos al lunes siguiente. La fecha relevante para el negocio es la fecha **observada** (trasladada), no la litúrgica original. — fuente: business_requirements.md RN-03 y glosario "Festivo (Ley Emiliani)".
- **BR-2:** Las fechas se calculan en la zona horaria de Colombia (**America/Bogotá**); la salida no debe depender de la zona horaria de la máquina que ejecuta el código. — fuente: business_requirements.md RN-17.
- **BR-3:** **Prohibido** hardcodear la lista de festivos a mano; deben provenir de una librería que aplique la Ley Emiliani. — fuente: conventions.md §4 (deny-list) y architecture.md §6.
- **BR-4:** El servicio solo identifica fechas festivas; el efecto de que un festivo en día laboral se pague y no se descuente (RN-03) lo aplica el dominio de liquidación (Epic 2.2), no este servicio.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `getHolidaysInMonth(2025, 1)` retorna exactamente `["2025-01-01", "2025-01-06"]` (Año Nuevo fijo; Reyes Magos observado el lunes 6).
- **AC-2:** `getHolidaysInMonth(2025, 3)` incluye `"2025-03-24"` (San José trasladado al lunes por Ley Emiliani) y **NO** incluye `"2025-03-19"` (fecha litúrgica original sin trasladar).
- **AC-3:** `getHolidaysInMonth(2025, 5)` incluye `"2025-05-01"` (Día del Trabajo, festivo **fijo** que NO se traslada).
- **AC-4:** `getHolidaysInMonth(2025, 7)` incluye `"2025-07-20"` (Grito de la Independencia, fijo).
- **AC-5:** `getHolidaysInMonth(2025, 8)` incluye `"2025-08-07"` (Batalla de Boyacá, fijo) y `"2025-08-18"` (Asunción de la Virgen, trasladada al lunes).
- **AC-6:** El resultado de `getHolidaysInMonth` para cualquier mes está **ordenado ascendentemente**, **sin duplicados** y todas las cadenas cumplen el formato `YYYY-MM-DD`.
- **AC-7:** `getHolidaysInMonth` con un mes sin festivos colombianos retorna `[]` (lista vacía).
- **AC-8:** `isHoliday("2025-03-24")` es `true` (lunes observado de San José) e `isHoliday("2025-03-19")` es `false` (fecha original no observada).
- **AC-9:** `isHoliday("2025-01-01")` es `true` e `isHoliday("2025-07-21")` es `false` (día corriente no festivo).
- **AC-10:** Guarda contra off-by-one entre años (y verifica el traslado Emiliani de Reyes Magos según el día de la semana en que cae el 6 de enero): `getHolidaysInMonth(2024, 1)` retorna `["2024-01-01", "2024-01-08"]` (en 2024 el 6 de enero es sábado, así que Reyes Magos se observa el lunes 8) y `getHolidaysInMonth(2026, 1)` retorna `["2026-01-01", "2026-01-12"]` (en 2026 el 6 de enero es martes, así que Reyes Magos se observa el lunes 12). En 2025 el 6 de enero ya es lunes, por lo que no se traslada (AC-1).
- **AC-11:** Determinismo / independencia de zona horaria: para una misma entrada, `getHolidaysInMonth` e `isHoliday` retornan el mismo resultado sin importar la zona horaria del proceso (verificable fijando `process.env.TZ` a una zona no-Bogotá antes de invocar y comparando con el resultado esperado en cadenas `YYYY-MM-DD`).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** Festivo trasladable que cae sábado/domingo → la salida usa el **lunes siguiente observado**, no la fecha original (cubierto por San José AC-2).
- **EC-2:** Festivo **fijo** (Año Nuevo, Día del Trabajo, Independencia 20-jul, Boyacá 7-ago, Inmaculada 8-dic, Navidad 25-dic) → NO se traslada aunque caiga en fin de semana (cubierto por AC-3, AC-4, AC-5).
- **EC-3:** Dos festivos observados el mismo lunes (ej. 2025-06-30: San Pedro y Sagrado Corazón) → la fecha aparece **una sola vez** (de-duplicación, AC-6).
- **EC-4:** `month` = 0, 13 o negativo → `RangeError` (AC implícito en contrato; mínimo un test).
- **EC-5:** `isHoliday` con cadena mal formada (ej. `"2025/03/24"`, `"24-03-2025"`, `"2025-3-4"`) → `RangeError`.

## Superficie de Código Existente (para el implementer — lo llena el orquestador en Step 2)

- **Crea:** módulo del servicio de festivos en `src/features/liquidacion/domain/festivos.ts` (lógica pura de dominio, co-localizada con su consumidor principal; conventions §2 ubica la lógica de festivos en `features/*/domain`). Exporta las funciones públicas `getHolidaysInMonth(year: number, month: number): string[]` e `isHoliday(isoDate: string): boolean`.
- **Tests (los escribe el tdd-test-writer):** `src/features/liquidacion/domain/festivos.test.ts` (co-localizado; glob `src/**/*.test.{ts,tsx}`).
- **Llama a:** la librería `colombian-holidays` (^5). API tipada disponible:
  - `colombianHolidays(options?: { year?: number; month?: number; valueAsDate?: false }): ColombianHoliday[]`
  - `ColombianHoliday = { name: { en: string; es: string }; nextMonday: boolean; date: string; celebrationDate: string }`
  - **Usar `celebrationDate`** (fecha observada post-Emiliani) como fuente de verdad; las cadenas vienen en formato `YYYY-MM-DD`.
  - Nota: el campo `month` de la librería filtra por el mes de la fecha **observada**; aun así, la implementación debe filtrar/ordenar/deduplicar las cadenas `celebrationDate` resultantes para garantizar AC-6.
- **Dependencia a agregar a `package.json`:** `colombian-holidays@^5` en `dependencies` (npm). No agregar otras dependencias.
- **Fixtures disponibles:** ninguno aplica (dominio puro; sin DB, sin factories). NO usar `src/lib/test/factories.ts` ni `db-test-setup.ts`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
