# SPEC: Editor de rutina de tareas por día — id: epic-8.6-tareas/rutina-editor

**Epic:** Epic 8.6 — Tareas del día y rutina (ROADMAP.md, Milestone 8)
**Módulo:** Feature `tareas` (UI) dentro del grupo protegido `(employer)` (architecture.md §2.1 — frontera de UI vía cliente tipado)

## Objetivo
Permitir al empleador definir la rutina de tareas que se repite cada semana: una sección de la página `/tareas` que carga la rutina actual, la agrupa por día de la semana (Lunes–Domingo) y permite agregar, editar, eliminar y reordenar tareas (descripción + horario opcional hora inicio/fin en HH:mm + orden), guardando el conjunto completo de una sola vez (reemplazo total).

## Fuera de Scope (NO testear, NO implementar)
- El checklist del día y el histórico de cumplimiento (van en el spec `checklist-historico`).
- La página contenedora `/tareas` como tal y su navegación/shell (ya existe el grupo `(employer)` con su nav; aquí solo la **sección** de rutina, que la página compone).
- Lógica de negocio de tareas en el backend (persistencia, validación de servidor): la valida el backend (Epic 6.2).
- Drag-and-drop con librería externa: el reordenado se hace con controles "subir/bajar" accesibles, no con arrastre de puntero.
- Estilos/pixeles (los certifica la aprobación visual del Design System, ya aprobado en Epic 7.1).

## Operaciones del Contrato de API
> Referencia por `operationId` de `docs/02-architecture/api-contract.md`. El contrato es la fuente de verdad. Consumo SOLO vía el cliente tipado (`src/lib/api/client.ts`), nunca URL escrita a mano.
- **Consume** (frontend): `obtenerRutinaTareas` (GET /tareas/rutina), `actualizarRutinaTareas` (PUT /tareas/rutina).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas (carga) | ninguna; `obtenerRutinaTareas` → `RutinaTarea[]` |
| Entradas (guardado) | `RutinaTareaInput[]` = lista completa de tareas de TODOS los días (reemplazo total). Cada item: `diaSemana` (enum LUNES…DOMINGO), `descripcion` (string no vacío), `horaInicio?`/`horaFin?` (HH:mm o ausente), `orden` (entero ≥ 0) |
| Salidas (éxito) | `actualizarRutinaTareas` → 200 con `RutinaTarea[]`; toast de éxito |
| Salidas (error) | carga 4xx/5xx → estado de error amable + toast; guardado 401/422/red → toast de error, conserva lo editado |
| Efectos secundarios | persistencia de la rutina en el backend (vía el handler tipado) |
| Idempotencia | guardado idempotente: el mismo conjunto reenviado produce el mismo estado (reemplazo total) |

DTOs (del contrato, no redefinir):
`RutinaTarea{id,diaSemana,descripcion,horaInicio?,horaFin?,orden}`,
`RutinaTareaInput{diaSemana,descripcion,horaInicio?,horaFin?,orden}`,
`DiaSemana ∈ {LUNES,MARTES,MIERCOLES,JUEVES,VIERNES,SABADO,DOMINGO}`.

