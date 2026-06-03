# SPEC: Selección de mes + carga y desglose de liquidación — id: epic-8.3-liquidar-mes/seleccion-y-desglose

**Epic:** Epic 8.3 — Liquidar mes (calendario visual) [ROADMAP §Milestone 8]   **Módulo:** frontend `(employer)/liquidar` (architecture.md §2.1 — la UI consume el backend solo por el cliente tipado)

## Objetivo
En `/liquidar`, el empleador elige un mes y un año y la página carga la liquidación de ese periodo (`obtenerLiquidacion`), mostrando el calendario coloreado por tipo de día con su leyenda, un panel de desglose destacado con el total a pagar, y un badge con el estado (borrador/cerrada). Si el mes está fuera del periodo de contrato, se muestra un mensaje amable en lugar del calendario.

## Fuera de Scope (NO testear, NO implementar)
- Edición de novedades (inasistencias, items, montos, notas) → Spec `novedades`.
- Cerrar / reabrir la liquidación → Spec `ciclo-vida`.
- Cálculo del desglose o de los tipos de día (vive en el dominio del backend; la página solo renderiza lo que devuelve el contrato).
- Persistencia, autenticación y el shell del empleador (ya provistos por el grupo `(employer)` del Epic 8.1).

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado generado, nunca URL a mano): `obtenerLiquidacion` (`GET /liquidaciones/{anio}/{mes}`).
- **Sin otras operaciones en este spec.**

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`: integer (path param); `mes`: integer 1-12 (path param). Seleccionados por el usuario; default = mes/año actuales (zona local del dispositivo). |
| Salidas (éxito) | `200` `Liquidacion` `{ anio, mes, estado, desglose: Desglose, calendario: DiaCalendario[], inasistencias, items, montosPuntuales, notas? }`. Renderizada: calendario + leyenda + panel de desglose + badge de estado. |
| Salidas (error) | `409 MES_FUERA_DE_CONTRATO` → mensaje amable ("Este mes está fuera del periodo de contrato…"), sin calendario ni desglose. Cualquier otro error (red/500) → mensaje de error genérico + toast, sin Skeleton infinito. |
| Efectos secundarios | Ninguno (solo lectura). Cambiar mes/año dispara una nueva carga. |
| Idempotencia | `obtenerLiquidacion` es idempotente; recargar el mismo mes devuelve el mismo resultado. |

## Reglas de Negocio
- **BR-1 (RN-08, RN-16):** El total a pagar y todos los montos del desglose se muestran en COP enteros (sin decimales), formateados por el único formateador de moneda de la UI (`CurrencyDisplay`/`formatCOP`). — fuente: business_requirements.md §RN-08, §RN-16
- **BR-2 (RN-16, DS §2.3):** El calendario colorea cada día por su `tipo` y **siempre** acompaña el color con una etiqueta textual (nunca solo color) — provisto por el componente de dominio `MonthCalendar`. — fuente: design_system.md §2.3
- **BR-3 (RN-11):** El estado de la liquidación (`BORRADOR` | `CERRADA`) se muestra como badge textual. — fuente: business_requirements.md §RN-11
- **BR-4 (RN-01..RN-07):** El panel de desglose muestra, en líneas etiquetadas: días laborales del mes (denominador), festivos en día laboral (no descontados), días trabajados, valor-día, subtotal días, subtotal items, subtotal montos puntuales y el **total destacado**. La página NO recalcula: toma los campos de `Desglose` tal cual los devuelve el contrato. — fuente: business_requirements.md §RN-01–RN-07
- **BR-5 (Caso límite "Mes fuera del contrato"):** Un mes fuera de contrato (`409 MES_FUERA_DE_CONTRATO`) no es liquidable: se informa amablemente y no se muestra calendario ni desglose. — fuente: business_requirements.md §Casos Límite

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar, la página usa el mes/año por defecto y llama a `obtenerLiquidacion` con esos `anio`/`mes` (GET a `/liquidaciones/{anio}/{mes}`).
- **AC-2:** Mientras la carga está pendiente se muestra un estado de carga (Skeleton) y no el calendario.
- **AC-3:** Con respuesta exitosa, se renderiza el `MonthCalendar` del mes (con su leyenda) y el panel de desglose con las líneas etiquetadas (días laborales, festivos en día laboral, días trabajados, valor-día, subtotales) y el **total** destacado, formateado en COP.
- **AC-4:** El badge de estado refleja `estado`: muestra "Borrador" cuando `BORRADOR` y "Cerrada" cuando `CERRADA`.
- **AC-5:** Cambiar el mes y/o el año en el selector dispara una nueva llamada a `obtenerLiquidacion` con el nuevo periodo y vuelve a renderizar calendario y desglose con la nueva respuesta.
- **AC-6:** Una respuesta `409 MES_FUERA_DE_CONTRATO` muestra un mensaje amable (texto que cita que el mes está fuera del periodo de contrato) y NO renderiza calendario ni panel de desglose.
- **AC-7:** El selector de mes y el de año son accesibles (etiqueta asociada / `aria-label`); el calendario expone sus etiquetas textuales por día (provisto por `MonthCalendar`).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Un error inesperado (500 / red) al cargar muestra un mensaje de error genérico y un toast de error; no se queda en Skeleton infinito.
- **EC-2:** El total puede ser 0 (mes con todas las inasistencias y sin items): se muestra "$ 0" sin romper el formateo.

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient.GET("/liquidaciones/{anio}/{mes}", { params: { path: { anio, mes } } })` en `src/lib/api/client.ts` — devuelve `{ data?: Liquidacion, error?: unknown }`.
- Usa tipos: `components["schemas"]["Liquidacion"]`, `["Desglose"]`, `["DiaCalendario"]`, `["EstadoLiquidacion"]`, `["TipoDiaCalendario"]` de `src/lib/api/schema.d.ts`.
- Reutiliza: `MonthCalendar` (`src/components/domain/MonthCalendar.tsx`, props `{ anio, mes, dias: DiaCalendario[], onSelectDay?, className? }`); `CurrencyDisplay` (`src/components/domain/CurrencyDisplay.tsx`, prop `amount: number`); `Badge` (`src/components/ui/Badge.tsx`, prop `variant`); `Card`/`CardHeader`/`CardTitle`/`CardContent` (`src/components/ui/Card.tsx`, `Card` acepta `variant="highlight"`); `Skeleton` (`src/components/ui/Skeleton.tsx`); `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue` (`src/components/ui/Select.tsx`) — o un `<select>` nativo accesible con `<label>` si simplifica el test en jsdom; `toast` de `sonner`.
- Crea: `src/app/(employer)/liquidar/page.tsx` (Server Component que renderiza la sección cliente); `src/app/(employer)/liquidar/liquidar-mes-section.tsx` (componente cliente con la lógica de selección/carga/render); tests co-localizados `*.test.tsx`.
- Fixtures disponibles: patrón de mock de `fetch` en `src/app/(employer)/configuracion/items-adicionales-section.test.tsx` (no duplicar el helper conceptualmente; replicar el estilo).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
