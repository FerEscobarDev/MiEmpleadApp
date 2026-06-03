# SPEC: Checklist del día e histórico de cumplimiento — id: epic-8.6-tareas/checklist-historico

**Epic:** Epic 8.6 — Tareas del día y rutina (ROADMAP.md, Milestone 8)
**Módulo:** Feature `tareas` (UI) dentro del grupo protegido `(employer)` (architecture.md §2.1 — frontera de UI vía cliente tipado)

## Objetivo
En la página `/tareas`, ofrecer dos vistas: (1) el **checklist del día** — un selector de fecha (por defecto hoy) que carga las tareas de esa fecha y permite marcarlas como hechas/pendientes con actualización optimista; y (2) el **histórico** — un selector de rango (desde/hasta) que muestra el cumplimiento de tareas por fecha.

## Fuera de Scope (NO testear, NO implementar)
- El editor de rutina (va en el spec `rutina-editor`).
- La página contenedora `/tareas` y su navegación/shell (ya existe el grupo `(employer)`); aquí solo las **secciones** checklist e histórico que la página compone.
- Lógica de negocio de cumplimiento en el backend (Epic 6.2).
- Cálculo de zona horaria avanzado: la fecha "hoy" se toma del cliente en formato `YYYY-MM-DD`; no se reimplanta el manejo de America/Bogota aquí (el backend es la fuente de verdad de fechas persistidas).
- Estilos/pixeles (los certifica la aprobación visual del Design System, ya aprobado en Epic 7.1).

## Operaciones del Contrato de API
> Referencia por `operationId` de `docs/02-architecture/api-contract.md`. El contrato es la fuente de verdad. Consumo SOLO vía el cliente tipado (`src/lib/api/client.ts`), nunca URL escrita a mano.
- **Consume** (frontend): `obtenerTareasDelDia` (GET /tareas/dia?fecha=), `marcarTarea` (PUT /tareas/cumplimiento), `obtenerHistoricoTareas` (GET /tareas/historico?desde=&hasta=).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas (checklist) | `fecha` (string `YYYY-MM-DD`) → `obtenerTareasDelDia` → `TareaDelDia[]` |
| Entradas (marcar) | `MarcarTareaInput{fecha,rutinaTareaId,hecha}` → `marcarTarea` → `CumplimientoTarea` |
| Entradas (histórico) | `desde`, `hasta` (string `YYYY-MM-DD`) → `obtenerHistoricoTareas` → `CumplimientoTarea[]` |
| Salidas (éxito) | checklist: lista marcable; marcar: estado conmutado; histórico: cumplimientos agrupados por fecha |
| Salidas (error) | carga 4xx/5xx → estado de error amable + toast; marcar falla → **revertir** el toggle optimista + toast |
| Efectos secundarios | `marcarTarea` persiste el cumplimiento (histórico por fecha) en el backend |
| Idempotencia | `marcarTarea` idempotente por `(fecha, rutinaTareaId, hecha)`; reenviar el mismo estado no cambia nada |

DTOs (del contrato, no redefinir):
`TareaDelDia{rutinaTareaId,descripcion,horaInicio?,horaFin?,hecha}`,
`MarcarTareaInput{fecha,rutinaTareaId,hecha}`,
`CumplimientoTarea{fecha,rutinaTareaId,descripcion,hecha}`.

