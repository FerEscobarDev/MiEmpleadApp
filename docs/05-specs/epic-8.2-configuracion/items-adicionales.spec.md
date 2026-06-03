# SPEC: CRUD de items de pago adicional — id: epic-8.2-configuracion/items-adicionales

**Epic:** Epic 8.2 (Configuración) — ROADMAP Milestone 8   **Módulo:** architecture.md §2.1 Capa de Presentación (UI)

## Objetivo

Permitir al empleador, dentro de `/configuracion`, gestionar la lista de **items de pago adicional**: ver los existentes, **crear**, **editar** y **eliminar** items con nombre, valor unitario (COP), color y estado activo. Consume las cuatro operaciones CRUD del contrato vía el cliente tipado.

## Fuera de Scope (NO testear, NO implementar)

- Ficha de la empleada, salario y días laborales (spec `ficha-y-configuracion`).
- Enlace de acceso (spec `enlace-acceso`).
- Uso de los items en la liquidación (Epic 8.3) — aquí solo se configuran.
- Validación Zod del backend (solo se consume y se superficie el 422).
- Persistencia / handlers / Server Actions.

## Operaciones del Contrato de API

> Consumidas EXCLUSIVAMENTE vía `apiClient`, nunca URLs a mano.

- **Consume** (frontend): `listarItemsAdicionales` (GET `/items-adicionales`), `crearItemAdicional` (POST `/items-adicionales`), `actualizarItemAdicional` (PUT `/items-adicionales/{id}`), `eliminarItemAdicional` (DELETE `/items-adicionales/{id}`).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Crear/editar: `ItemAdicionalInput` = `{ nombre: string, valorUnitario: integer (COP), color?: string \| null, activo: boolean (default true) }`. Editar/eliminar requieren el `id` del item en el path. |
| Salidas (éxito) | `listarItemsAdicionales`→200 `ItemAdicional[]` (`{ id, nombre, valorUnitario, color?, activo }`); `crearItemAdicional`→201 `ItemAdicional`; `actualizarItemAdicional`→200 `ItemAdicional`; `eliminarItemAdicional`→204. |
| Salidas (error) | 422 → entrada inválida → Toast de error; 404 → item inexistente (al editar/eliminar) → Toast de error; otros/red → Toast genérico. |
| Efectos secundarios | Tras una operación exitosa la lista se refresca para reflejar el estado actual del servidor. |
| Idempotencia | `crearItemAdicional` NO idempotente; `actualizarItemAdicional` y `eliminarItemAdicional` idempotentes. |

## Reglas de Negocio

- **BR-1 (RN-08):** los items de pago adicional tienen un **valor unitario** (COP entero) que luego se multiplica por cantidad en la liquidación; aquí solo se configuran nombre, valor, color y activo. — fuente: business_requirements.md RN-08.
- **BR-2 (RN-16):** el valor unitario se maneja en **COP enteros sin decimales**; el formateo de moneda usa `formatCOP`/`CurrencyDisplay` (un único formateador). — fuente: RN-16.
- **BR-3 (RN-07/HU-07):** un item tiene un estado **activo** (default `true`); puede crearse, editarse y eliminarse. — fuente: HU-07.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** al montar, se cargan los items vía `listarItemsAdicionales` (GET `/items-adicionales`) y se renderiza la lista (nombre + valor formateado en COP + estado activo/inactivo).
- **AC-2:** mientras la carga está pendiente se muestra un estado de carga (Skeleton).
- **AC-3:** si la lista está vacía se muestra un **estado vacío** (EmptyState) con una acción para agregar el primer item.
- **AC-4:** crear un item (completar nombre + valor y confirmar) invoca `crearItemAdicional` (POST `/items-adicionales`) **una vez** con un `ItemAdicionalInput` que incluye el `nombre` y el `valorUnitario` capturados.
- **AC-5:** editar un item existente invoca `actualizarItemAdicional` (PUT `/items-adicionales/{id}`) **una vez** con el `id` correcto en la URL y los valores editados en el body.
- **AC-6:** eliminar un item invoca `eliminarItemAdicional` (DELETE `/items-adicionales/{id}`) **una vez** con el `id` correcto en la URL.
- **AC-7:** tras una operación exitosa (crear/editar/eliminar) la lista se vuelve a pedir (`listarItemsAdicionales`) o se actualiza para reflejar el cambio.
- **AC-8:** un 422 al crear/editar muestra un Toast de error y mantiene el formulario abierto con los datos ingresados.
- **AC-9 (a11y):** el botón de agregar, los controles de editar y el de eliminar de cada item tienen nombre accesible; los campos del editor tienen label asociado; el valor se ingresa con un campo numérico/moneda accesible.

## Edge Cases

- **EC-1:** `listarItemsAdicionales` falla (red/500) → estado de error legible (Toast/mensaje), no Skeleton infinito.
- **EC-2:** eliminar el único item → la lista queda vacía y vuelve a mostrarse el EmptyState.
- **EC-3:** crear con valor unitario no válido (ej. vacío/0 si el backend lo rechaza) → el backend responde 422 → Toast de error; el item no se agrega a la lista local hasta confirmarse en el servidor.

## Superficie de Código Existente (para el implementer)

- Cliente tipado: `apiClient` (`src/lib/api/client.ts`) — `apiClient.GET("/items-adicionales")`, `apiClient.POST("/items-adicionales", { body })`, `apiClient.PUT("/items-adicionales/{id}", { params: { path: { id } }, body })`, `apiClient.DELETE("/items-adicionales/{id}", { params: { path: { id } } })`. Tipos: `components["schemas"]["ItemAdicional"]`, `["ItemAdicionalInput"]` en `src/lib/api/schema.d.ts`.
- Dominio: `ItemAdicionalEditor` (`src/components/domain/ItemAdicionalEditor.tsx`) — shell presentacional por props: `items: ItemAdicional[]`, `onCreate?`, `onEdit?(id)`, `onDelete?(id)`. Su interfaz `ItemAdicional` = `{ id, nombre, valorUnitario, color?, activo }`. Emite intenciones; el contenedor las cablea al cliente tipado.
- UI: `Input` (con `currency`), `Button`, `Dialog`/`DialogContent`/`DialogTitle`/`DialogFooter`/`DialogClose` (`src/components/ui/Dialog.tsx`) para el editor de crear/editar, `Switch` para `activo`, `EmptyState` (`src/components/ui/EmptyState.tsx`), `Skeleton`, `CurrencyDisplay`/`formatCOP`.
- Toast: `toast.success` / `toast.error` de `sonner` (Toaster ya montado en el layout raíz).
- Crea: componente contenedor cliente `src/app/(employer)/configuracion/items-adicionales-section.tsx` (consumido por `configuracion/page.tsx`). Tests co-localizados `*.test.tsx`.
- Patrón de test de referencia: `src/app/login/login-form.test.tsx` (mock de `fetch` global).
- Fixtures: ninguno específico; los tests mockean `fetch`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
