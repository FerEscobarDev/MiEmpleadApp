# SPEC: Pestaña Tareas (checklist marcable) — id: epic-8.7-consulta-empleada/tareas-tab

**Epic:** Epic 8.7 (ROADMAP Milestone 8)   **Módulo:** architecture.md §2.1 (cliente tipado), §2.2 (frontera tareas), §2.6 (marcarTarea: única escritura de la empleada)

## Objetivo
Implementar el cuerpo de la pestaña **Tareas** de la vista de consulta: cargar las tareas del día (`obtenerTareasDelDia(hoy)`) y mostrarlas en un TaskChecklist con casillas **marcables**; marcar/desmarcar persiste vía `marcarTarea` con actualización **optimista** y reversión en error. Es la única escritura permitida a la empleada (RN-13). Toda la I/O usa el cliente de consulta que inyecta `X-Acceso-Token` (spec A).

## Fuera de Scope (NO testear, NO implementar)
- Pestañas Pago y Menú (spec B), shell y validación de token (spec A).
- Edición de la rutina de tareas (eso es del empleador, `/tareas`); aquí solo se marca el cumplimiento del día.
- Histórico de cumplimiento (es vista del empleador, HU-26).
- Selector de fecha: la consulta de la empleada marca las tareas de HOY; no se ofrece navegación a otras fechas (la fecha "hoy" sí es inyectable para testabilidad).

## Operaciones del Contrato de API
> Referencia por `operationId`. El contrato es la fuente de verdad.
- **Consume** (frontend, vía cliente tipado con header `X-Acceso-Token`, NUNCA URL a mano):
  - `obtenerTareasDelDia` — `GET /tareas/dia?fecha=YYYY-MM-DD`.
  - `marcarTarea` — `PUT /tareas/cumplimiento` con body `{ fecha, rutinaTareaId, hecha }`.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `fecha`: string YYYY-MM-DD (hoy, zona local). Toggle: `rutinaTareaId`:string, `hecha`:boolean |
| Salidas (éxito) | `obtenerTareasDelDia` → `TareaDelDia[] { rutinaTareaId, descripcion, horaInicio?, horaFin?, hecha }`. `marcarTarea` → `CumplimientoTarea { fecha, rutinaTareaId, descripcion, hecha }` (200) |
| Salidas (error) | `marcarTarea` 4xx/5xx → revertir el toggle optimista + toast de error. `obtenerTareasDelDia` 5xx → mensaje amable de error de carga. |
| Efectos secundarios | `marcarTarea` persiste el cumplimiento (histórico por fecha) en el backend. |
| Idempotencia | `marcarTarea` es idempotente por (fecha, rutinaTareaId): reenviar el mismo `hecha` deja el mismo estado. |

## Reglas de Negocio
- **BR-1 (RN-13):** Marcar tareas es la ÚNICA escritura permitida a la empleada; ninguna otra acción de escritura aparece en la pestaña. — fuente: business_requirements.md §RN-13.
- **BR-2 (HU-24):** Se muestra el checklist de tareas del día. — fuente: business_requirements.md HU-24.
- **BR-3 (HU-25):** La empleada puede marcar tareas como completadas. — fuente: business_requirements.md HU-25.
- **BR-4 (RN-17):** La fecha "hoy" se calcula en zona local (Colombia), sin desfase por `toISOString` UTC. — fuente: business_requirements.md §RN-17, conventions.md §9.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar la pestaña Tareas, llama a `obtenerTareasDelDia` con la fecha de hoy (query `fecha=YYYY-MM-DD`) enviando el header `X-Acceso-Token`.
- **AC-2:** Tras cargar, renderiza las tareas como casillas marcables (role `checkbox`), respetando el estado `hecha` inicial.
- **AC-3:** Marcar una tarea llama a `marcarTarea` (PUT `/tareas/cumplimiento`) con body `{ fecha, rutinaTareaId, hecha }`, enviando el header `X-Acceso-Token`, y la casilla conmuta de inmediato (optimista).
- **AC-4:** Si `marcarTarea` falla (4xx/5xx), el estado de la casilla se revierte al previo y se muestra un toast de error.
- **AC-5:** Un día sin tareas muestra un EmptyState (no una lista vacía).
- **AC-6:** Muestra estado de carga (Skeleton) mientras espera y un mensaje amable si la carga falla (sin Skeleton infinito).
- **AC-7 (a11y):** Las casillas tienen etiqueta accesible (descripción de la tarea); el checklist es navegable por teclado (provisto por el componente DS Checkbox).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Marcar y luego desmarcar produce dos llamadas a `marcarTarea` con `hecha:true` y luego `hecha:false`.
- **EC-2:** Una tarea ya marcada al cargar aparece marcada; desmarcarla envía `hecha:false`.
- **EC-3:** La fecha de hoy se calcula localmente (no `toISOString`): a las 23:00 hora Colombia, la `fecha` enviada es la del día local, no la del día UTC siguiente.

## Superficie de Código Existente (para el implementer)
- Cliente de consulta con header inyectado: el wrapper/contexto del spec A (consulta-client). Reusarlo; NO crear otro cliente ni URLs a mano.
- Tipos del contrato: `components["schemas"]["TareaDelDia"]`, `["MarcarTareaInput"]`, `["CumplimientoTarea"]` en `@/lib/api/schema`.
- Componente DS a reusar: `TaskChecklist` en `@/components/domain/TaskChecklist` — firma: `TaskChecklist({ tareas: TareaDelDia[], editable?:boolean, onToggle?:(rutinaTareaId:string, hecha:boolean)=>void, className? })`. En consulta `editable` = true.
- `Skeleton` (`@/components/ui/Skeleton`), `EmptyState` (`@/components/ui/EmptyState`).
- Helper de fecha local: replicar `fechaLocalISO(d = new Date())` (formato YYYY-MM-DD sin desfase TZ) — patrón en `src/app/(employer)/tareas/use-tareas.ts`. La fecha "hoy" debe poder inyectarse en el componente para testabilidad (conventions.md §3/§7).
- Patrón de marcado optimista con reversión: `src/app/(employer)/tareas/checklist-section.tsx` (referencia de estilo; aquí la diferencia es que la I/O pasa por el cliente de consulta con header, y no hay selector de fecha).
- Fixtures de test: mock de `fetch` con `vi.stubGlobal` y captura de `init.body` como `ArrayBuffer` — ver `src/app/(employer)/tareas/checklist-section.test.tsx`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
