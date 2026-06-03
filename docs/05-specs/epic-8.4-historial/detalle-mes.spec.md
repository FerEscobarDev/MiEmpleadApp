# SPEC: Historial — Detalle de mes (ver / eliminar / reabrir) — id: epic-8.4-historial/detalle-mes

**Epic:** Epic 8.4 (Historial de liquidaciones) — ROADMAP Milestone 8   **Módulo:** frontend `(employer)` / feature `liquidacion` (navigation_map.md §`/historial/[anio]/[mes]`)

## Objetivo
Construir la página `/historial/[anio]/[mes]` del empleador: el detalle de un mes histórico con su desglose completo, calendario en modo lectura y novedades, más dos acciones administrativas. "Eliminar" abre un diálogo de confirmación (RN-19) y, solo al confirmar, elimina la liquidación y navega de vuelta a `/historial`. "Reabrir" se muestra únicamente si el mes está CERRADA y, tras confirmar, la reabre (vuelve a borrador). Todo el consumo del backend ocurre exclusivamente por el cliente tipado.

## Fuera de Scope (NO testear, NO implementar)
- El listado `/historial` (otro spec del epic).
- Editar novedades del mes (eso vive en `/liquidar`, Epic 8.3); aquí las novedades son de **solo lectura**.
- El cálculo de la liquidación / total (lo provee el backend; la UI solo renderiza el `Desglose` y `calendario` devueltos).
- Cerrar liquidación (no aplica en el detalle del historial; solo eliminar/reabrir).
- El shell `(employer)` y el guard de sesión (Epic 8.1).

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado generado, nunca URL a mano):
  - `obtenerLiquidacion` — `GET /liquidaciones/{anio}/{mes}` → `Liquidacion`.
  - `eliminarLiquidacion` — `DELETE /liquidaciones/{anio}/{mes}` → `204`.
  - `reabrirLiquidacion` — `POST /liquidaciones/{anio}/{mes}/reapertura` → `200` `Liquidacion`.
- DTO `Liquidacion`: `{ anio, mes, estado, desglose: Desglose, calendario: DiaCalendario[], inasistencias: string[], items: LiquidacionItem[], montosPuntuales: MontoPuntual[], notas? }`.

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `anio`, `mes` (path params, enteros) provenientes de la ruta dinámica `[anio]/[mes]`. |
| Salidas (éxito) | carga: `200` `Liquidacion`; eliminar: `204` → navega a `/historial`; reabrir: `200` `Liquidacion` (estado pasa a BORRADOR). |
| Salidas (error) | carga 409 `MES_FUERA_DE_CONTRATO` → mensaje amable, sin desglose; carga otro fallo → estado de error + toast; eliminar 404 → toast de error, permanece en la página; reabrir 409 → toast de error. |
| Efectos secundarios | eliminar borra la liquidación (persistencia, backend) y redirige; reabrir cambia el estado a borrador. |
| Idempotencia | carga: sí (GET). eliminar: no idempotente de cara a UI (tras éxito redirige; un reintento daría 404). reabrir: no (un 2.º intento da 409). |

