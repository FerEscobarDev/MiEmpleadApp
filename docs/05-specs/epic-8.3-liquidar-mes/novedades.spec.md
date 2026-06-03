# SPEC: Registro de novedades del borrador — id: epic-8.3-liquidar-mes/novedades

**Epic:** Epic 8.3 — Liquidar mes (calendario visual) [ROADMAP §Milestone 8]   **Módulo:** frontend `(employer)/liquidar` (architecture.md §2.1)

## Objetivo
Sobre una liquidación en borrador, el empleador registra las novedades del mes: marca/desmarca inasistencias tocando días del calendario, ajusta cantidades de items adicionales, agrega montos puntuales sueltos y edita las notas privadas. Cada cambio se persiste con `actualizarLiquidacion` y la respuesta recalculada (desglose + calendario + total) reemplaza el estado mostrado. Cuando la liquidación está cerrada, la edición está deshabilitada.

## Fuera de Scope (NO testear, NO implementar)
- Selección de mes/año, carga inicial y render base (Spec `seleccion-y-desglose`).
- Cerrar / reabrir (Spec `ciclo-vida`).
- Cálculo del desglose, validación de inasistencia o congelamiento (dominio del backend).
- CRUD de la definición de items adicionales (eso es `/configuracion`, Epic 8.2). Aquí solo se listan items activos (`listarItemsAdicionales`) para capturar cantidades.

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado): `actualizarLiquidacion` (`PUT /liquidaciones/{anio}/{mes}`), `listarItemsAdicionales` (`GET /items-adicionales`) para poblar el selector de items.
- `obtenerLiquidacion` se asume ya consumido por la carga base; este spec usa la respuesta de `actualizarLiquidacion` para refrescar.

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `ActualizarLiquidacionInput` `{ inasistencias?: date[], items?: {itemId, cantidad}[], montosPuntuales?: {descripcion, monto}[], notas?: string }` enviado a `PUT /liquidaciones/{anio}/{mes}`. Para items: catálogo de `listarItemsAdicionales` `ItemAdicional[]`. |
| Salidas (éxito) | `200` `Liquidacion` recalculada → reemplaza calendario, desglose, total, inasistencias, items, montos y notas mostrados. Toast de éxito. |
| Salidas (error) | `409 INASISTENCIA_INVALIDA` → mensaje amable ("Esa fecha no admite inasistencia…"), sin alterar el estado. `409 LIQUIDACION_CERRADA` → mensaje amable de mes cerrado. `422`/otros → toast de error genérico. |
| Efectos secundarios | Persiste novedades; recalcula el total en el backend (cálculo en vivo del borrador). |
| Idempotencia | `actualizarLiquidacion` es idempotente: reenviar el mismo input deja el mismo estado. |

## Reglas de Negocio
- **BR-1 (RN-04, RN-05):** Marcar una fecha como inasistencia descuenta un valor-día; solo es válida en día laboral, no festivo y dentro de contrato. La página no valida localmente: envía la fecha y deja que el backend acepte (200) o rechace (`409 INASISTENCIA_INVALIDA`). — fuente: business_requirements.md §RN-04, §RN-05
- **BR-2 (RN-05, Caso límite "Inasistencia inválida"):** Un `409 INASISTENCIA_INVALIDA` se traduce a un mensaje amable y NO cambia el calendario mostrado. — fuente: business_requirements.md §Casos Límite
- **BR-3 (RN-08):** Items (cantidad × valor) y montos puntuales suman al total; el total mostrado tras cada actualización es el `desglose.total` devuelto. — fuente: business_requirements.md §RN-08
- **BR-4 (RN-12):** Las notas son privadas del empleador; se editan aquí (campo de texto) y se envían en `notas`. — fuente: business_requirements.md §RN-12
- **BR-5 (RN-11):** Si la liquidación está `CERRADA`, la edición de novedades está deshabilitada en la UI; un intento que el backend rechace con `409 LIQUIDACION_CERRADA` muestra un mensaje amable. — fuente: business_requirements.md §RN-11

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** En estado `BORRADOR`, tocar un día del calendario que no es inasistencia lo marca: se llama a `actualizarLiquidacion` (PUT) con esa fecha incluida en `inasistencias`, y el desglose/total mostrado se actualiza con la respuesta.
- **AC-2:** Tocar un día que ya es inasistencia lo desmarca: el PUT se envía con esa fecha **ausente** de `inasistencias`.
- **AC-3:** Un `409 INASISTENCIA_INVALIDA` al marcar muestra un mensaje amable (texto sobre fecha no válida para inasistencia) y el calendario/desglose no cambian.
- **AC-4:** El panel de items se puebla desde `listarItemsAdicionales`; ajustar la cantidad de un item y guardar envía `actualizarLiquidacion` con `items: [{itemId, cantidad}]` y refresca el total.
- **AC-5:** Agregar un monto puntual (descripción + monto) y guardar envía `actualizarLiquidacion` con ese `montosPuntuales` y refresca el total.
- **AC-6:** Editar las notas y guardar envía `actualizarLiquidacion` con `notas`.
- **AC-7:** En estado `CERRADA`, los controles de edición (marcar inasistencia, cantidades, montos, notas) están deshabilitados / no disparan llamadas de escritura.
- **AC-8:** Un `409 LIQUIDACION_CERRADA` devuelto por una actualización muestra un mensaje amable de mes cerrado.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Si `listarItemsAdicionales` no devuelve items, el panel de items muestra un estado vacío y no rompe el resto de la página.
- **EC-2:** Un error genérico (500) en `actualizarLiquidacion` muestra toast de error y conserva el estado previo (no deja la UI inconsistente).

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient.PUT("/liquidaciones/{anio}/{mes}", { params: { path: { anio, mes } }, body })` (body = `ActualizarLiquidacionInput`); `apiClient.GET("/items-adicionales")`. El cliente devuelve `{ data?, error?, response }`; para distinguir el `code` de un 409 hay que leer el cuerpo del error (`error` contiene `{ code, message }`).
- Usa tipos: `components["schemas"]["Liquidacion"]`, `["ActualizarLiquidacionInput"]`, `["ItemAdicional"]`, `["LiquidacionItem"]`, `["MontoPuntual"]`.
- Reutiliza: `MonthCalendar` (`onSelectDay: (fecha: string) => void`); `CurrencyDisplay`; `Input`/`Textarea`/`Button`/`Switch` de `src/components/ui`; `toast` de `sonner`; `EmptyState`.
- Crea: novedades dentro de `src/app/(employer)/liquidar/liquidar-mes-section.tsx` (o subcomponentes `novedades-*.tsx` co-localizados) + tests `*.test.tsx`.
- Fixtures disponibles: patrón de mock de `fetch` y `parseBody` en `src/app/(employer)/configuracion/items-adicionales-section.test.tsx` (replicar el estilo, distinguiendo el `code` en respuestas 409).
- Nota de honestidad TDD: NO modificar los tests sellados de la Spec `seleccion-y-desglose` tras su RED.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
