# SPEC: Menú — Configuración de comidas y periodicidad — id: epic-8.5-menu/configuracion-menu

**Epic:** ROADMAP Milestone 8 / Epic 8.5 (Menú de cocina)   **Módulo:** architecture.md §Frontend `(employer)` / feature `menu`

## Objetivo

Construir la sección de **configuración** de la página `/menu` (dentro del grupo protegido `(employer)`): cargar el menú vigente con `obtenerMenu`, mostrar y editar las **comidas** del menú (agregar, renombrar, quitar) y la **periodicidad** (Semanal / Quincenal / Mensual), y persistir esos cambios con `actualizarConfiguracionMenu`. El número de semanas del ciclo deriva de la periodicidad (Semanal→1, Quincenal→2, Mensual→4) y debe quedar disponible para que el tablero (Spec plantilla) ofrezca solo semanas y columnas válidas, evitando 422 del backend (Epic 6.1).

## Fuera de Scope (NO testear, NO implementar)

- El tablero MenuBoard editable y la operación `actualizarMenu` (Spec `plantilla-menu`).
- La vista de consulta de la empleada (`(employee)` group) — otro epic.
- Validación de unicidad/duplicados de comidas más allá de lo descrito en EC-3.
- Lógica de negocio del backend (rangos de semana, validación 422): ya la aplica Epic 6.1; aquí solo se respeta del lado cliente.
- Pixel/estética: la calidad visual la valida el humano, no los tests.
- Persistencia/DB y Route Handlers (ya existen).

## Operaciones del Contrato de API

> Referencia por `operationId` de `docs/02-architecture/api-contract.md`. El contrato es la fuente de verdad. Consumo SOLO vía el cliente tipado (`@/lib/api/client`), nunca URL escrita a mano.

- **Consume** (frontend): `obtenerMenu` (GET `/menu` → `Menu`), `actualizarConfiguracionMenu` (PUT `/menu/configuracion`, body `MenuConfig` → `MenuConfig`).

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Estado interno: `comidas: string[]`, `periodicidad: Periodicidad` (`"SEMANAL" \| "QUINCENAL" \| "MENSUAL"`). Carga inicial desde `obtenerMenu` → `Menu.configuracion`. |
| Salidas (éxito) | Al guardar: PUT `actualizarConfiguracionMenu` con body `MenuConfig` `{ comidas, periodicidad }`; respuesta `200 MenuConfig` ⇒ toast de éxito y estado refrescado con la respuesta. |
| Salidas (error) | Fallo de carga (status no-ok o sin datos) ⇒ estado de error con mensaje amable + toast error, sin Skeleton infinito. Fallo de guardado (status no-ok, p.ej. 422/401) ⇒ toast error y se conserva el estado editado (no se descarta lo que el usuario escribió). |
| Efectos secundarios | Persistencia de la configuración del menú vía el backend. Ninguno local más allá del estado React. |
| Idempotencia | `actualizarConfiguracionMenu` es idempotente (PUT, reemplazo total); reintentar con el mismo body produce el mismo resultado. |

## Reglas de Negocio

