# SPEC: Pestañas Pago y Menú — id: epic-8.7-consulta-empleada/pago-menu-tabs

**Epic:** Epic 8.7 (ROADMAP Milestone 8)   **Módulo:** architecture.md §2.1 (cliente tipado), §2.2 (frontera lectura liquidación/menú)

## Objetivo
Implementar el cuerpo de las pestañas **Pago** y **Menú** de la vista de consulta de la empleada. Pago: selector de mes (mes actual por defecto) → `obtenerLiquidacion`, renderizando MonthCalendar (solo lectura, coloreado + leyenda) y el panel de desglose con el total vía CurrencyDisplay, **SIN mostrar notas (RN-12)**. Menú: `obtenerMenu` → "qué preparar hoy" destacado + el tablero semanal (solo lectura). Toda la I/O usa el cliente de consulta que inyecta `X-Acceso-Token` (spec A).

## Fuera de Scope (NO testear, NO implementar)
- La pestaña Tareas (spec C).
- La validación del token y el shell (spec A) — estas secciones se montan dentro del shell ya validado.
- Cualquier escritura: estas pestañas son de solo lectura (no editan liquidación ni menú).
- Cálculo de montos/días/festivos: vive en el backend; la UI solo renderiza lo que devuelve el contrato.

## Operaciones del Contrato de API
> Referencia por `operationId`. El contrato es la fuente de verdad.
- **Consume** (frontend, vía cliente tipado con header `X-Acceso-Token`, NUNCA URL a mano):
  - `obtenerLiquidacion` — `GET /liquidaciones/{anio}/{mes}` (la respuesta para la empleada NO incluye `notas`, ya stripeado por el backend).
  - `obtenerMenu` — `GET /menu`.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Pago: `anio`:int, `mes`:int(1–12) seleccionados (default = mes actual). Menú: ninguna. |
| Salidas (éxito) | `obtenerLiquidacion` → `Liquidacion { anio, mes, estado, desglose, calendario, inasistencias, items, montosPuntuales }` (SIN `notas`). `obtenerMenu` → `Menu { configuracion{comidas,periodicidad}, entradas[] }` |
| Salidas (error) | `obtenerLiquidacion` 409 `MES_FUERA_DE_CONTRATO` → mensaje amable "no hay datos para ese mes"; otros 4xx/5xx → mensaje de error de carga. `obtenerMenu` 5xx → mensaje de error de carga. |
| Efectos secundarios | Ninguno (lecturas). |
| Idempotencia | Sí. |