## Reglas de Negocio
- **BR-1:** El detalle muestra el desglose completo, el calendario del mes y las novedades — fuente: HU-18.
- **BR-2:** Eliminar una liquidación **requiere confirmación explícita** (diálogo); cancelar NO elimina — fuente: RN-19, HU-19.
- **BR-3:** Tras eliminar con éxito, se vuelve al historial (`/historial`) — fuente: navigation_map.md §detalle (flujo crítico).
- **BR-4:** El botón "Reabrir" se muestra **solo** cuando el estado es CERRADA; reabrir vuelve la liquidación a borrador para corregir — fuente: HU-14, RN-11.
- **BR-5:** El calendario del detalle es **modo lectura** (sin selección de días) — fuente: navigation_map.md §detalle (calendario en modo lectura).
- **BR-6:** Una liquidación cerrada también puede eliminarse — fuente: casos límite "Eliminar una liquidación".
- **BR-7:** Los montos en COP sin decimales por el único formateador; estado por Badge textual — fuente: RN-16, design_system.md §3-4.
- **BR-8:** Solo el empleador (grupo protegido `(employer)`) — fuente: RN-13.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar con `anio`/`mes`, llama a `obtenerLiquidacion` (`GET /liquidaciones/{anio}/{mes}`) con ese periodo.
- **AC-2:** Mientras carga, muestra esqueleto; resuelto, renderiza el panel de desglose (líneas etiquetadas + total destacado en COP) y el calendario con su leyenda.
- **AC-3:** El badge refleja el estado recibido (Borrador/Cerrada).
- **AC-4:** El botón "Eliminar" está presente; al pulsarlo NO llama de inmediato a `eliminarLiquidacion`: primero abre un diálogo de confirmación.
- **AC-5:** Si en el diálogo se pulsa "Cancelar", NO se llama a `eliminarLiquidacion` y el diálogo se cierra.
- **AC-6:** Si en el diálogo se confirma, se llama a `eliminarLiquidacion` (`DELETE /liquidaciones/{anio}/{mes}`) exactamente una vez y, tras el `204`, se navega a `/historial`.
- **AC-7:** El botón "Reabrir" se muestra solo cuando el estado es CERRADA (ausente en BORRADOR); al confirmar su diálogo llama a `reabrirLiquidacion` (`POST .../reapertura`).
- **AC-8:** El calendario del detalle es de solo lectura (las celdas de día no son interactivas / no disparan selección).
- **AC-9 (a11y):** El diálogo de confirmación atrapa el foco y tiene título y descripción accesibles; las acciones tienen nombres claros ("Eliminar"/"Cancelar").
- **AC-10:** Ante un fallo inesperado al cargar (500), muestra mensaje de error amable + toast, sin esqueleto infinito.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Carga `409 MES_FUERA_DE_CONTRATO` → mensaje amable, sin panel de desglose ni acciones destructivas.
- **EC-2:** `eliminarLiquidacion` falla (404) → toast de error y permanece en la página (no navega).
- **EC-3:** Un mes en BORRADOR no ofrece "Reabrir" pero sí "Eliminar".
- **EC-4:** Total `0` se formatea como `$ 0` sin romper.

## Superficie de Código Existente (para el implementer)
- Llama a:
  - `apiClient.GET("/liquidaciones/{anio}/{mes}", { params: { path: { anio, mes } } })` → `{ data?: Liquidacion; error?: unknown }`.
  - `apiClient.DELETE("/liquidaciones/{anio}/{mes}", { params: { path: { anio, mes } } })` → `{ error?: unknown }` (204 sin cuerpo).
  - `apiClient.POST("/liquidaciones/{anio}/{mes}/reapertura", { params: { path: { anio, mes } } })` → `{ data?: Liquidacion; error?: unknown }`.
  - Patrón de lectura del `code` de error de negocio: `codigoDeError(error)` (ver `use-liquidacion.ts`).
- Navegación tras eliminar: `useRouter().push("/historial")` de `next/navigation`.
- Reusa tal cual (de Epic 8.3 / DS):
  - `DesglosePanel` (`src/app/(employer)/liquidar/desglose-panel.tsx`, prop `desglose: Desglose`) — exportar/importar; si no es práctico importar desde `liquidar/`, mover/duplicar mínimamente NO está permitido: **importar el existente**.
  - `MonthCalendar` (`@/components/domain/MonthCalendar`, props `anio`, `mes`, `dias`, `onSelectDay?`) — en modo lectura se omite `onSelectDay` (no interactivo).
  - `Badge` (`@/components/ui/Badge`), `Button` (`@/components/ui/Button`, variantes incl. "danger"/"secondary"/"ghost"), `Dialog, DialogTitle, DialogDescription, DialogFooter, DialogOverlay` (`@/components/ui/Dialog`), `Card…` (`@/components/ui/Card`), `Skeleton` (`@/components/ui/Skeleton`), `CurrencyDisplay`.
  - Patrón de diálogo de confirmación sin botón X: ver `ciclo-vida-acciones.tsx` (`ConfirmDialogContent`).
  - `toast` de `sonner`.
- Tipos: `components["schemas"]["Liquidacion"]`, `["Desglose"]`, `["DiaCalendario"]`, `["EstadoLiquidacion"]` en `@/lib/api/schema`.
- Crea: `src/app/(employer)/historial/[anio]/[mes]/page.tsx` (server component que pasa `anio`/`mes` de los params), `src/app/(employer)/historial/[anio]/[mes]/detalle-mes-section.tsx` (`"use client"`), una hook de datos opcional `use-detalle-mes.ts`, las acciones de detalle (eliminar/reabrir con diálogo) y `detalle-mes-section.test.tsx` (RED).
- Fixtures: mock `fetch` vía `vi.stubGlobal`; `next/navigation` `useRouter` mockeado; RTL + `userEvent`. No levantar servidor.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