- **BR-1:** Las comidas del menú son **configurables** por el empleador (agregar / renombrar / quitar). — fuente: business_requirements.md RN-19 (HU-20).
- **BR-2:** La periodicidad define la plantilla repetible: **Semanal** = 1 semana, **Quincenal** = 2 semanas, **Mensual** = 4 semanas del ciclo. — fuente: business_requirements.md RN-14 (HU-21).
- **BR-3:** Solo el rol **empleador** edita el menú; `/menu` vive en el grupo protegido `(employer)` detrás del SessionGuard. — fuente: business_requirements.md RN-13.
- **BR-4:** El número de semanas del ciclo es función pura de la periodicidad: `SEMANAL→1`, `QUINCENAL→2`, `MENSUAL→4`. Este mapeo se expone para que el tablero ofrezca solo semanas válidas (0-based) y evite 422 del backend (Epic 6.1).

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** Al montar, la sección llama a `obtenerMenu` (una vez) vía el cliente tipado (GET a `/menu`).
- **AC-2:** Mientras carga muestra un estado de carga (Skeleton) y no el formulario de configuración.
- **AC-3:** Tras cargar OK, renderiza la lista de comidas configuradas (una entrada editable por comida) y la periodicidad actual seleccionada.
- **AC-4:** Agregar una comida añade un campo/elemento editable nuevo a la lista de comidas (sin llamar todavía al backend).
- **AC-5:** Quitar una comida la elimina de la lista (sin llamar todavía al backend).
- **AC-6:** Cambiar la periodicidad a otro valor (p.ej. de Semanal a Mensual) actualiza la selección visible y expone el número de semanas correspondiente (4 para Mensual).
- **AC-7:** Al guardar la configuración, llama a `actualizarConfiguracionMenu` (PUT `/menu/configuracion`) con un body que contiene exactamente las comidas editadas (sin vacías) y la periodicidad seleccionada; ante `200` muestra toast de éxito.
- **AC-8:** Fallo de carga (status no-ok) muestra mensaje de error amable + toast de error y NO deja el Skeleton infinito.
- **AC-9:** Fallo de guardado (status no-ok) muestra toast de error y conserva en pantalla las comidas/periodicidad que el usuario había editado (no se pierden).
- **AC-10 (a11y):** La periodicidad se elige mediante un control accesible con nombre accesible (grupo etiquetado / opciones con rol y nombre), y cada comida tiene un control de entrada con etiqueta/`aria-label`; los botones de agregar/quitar tienen nombre accesible textual o `aria-label`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** Menú sin comidas configuradas (`comidas: []`) ⇒ la sección permite agregar la primera comida (estado vacío con acción "Agregar comida"); el guardado sigue disponible.
- **EC-2:** Comida con texto en blanco/espacios al guardar ⇒ se excluye del body enviado a `actualizarConfiguracionMenu` (no se envían comidas vacías).
- **EC-3:** Renombrar una comida a un valor no vacío actualiza esa entrada; el body de guardado refleja el nuevo nombre.
- **EC-4:** Reducir la periodicidad (p.ej. Mensual→Semanal) reduce el número de semanas expuesto a 1 (el descarte de entradas inválidas del tablero se cubre en el Spec plantilla).

## Superficie de Código Existente (para el implementer)

- Cliente tipado: `apiClient` en `src/lib/api/client.ts` — firma: `apiClient.GET("/menu")`, `apiClient.PUT("/menu/configuracion", { body })`. Tipos en `src/lib/api/schema.d.ts`: `components["schemas"]["Menu"]`, `["MenuConfig"]`, `["MenuEntrada"]`, `["Periodicidad"]` (`"SEMANAL" | "QUINCENAL" | "MENSUAL"`), `["DiaSemana"]`.
- Cada llamada del cliente retorna `{ data, error, response }` (openapi-fetch). Patrón existente: ver `src/app/(employer)/historial/historial-section.tsx` y `src/app/(employer)/historial/[anio]/[mes]/use-detalle-mes.ts`.
- Toasts: `import { toast } from "sonner"` — `toast.success(msg)`, `toast.error(msg)`.
- Componentes DS disponibles (no recrear): `Button` (`@/components/ui/Button`), `Input` (`@/components/ui/Input`, props `label`, `aria-label`), `Card`/`CardHeader`/`CardTitle`/`CardContent` (`@/components/ui/Card`), `Skeleton` (`@/components/ui/Skeleton`), `EmptyState` (`@/components/ui/EmptyState`, props `title`/`description`/`action`).
- Crea: `src/app/(employer)/menu/configuracion-menu-section.tsx` (componente cliente `"use client"`).
- Crea: `src/app/(employer)/menu/use-menu.ts` — hook compartido que carga el menú (obtenerMenu) y expone `{ estadoCarga, menu, comidas, periodicidad, ... acciones de edición/guardado de config }` para esta sección y la del tablero. Incluye util pura `semanasDePeriodicidad(p: Periodicidad): number` (`SEMANAL→1, QUINCENAL→2, MENSUAL→4`).
- Crea: `src/app/(employer)/menu/page.tsx` — página servidor que compone las secciones (header + configuración + plantilla). El boundary de I/O ocurre solo en las secciones cliente, vía el cliente tipado.
- Fixtures/patrón de test (no duplicar mecánica): `src/app/(employer)/historial/historial-section.test.tsx` muestra el patrón de `installFetch`/`vi.stubGlobal("fetch", ...)` + mock de `sonner`. Reusar ese estilo.
- Nav ya incluye `/menu` (`src/components/shell/EmployerNav.tsx`): no tocar.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