## Reglas de Negocio
- **BR-1:** Marcar "completada" se guarda como **histórico por fecha** y es visible para el empleador — fuente: business_requirements.md RN-15, HU-25/HU-26.
- **BR-2:** El checklist del día y el histórico se consultan por fecha/rango — fuente: HU-24, HU-26, RN-15.
- **BR-3:** El empleador puede marcar/consultar (la sección vive en el grupo `(employer)`, ya protegido) — fuente: RN-13 (la empleada también puede marcar, pero su vista vive en otra ruta fuera de scope).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar, el checklist llama a `obtenerTareasDelDia` con la fecha de hoy (`YYYY-MM-DD`) por defecto.
- **AC-2:** Cambiar la fecha del selector vuelve a llamar a `obtenerTareasDelDia` con la nueva fecha.
- **AC-3:** Mientras carga el checklist muestra estado de carga (Skeleton) y no la lista.
- **AC-4:** Tras cargar, renderiza las tareas del día como casillas marcables (reutilizando el componente de Design System `TaskChecklist`), respetando el orden recibido y mostrando el horario cuando exista.
- **AC-5:** Marcar una tarea llama a `marcarTarea` (PUT /tareas/cumplimiento) con `{fecha, rutinaTareaId, hecha}` correctos y conmuta el estado visible de la casilla (optimista) de inmediato.
- **AC-6:** Si `marcarTarea` falla, el estado de la casilla **se revierte** al valor previo y se muestra toast de error.
- **AC-7:** Día sin tareas (lista vacía) muestra un EmptyState con mensaje guía, no una lista vacía.
- **AC-8:** El histórico llama a `obtenerHistoricoTareas` con `desde`/`hasta` y renderiza los cumplimientos **agrupados por fecha**, indicando por cada uno si está hecho o pendiente.
- **AC-9:** Cambiar el rango (desde/hasta) del histórico vuelve a llamar a `obtenerHistoricoTareas` con los nuevos parámetros.
- **AC-10:** Histórico vacío en el rango muestra un EmptyState con mensaje guía.
- **AC-11 (a11y):** El selector de fecha y los de rango tienen etiqueta accesible; las casillas del checklist tienen etiqueta (la descripción); las dos vistas (Hoy / Histórico) son navegables por teclado; encabezados de sección presentes.
- **AC-12:** Fallo de carga del checklist (4xx/5xx) muestra mensaje amable + toast y no deja Skeleton infinito.
- **AC-13:** Fallo de carga del histórico (4xx/5xx) muestra mensaje amable + toast.

## Edge Cases (los que cambian comportamiento)
- **EC-1:** Marcar y desmarcar la misma tarea → dos llamadas a `marcarTarea` con `hecha:true` luego `hecha:false`; el estado visible sigue cada conmutación.
- **EC-2:** Tarea ya marcada al cargar (`hecha:true`) → la casilla aparece marcada; al desmarcarla envía `hecha:false`.
- **EC-3:** Rango histórico con `desde` posterior a `hasta` → se envía igual al backend (la validación de rango es del backend); la UI no debe romperse.
- **EC-4:** Varias fechas en el histórico → se agrupan por fecha en secciones separadas, ordenadas de forma estable.

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient.GET("/tareas/dia", { params: { query: { fecha } } })`, `apiClient.PUT("/tareas/cumplimiento", { body })`, `apiClient.GET("/tareas/historico", { params: { query: { desde, hasta } } })` en `src/lib/api/client.ts`.
- Tipos: `components["schemas"]["TareaDelDia"]`, `["MarcarTareaInput"]`, `["CumplimientoTarea"]` en `src/lib/api/schema.d.ts`.
- Reutiliza DS: `TaskChecklist` (`@/components/domain/TaskChecklist`) — props `{ tareas: TareaDelDia[]; editable?: boolean; onToggle?: (rutinaTareaId, hecha) => void }`; `Tabs/TabsList/TabsTrigger/TabsContent` (`@/components/ui/Tabs`); `Input` (`@/components/ui/Input`, `type="date"`); `Skeleton`, `EmptyState`, `Card`, `cn`, `toast` de `sonner`.
- Patrón de referencia: `src/app/(employer)/menu/plantilla-menu-section.tsx` y `configuracion-menu-section.tsx` (carga + estados + cliente tipado, a11y, fetch mockeado en test).
- Crea: `src/app/(employer)/tareas/checklist-section.tsx`, `src/app/(employer)/tareas/historico-section.tsx` (o una sección con Tabs Hoy/Histórico), y la página `src/app/(employer)/tareas/page.tsx` que compone rutina + checklist + histórico. Puede reutilizar `use-tareas.ts` del otro spec si existe.
- Fixtures disponibles: replicar el patrón `installFetch`/`jsonResponse` de `configuracion-menu-section.test.tsx`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
