# SPEC: Historial — Listado de meses liquidados — id: epic-8.4-historial/listado-meses

**Epic:** Epic 8.4 (Historial de liquidaciones) — ROADMAP Milestone 8   **Módulo:** frontend `(employer)` / feature `liquidacion` (architecture.md §UI; navigation_map.md §`/historial`)

## Objetivo
Construir la página `/historial` del empleador: un listado de los meses ya registrados (mes-año, estado y total), ordenado del más reciente al más antiguo, donde cada fila enlaza al detalle del mes. Si no hay meses, se muestra un estado vacío guía. Mientras carga, se muestra un esqueleto. Todo el consumo del backend ocurre exclusivamente por el cliente tipado.

## Fuera de Scope (NO testear, NO implementar)
- El detalle del mes (`/historial/[anio]/[mes]`): es el otro spec del epic.
- Eliminar / reabrir liquidaciones (viven en el detalle).
- El cálculo de la liquidación o del total (lo provee el backend; la UI solo renderiza).
- El shell `(employer)`, el guard de sesión, la navegación inferior/lateral (ya existen del Epic 8.1).
- Paginación o filtros del historial (el contrato devuelve la lista completa).

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado generado, nunca URL a mano): `listarLiquidaciones` — `GET /liquidaciones` → `LiquidacionResumen[]`.
- DTO `LiquidacionResumen`: `{ anio: integer, mes: integer (1-12), estado: EstadoLiquidacion ("BORRADOR"|"CERRADA"), total: integer (COP entero) }`.

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Ninguna (GET sin parámetros). |
| Salidas (éxito) | `200` con `LiquidacionResumen[]`. La sección renderiza una fila por elemento. |
| Salidas (error) | `401` Unauthorized (lo maneja el guard/shell, no esta sección); cualquier otro fallo de red/servidor → estado de error con mensaje amable + toast. |
| Efectos secundarios | Ninguno (solo lectura). |
| Idempotencia | Sí (GET). Re-render no muta nada. |

## Reglas de Negocio
- **BR-1:** El historial muestra **todos** los meses liquidados/registrados — fuente: business_requirements.md HU-17.
- **BR-2:** Cada mes se identifica por su combinación mes+año (una sola liquidación por mes+año) — fuente: RN-10.
- **BR-3:** El estado se muestra como Badge textual (Borrador/Cerrada), nunca solo color — fuente: design_system.md §3 Badge, §6 accesibilidad.
- **BR-4:** Los montos se muestran en COP sin decimales mediante el único formateador de moneda — fuente: RN-16, design_system.md §4 CurrencyDisplay.
- **BR-5:** Solo el empleador accede a esta página (vive en el grupo protegido `(employer)`) — fuente: RN-13.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar, la sección llama a `listarLiquidaciones` (`GET /liquidaciones`) una vez.
- **AC-2:** Mientras la petición está pendiente, muestra un esqueleto de carga (Skeleton) y no la tabla ni el estado vacío.
- **AC-3:** Con datos, renderiza una fila por mes con: el nombre de mes y año legible (ej. "Mayo 2026"), el estado como Badge ("Borrador"/"Cerrada") y el total formateado en COP.
- **AC-4:** Las filas se ordenan de la más reciente a la más antigua (por año desc, luego mes desc), independientemente del orden recibido del backend.
- **AC-5:** Cada fila enlaza al detalle del mes (`/historial/{anio}/{mes}`) mediante un enlace navegable (rol link con href correcto).
- **AC-6:** Cuando la lista está vacía (`[]`), muestra un EmptyState con mensaje guía (no la tabla) y no rompe.
- **AC-7:** Ante un error inesperado del backend (ej. 500), muestra un mensaje de error amable y dispara un toast de error; no queda en esqueleto infinito.
- **AC-8 (a11y):** El listado expone semántica de tabla accesible (rol table con encabezados de columna) o, en su defecto, una lista accesible; el estado de carga tiene una etiqueta accesible.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Total `0` se muestra como `$ 0` sin romper el formateo.
- **EC-2:** Un mes en estado `BORRADOR` se lista igual que uno `CERRADA`, con su badge correspondiente.
- **EC-3:** Respuesta con un solo elemento renderiza exactamente una fila.

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient.GET("/liquidaciones")` en `@/lib/api/client` — devuelve `{ data?: LiquidacionResumen[]; error?: unknown }` (patrón openapi-fetch; ver `use-liquidacion.ts`).
- Tipo: `components["schemas"]["LiquidacionResumen"]` en `@/lib/api/schema`.
- Reusa: `CurrencyDisplay` (`@/components/domain/CurrencyDisplay`, prop `amount: number`); `Badge` (`@/components/ui/Badge`, prop `variant`: "success"|"neutral"…, children texto); `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` (`@/components/ui/Table`); `EmptyState` (`@/components/ui/EmptyState`, props `title`, `description`, `action?`); `Skeleton` (`@/components/ui/Skeleton`); `Card, CardContent, CardHeader, CardTitle` (`@/components/ui/Card`).
- Navegación: `next/link` (`Link`) para los enlaces al detalle; `toast` de `sonner` para errores.
- Patrón de hook de datos + sección cliente: ver `src/app/(employer)/liquidar/use-liquidacion.ts` y `liquidar-mes-section.tsx` (presentación pura, sin lógica de negocio).
- Crea: `src/app/(employer)/historial/page.tsx` (server component delgado), `src/app/(employer)/historial/historial-section.tsx` (`"use client"`), y `src/app/(employer)/historial/historial-section.test.tsx` (tests RED).
- Fixtures: mock de `fetch` vía `vi.stubGlobal` (ver `liquidar-mes-section.test.tsx`); RTL + `userEvent`. No levantar servidor.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