## Reglas de Negocio
- **BR-1 (RN-12):** La pestaña Pago NUNCA renderiza notas. Aunque la respuesta mockeada incluya un campo `notas` (defensa en profundidad), el DOM no debe mostrar su contenido. — fuente: business_requirements.md §RN-12.
- **BR-2 (HU-15):** Se muestra el desglose del cálculo: días laborales del mes, festivos en día laboral, días trabajados, valor-día, subtotales y total a pagar. — fuente: business_requirements.md HU-15.
- **BR-3 (HU-16):** Se muestra un calendario visual del mes coloreado por tipo de día con leyenda. — fuente: business_requirements.md HU-16.
- **BR-4 (HU-22):** El menú muestra qué preparar hoy de forma destacada, y la semana. — fuente: business_requirements.md HU-22.
- **BR-5 (RN-16):** Los montos se muestran en COP sin decimales, vía el único formateador (CurrencyDisplay). — fuente: business_requirements.md §RN-16, conventions.md §9.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar la pestaña Pago, llama a `obtenerLiquidacion` para el mes actual por defecto (path `/liquidaciones/{anio}/{mes}` con año y mes de hoy) enviando el header `X-Acceso-Token`.
- **AC-2:** Cambiar el selector de mes vuelve a llamar a `obtenerLiquidacion` con el nuevo año/mes.
- **AC-3:** Tras cargar, Pago renderiza el MonthCalendar (con leyenda) y el panel de desglose incluyendo el total formateado en COP.
- **AC-4 (RN-12, defensa en profundidad):** Si la respuesta mockeada de `obtenerLiquidacion` incluye `notas: "secreto"`, el texto "secreto" NO aparece en ningún lugar del DOM de la pestaña Pago.
- **AC-5:** Pago muestra un estado de carga (Skeleton) mientras espera, y un mensaje amable si la carga falla (sin Skeleton infinito).
- **AC-6:** Un mes `MES_FUERA_DE_CONTRATO` (409) muestra un mensaje amable de "sin datos para ese mes", no un error genérico ni un crash.
- **AC-7:** Al montar la pestaña Menú, llama a `obtenerMenu` enviando el header `X-Acceso-Token`.
- **AC-8 (HU-22):** Menú destaca "qué preparar hoy" (la fila/sección del día actual) y muestra el tablero semanal en solo lectura (sin inputs editables). La fecha "hoy" es inyectable para testabilidad.
- **AC-9:** Menú muestra estado de carga y un mensaje amable de error si `obtenerMenu` falla.
- **AC-10 (a11y):** El selector de mes de Pago tiene etiqueta accesible; el MonthCalendar conserva sus etiquetas textuales por día (provistas por el componente DS).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** `obtenerLiquidacion` sin `notas` en la respuesta (caso normal de empleada) → la pestaña Pago funciona igual; no asume la presencia de `notas`.
- **EC-2:** Menú sin entradas para el día de hoy → la sección "qué preparar hoy" indica que no hay nada definido para hoy (sin romperse).
- **EC-3:** Menú con periodicidad quincenal/mensual → el tablero "hoy" usa la semana correcta del ciclo o, si no es determinable en solo lectura, la semana 0; en todo caso no se rompe.

## Superficie de Código Existente (para el implementer)
- Cliente de consulta con header inyectado: el wrapper/contexto creado en el spec A (consulta-client). Reusarlo; NO crear otro cliente ni escribir URLs.
- Tipos del contrato: `components["schemas"]["Liquidacion"]`, `["Desglose"]`, `["DiaCalendario"]`, `["Menu"]`, `["MenuEntrada"]`, `["Periodicidad"]`, `["DiaSemana"]` en `@/lib/api/schema`.
- Componentes DS a reusar:
  - `MonthCalendar` en `@/components/domain/MonthCalendar` — firma: `MonthCalendar({ anio:number, mes:number, dias: DiaCalendario[], onSelectDay?, className? })`. En consulta NO se pasa `onSelectDay` (solo lectura).
  - `CurrencyDisplay` en `@/components/domain/CurrencyDisplay` — firma: `CurrencyDisplay({ amount:number, className?, ... })`.
  - `MenuBoard` en `@/components/domain/MenuBoard` — firma: `MenuBoard({ comidas:string[], entradas: MenuEntrada[], semana?:number, diaHoy?: DiaSemana, className? })`. Solo lectura por defecto (sin inputs).
  - `Skeleton` (`@/components/ui/Skeleton`), `EmptyState` (`@/components/ui/EmptyState`), `Input`/`Select` para el selector de mes (`@/components/ui/Input`).
  - Patrón de panel de desglose: `src/app/(employer)/liquidar/desglose-panel.tsx` (DesglosePanel) — puede reusarse o componerse uno análogo de SOLO LECTURA; en ambos casos NO renderiza notas (el componente actual no las renderiza).
- Helper de día-de-la-semana desde fecha: ver `diaSemanaDeFecha`/`DIA_POR_INDICE` en `src/app/(employer)/menu/plantilla-menu-section.tsx` (patrón a replicar, no importar de una ruta de empleador).
- Patrón de hook de carga con cliente tipado y estados loading/ok/error: `src/app/(employer)/liquidar/use-liquidacion.ts` y `src/app/(employer)/menu/use-menu.ts` (referencia de estilo).
- Fixtures de test: mock de `fetch` con `vi.stubGlobal` — ver `src/app/(employer)/tareas/checklist-section.test.tsx`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