## Reglas de Negocio
- **BR-1:** La rutina se define por **día de la semana** y se repite cada semana, con **horarios opcionales** por tarea — fuente: business_requirements.md RN-15, HU-23.
- **BR-2:** Solo el **empleador** edita la rutina (la sección vive dentro del grupo `(employer)`, ya protegido por sesión) — fuente: business_requirements.md RN-13.
- **BR-3:** Los horarios son **opcionales**; cuando se proveen deben ser HH:mm válidos y, si ambos existen, `horaInicio ≤ horaFin`. La validación cliente evita 422 del backend — fuente: RN-15 + guía del epic.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar, la sección llama a `obtenerRutinaTareas` (GET /tareas/rutina) exactamente una vez.
- **AC-2:** Mientras carga muestra estado de carga (Skeleton) y no el editor.
- **AC-3:** Tras cargar, las tareas se agrupan y muestran bajo su día de la semana (encabezados Lunes–Domingo en ese orden); cada tarea muestra su descripción y, si tiene, su horario.
- **AC-4:** Un día sin tareas muestra un EmptyState (mensaje guía) en lugar de una lista vacía, y permite agregar la primera tarea de ese día.
- **AC-5:** Agregar una tarea a un día añade una fila editable nueva en ese día **sin** llamar al backend.
- **AC-6:** Editar la descripción de una tarea se refleja en el estado y, al guardar, en el body enviado.
- **AC-7:** Eliminar una tarea la quita de su día **sin** llamar al backend.
- **AC-8:** Reordenar (subir/bajar) una tarea dentro de un día cambia su posición visible **sin** llamar al backend, y el `orden` enviado al guardar refleja el nuevo orden.
- **AC-9:** Guardar llama a `actualizarRutinaTareas` (PUT /tareas/rutina) **una vez** con un arreglo `RutinaTareaInput[]` que incluye todas las tareas de todos los días, con `diaSemana`, `descripcion`, `orden` y, cuando aplique, `horaInicio`/`horaFin`; muestra toast de éxito.
- **AC-10:** Si una tarea tiene horario inválido (HH:mm mal formado, o `horaInicio > horaFin`), guardar **no** llama al backend, muestra un error/toast y conserva lo editado.
- **AC-11 (a11y):** Cada día es una región/grupo con nombre accesible (encabezado); cada campo de descripción y de hora tiene etiqueta accesible; los botones (agregar/eliminar/subir/bajar/guardar) tienen nombre accesible; operables por teclado.
- **AC-12:** Fallo de carga (4xx/5xx) muestra mensaje amable + toast de error y no deja Skeleton infinito.
- **AC-13:** Fallo de guardado (401/422/red) muestra toast de error y conserva lo editado (no descarta cambios).

## Edge Cases (los que cambian comportamiento)
- **EC-1:** Rutina vacía (sin tareas en ningún día) → cada día muestra su EmptyState; guardar con todo vacío envía `[]`.
- **EC-2:** Descripción en blanco/espacios al guardar → esa tarea se excluye del body (no se persisten tareas sin descripción), sin bloquear el guardado de las demás.
- **EC-3:** Tarea con solo `horaInicio` (sin `horaFin`) o viceversa → se considera válida (horario opcional) y se envía solo el campo provisto; no falla la validación de rango.
- **EC-4:** `orden` se calcula por posición dentro del día al guardar (0,1,2…), independiente del orden de carga.

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient.GET("/tareas/rutina")` y `apiClient.PUT("/tareas/rutina", { body })` en `src/lib/api/client.ts` — firma: `apiClient: ReturnType<typeof createClient<paths>>`; el body de PUT es `components["schemas"]["RutinaTareaInput"][]`.
- Tipos: `components["schemas"]["RutinaTarea"]`, `["RutinaTareaInput"]`, `["DiaSemana"]` en `src/lib/api/schema.d.ts`.
- Reutiliza DS: `Button` (`@/components/ui/Button`), `Input` (`@/components/ui/Input`), `Skeleton` (`@/components/ui/Skeleton`), `EmptyState` (`@/components/ui/EmptyState`), `Card` (`@/components/ui/Card`), `cn` (`@/lib/utils`), `toast` de `sonner`.
- Patrón de referencia (NO duplicar lógica de negocio): `src/app/(employer)/menu/configuracion-menu-section.tsx` (carga + edición de lista + guardado por cliente tipado, estados loading/error/empty, a11y) y su hook `use-menu.ts`.
- Crea: `src/app/(employer)/tareas/rutina-section.tsx` (sección cliente), y opcionalmente `src/app/(employer)/tareas/use-tareas.ts` (hook de carga compartido). El input de hora usa `Input` con `type="time"` (HH:mm nativo) — sin componente nuevo de DS.
- Fixtures disponibles: el patrón de `installFetch`/`jsonResponse` de `configuracion-menu-section.test.tsx` (replicar en el test, no importar).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
