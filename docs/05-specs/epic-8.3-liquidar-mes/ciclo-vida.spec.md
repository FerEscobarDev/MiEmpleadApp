# SPEC: Ciclo de vida — cerrar y reabrir liquidación — id: epic-8.3-liquidar-mes/ciclo-vida

**Epic:** Epic 8.3 — Liquidar mes (calendario visual) [ROADMAP §Milestone 8]   **Módulo:** frontend `(employer)/liquidar` (architecture.md §2.1)

## Objetivo
Desde `/liquidar`, el empleador cierra (aplica) la liquidación del mes — lo que la congela y bloquea la edición — y puede reabrir una cerrada para corregirla. Ambas acciones se confirman con un diálogo modal antes de ejecutar la operación del contrato, y el estado (badge) y la editabilidad de la página reflejan el resultado.

## Fuera de Scope (NO testear, NO implementar)
- Selección de mes/año y render base (Spec `seleccion-y-desglose`).
- Registro de novedades (Spec `novedades`); aquí solo se observa que cerrar deshabilita la edición y reabrir la re-habilita.
- Congelamiento real de valores (RN-09) — lo hace el backend; la página solo refleja el `estado` devuelto.
- Eliminar una liquidación (es de `/historial`, Epic 8.4).

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado): `cerrarLiquidacion` (`POST /liquidaciones/{anio}/{mes}/cierre`), `reabrirLiquidacion` (`POST /liquidaciones/{anio}/{mes}/reapertura`).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`/`mes` (path params del mes seleccionado). Sin cuerpo. |
| Salidas (éxito) | `200` `Liquidacion` con el nuevo `estado` (`CERRADA` tras cerrar, `BORRADOR` tras reabrir) → reemplaza el estado mostrado (badge + editabilidad). Toast de éxito. |
| Salidas (error) | `409` (p.ej. ya cerrada / ya en borrador) → mensaje amable. Otros → toast de error genérico. |
| Efectos secundarios | Cerrar congela valores en el backend; reabrir vuelve a borrador. La UI solo refleja `estado`. |
| Idempotencia | `cerrarLiquidacion`/`reabrirLiquidacion` no son idempotentes (un segundo cierre da 409). |

## Reglas de Negocio
- **BR-1 (RN-11, RN-13):** Solo el empleador cierra/reabre; la página vive en el grupo protegido `(employer)`. Cerrar pasa a `CERRADA` (bloquea edición); reabrir vuelve a `BORRADOR` (re-habilita). — fuente: business_requirements.md §RN-11, §RN-13
- **BR-2 (DS §3 Modal/Dialog):** Cerrar y reabrir son cambios de estado relevantes: cada uno se confirma con un Dialog (botón confirmar + cancelar, foco atrapado, cierre con Esc). Cancelar NO ejecuta la operación. — fuente: design_system.md §3 (Modal/Dialog)
- **BR-3 (RN-09):** Tras cerrar, la liquidación queda congelada → la UI muestra el badge "Cerrada" y deshabilita la edición de novedades. — fuente: business_requirements.md §RN-09

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** En estado `BORRADOR` se muestra el botón "Cerrar liquidación" y NO el de "Reabrir".
- **AC-2:** Pulsar "Cerrar liquidación" abre un Dialog de confirmación; confirmar llama a `cerrarLiquidacion` (POST a `/liquidaciones/{anio}/{mes}/cierre`) y, con la respuesta `CERRADA`, el badge pasa a "Cerrada".
- **AC-3:** En el Dialog de cierre, pulsar "Cancelar" cierra el diálogo SIN llamar a `cerrarLiquidacion`.
- **AC-4:** En estado `CERRADA` se muestra el botón "Reabrir" y NO el de "Cerrar liquidación".
- **AC-5:** Pulsar "Reabrir" abre un Dialog de confirmación; confirmar llama a `reabrirLiquidacion` (POST a `/liquidaciones/{anio}/{mes}/reapertura`) y, con la respuesta `BORRADOR`, el badge vuelve a "Borrador" y la edición se re-habilita.
- **AC-6:** Un `409` al cerrar o reabrir muestra un mensaje amable y no rompe la página.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Un error genérico (500) al cerrar/reabrir muestra toast de error y conserva el estado previo.
- **EC-2:** El Dialog de confirmación cita el mes/periodo afectado para evitar cerrar el mes equivocado.

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient.POST("/liquidaciones/{anio}/{mes}/cierre", { params: { path: { anio, mes } } })`; `apiClient.POST("/liquidaciones/{anio}/{mes}/reapertura", { params: { path: { anio, mes } } })` — devuelven `{ data?: Liquidacion, error? }`.
- Usa tipos: `components["schemas"]["Liquidacion"]`, `["EstadoLiquidacion"]`.
- Reutiliza: `Dialog`/`DialogContent`/`DialogTitle`/`DialogDescription`/`DialogFooter` (`src/components/ui/Dialog.tsx`); `Button` (variants `primary`/`ghost`/`danger`); `Badge`; `toast` de `sonner`. Patrón de Dialog de confirmación ya usado en `src/app/(employer)/configuracion/items-adicionales-section.tsx`.
- Crea: la lógica de cierre/reapertura dentro de `src/app/(employer)/liquidar/liquidar-mes-section.tsx` (o subcomponente co-localizado) + tests `*.test.tsx`.
- Fixtures disponibles: patrón de mock de `fetch` de `items-adicionales-section.test.tsx`.
- Nota de honestidad TDD: NO modificar los tests sellados de las Specs `seleccion-y-desglose` y `novedades` tras su RED.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
