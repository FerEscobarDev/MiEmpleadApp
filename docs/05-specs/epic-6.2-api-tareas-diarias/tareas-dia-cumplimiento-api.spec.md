# SPEC: API Tareas del Día, Cumplimiento e Histórico — id: epic-6.2-api-tareas-diarias/tareas-dia-cumplimiento-api

**Epic:** Epic 6.2 (API Tareas diarias) — ROADMAP Milestone 6   **Módulo:** architecture.md §2.2 (Frontera), §2.3 (Aplicación), §2.4 (Dominio puro: día de la semana), §2.5 (Persistencia)

## Objetivo

Exponer el **checklist de tareas de una fecha** (la rutina del día de la semana de esa fecha, con su estado de cumplimiento), el **marcado de cumplimiento por fecha** (la única escritura permitida a la empleada, RN-13) y el **histórico de cumplimiento por rango de fechas** (solo empleador). El cumplimiento se guarda como histórico por fecha exacta (RN-15); la rutina por día de semana ya existe (spec hermano).

## Fuera de Scope (NO testear, NO implementar)

- `obtenerRutinaTareas` / `actualizarRutinaTareas` (spec hermano `tareas-rutina-api`).
- Reimplementar el cálculo de día de la semana o de fechas: se **reutiliza** `diaSemanaDe` del dominio (`dias-laborales.ts`). NO duplicar lógica de fechas.
- Cualquier UI / pantalla (Milestone 8).
- Notas / privacidad de notas (RN-12 no aplica a tareas).

## Operaciones del Contrato de API

- **Implementa** (spec de backend): `obtenerTareasDelDia` (GET `/api/v1/tareas/dia?fecha=`), `marcarTarea` (PUT `/api/v1/tareas/cumplimiento`), `obtenerHistoricoTareas` (GET `/api/v1/tareas/historico?desde=&hasta=`).
- El contrato (`api-contract.openapi.yaml`) es la fuente de verdad de `TareaDelDia`, `MarcarTareaInput`, `CumplimientoTarea`. NO se redefinen aquí.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | **`obtenerTareasDelDia`**: query `fecha` = `YYYY-MM-DD`. **`marcarTarea`**: body `MarcarTareaInput` `{ fecha: YYYY-MM-DD, rutinaTareaId: string, hecha: boolean }`. **`obtenerHistoricoTareas`**: query `desde`,`hasta` = `YYYY-MM-DD`. |
| Salidas (éxito) | **`obtenerTareasDelDia`** → `200` `TareaDelDia[]`: las tareas de la rutina cuyo `diaSemana` = el día de la semana de `fecha` (zona America/Bogotá), cada una `{ rutinaTareaId, descripcion, horaInicio?, horaFin?, hecha }`, ordenadas por `orden`; `hecha` proviene del `CumplimientoTarea` de esa tarea en esa `fecha` exacta (default `false` si no hay registro). **`marcarTarea`** → `200` `CumplimientoTarea` `{ fecha, rutinaTareaId, descripcion, hecha }`. **`obtenerHistoricoTareas`** → `200` `CumplimientoTarea[]` en el rango `[desde, hasta]` inclusive, ordenados por `(fecha, orden)`. |
| Salidas (error) | `fecha`/`desde`/`hasta` malformada o ausente → `422 VALIDACION`. `desde > hasta` → `422 VALIDACION`. `marcarTarea` body inválido (`fecha` mala, `rutinaTareaId` ausente/no-string, `hecha` no-boolean, JSON roto) → `422 VALIDACION`. `marcarTarea` con `rutinaTareaId` que NO pertenece a la rutina de la empleada del contexto → `404 NO_ENCONTRADO`. `marcarTarea` SIN identidad válida (ni sesión empleador ni token de empleada válido) → `401 NO_AUTORIZADO`. `obtenerHistoricoTareas` con token de empleada (rol empleada) → `403 NO_AUTORIZADO` (RN-13, solo empleador). Fallo inesperado → `500`. |
| Efectos secundarios | **`obtenerTareasDelDia`**, **`obtenerHistoricoTareas`**: ninguno. **`marcarTarea`**: **upsert** del `CumplimientoTarea` de `(rutinaTareaId, fecha)` con el valor `hecha`. |
| Idempotencia | **GET** sí. **`marcarTarea`** sí: marcar dos veces el mismo `(rutinaTareaId, fecha, hecha)` deja un único registro con ese estado; volver a marcar con `hecha` distinto **alterna** el estado (no crea duplicado). |

## Reglas de Negocio

- **BR-1 (RN-15):** la rutina es **por día de la semana y se repite**; el cumplimiento se guarda como **histórico por fecha exacta** y es visible para el empleador — fuente: business_requirements.md §Reglas (RN-15). `obtenerTareasDelDia` proyecta la rutina del día-de-semana de la fecha; `marcarTarea` escribe el registro datado; `obtenerHistoricoTareas` lee los registros datados de un rango.
- **BR-2 (RN-13):** la **empleada** SOLO puede leer, **excepto marcar tareas**: `marcarTarea` es su **única** escritura permitida — fuente: business_requirements.md §Reglas (RN-13). Por eso `marcarTarea` acepta **ambos** roles (sesión empleador O token de empleada), mientras `obtenerHistoricoTareas` es **solo empleador**. `obtenerTareasDelDia` lo leen ambos roles.
- **BR-3:** una empleada solo puede marcar tareas de **su propia** rutina: si el `rutinaTareaId` no pertenece a la empleada resuelta del contexto, `marcarTarea` responde `404` (no se filtra que exista para otra empleada).
- **BR-4 (RN-17):** el mapeo `fecha → día de la semana` se calcula de forma **TZ-safe** (sobre los componentes de la cadena `YYYY-MM-DD`, no sobre el parsing local de `Date`), zona America/Bogotá, reutilizando `diaSemanaDe` del dominio.
- **BR-5:** `marcarTarea` requiere una **identidad válida** (empleador o empleada); sin identidad → `401`. NO se usa `rechazarSiNoEmpleador` aquí (eso bloquearía a la empleada, que SÍ puede marcar).

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `GET /tareas/dia?fecha=F` devuelve `200` con las tareas de la rutina cuyo `diaSemana` coincide con el día de la semana de `F`, en el shape `TareaDelDia`, ordenadas por `orden`; las tareas de otros días NO aparecen.
- **AC-2:** sin registro de cumplimiento para esa fecha, cada `TareaDelDia.hecha` es `false` (default).
- **AC-3:** tras `marcarTarea` con `hecha=true` para una tarea en `F`, `GET /tareas/dia?fecha=F` devuelve esa tarea con `hecha=true`; otras fechas de la misma tarea siguen en `false` (el cumplimiento es por fecha exacta, BR-1).
- **AC-4:** `GET /tareas/dia` con token de empleada válido responde `200` (lectura permitida a ambos roles, BR-2).
- **AC-5:** `GET /tareas/dia` con `fecha` malformada (ej. `2026-13-40`, `"hoy"`) o ausente responde `422 VALIDACION`.
- **AC-6:** `PUT /tareas/cumplimiento` con `MarcarTareaInput` válido responde `200` con un `CumplimientoTarea` (`{ fecha, rutinaTareaId, descripcion, hecha }`) y persiste el registro.
- **AC-7 (BR-2):** `marcarTarea` lo puede ejecutar **una sesión de empleador** (sin token) → `200`, **y también** un **token de empleada válido** → `200`. (Dos asserts: ambos roles pueden marcar.)
- **AC-8 (BR-3):** `marcarTarea` con un `rutinaTareaId` que NO pertenece a la empleada del contexto (pertenece a otra empleada, o no existe) responde `404 NO_ENCONTRADO` y no crea registro.
- **AC-9 (BR-5):** `marcarTarea` SIN identidad válida (sin sesión y con token inválido/ausente) responde `401 NO_AUTORIZADO`.
- **AC-10:** `marcarTarea` es idempotente/alternable: marcar `true` dos veces deja un único registro `true`; marcar luego `false` deja un único registro `false` (sin duplicar; conteo en base = 1 para ese par).
- **AC-11:** `GET /tareas/historico?desde=D&hasta=H` (empleador) devuelve `200` con los `CumplimientoTarea` cuyas fechas caen en `[D, H]` inclusive, ordenados; los de fuera del rango NO aparecen.
- **AC-12 (BR-2/RN-13):** `GET /tareas/historico` con token de empleada responde `403 NO_AUTORIZADO`.
- **AC-13:** `GET /tareas/historico` con `desde`/`hasta` malformada o ausente, o con `desde > hasta`, responde `422 VALIDACION`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** `marcarTarea` con `fecha` malformada → `422 VALIDACION`.
- **EC-2:** `marcarTarea` con `hecha` no booleano o `rutinaTareaId` ausente → `422 VALIDACION`.
- **EC-3:** `marcarTarea` con JSON malformado → `422 VALIDACION` (no `500`).
- **EC-4:** `GET /tareas/dia` para una fecha cuyo día de la semana no tiene tareas en la rutina → `200` con `[]`.
- **EC-5:** `obtenerHistoricoTareas` con `desde == hasta` (rango de un día) → `200` con los cumplimientos de esa fecha.
- **EC-6:** un `CumplimientoTarea` de una tarea de **otra** empleada NO aparece en el histórico de la empleada del contexto (aislamiento por empleada).

## Superficie de Código Existente (para el implementer)

- **Frontera (crear):**
  - `src/app/api/v1/tareas/dia/route.ts` con `GET(request: Request)` — lee `fecha` de `new URL(request.url).searchParams`, valida con Zod (formato `YYYY-MM-DD`), resuelve empleada por la costura, delega. Lectura ambos roles (no aplica guard de escritura).
  - `src/app/api/v1/tareas/cumplimiento/route.ts` con `PUT(request: Request)` — NO usa `rechazarSiNoEmpleador`. Usa `resolverRol(request)` para obtener la identidad y la `empleadaId`; si es `null` → `401 NO_AUTORIZADO`. Valida body con Zod. Delega en el servicio con la `empleadaId` del contexto (para el chequeo de pertenencia, BR-3).
  - `src/app/api/v1/tareas/historico/route.ts` con `GET(request: Request)` — solo empleador: usa `resolverRol(request)`; si `null` → `401`; si rol ≠ EMPLEADOR → `403 NO_AUTORIZADO` (RN-13). Lee `desde`/`hasta`, valida formato + `desde ≤ hasta` (Zod o chequeo explícito → `422`).
  - NO usar primer parámetro opcional en Route Handlers (siempre `request: Request`).
- Llama a: `resolverRol(request)` en `src/features/auth/authorize.ts` — firma: `(request: Request) => Promise<ContextoRol | null>` donde `ContextoRol = { rol: "EMPLEADOR"|"EMPLEADA", empleadaId: string }`. Devuelve `null` si no hay identidad válida (→ `401`). Usar `esEmpleador(contexto)` para el guard de `obtenerHistoricoTareas`.
- Llama a: `esEmpleador(contexto)` en `src/features/auth/authorize.ts` — firma: `(contexto: ContextoRol) => boolean`.
- Llama a: `getCurrentEmpleadaId()` en `src/features/auth/current-empleada.ts` — firma: `() => Promise<string>`. Apta para la **lectura** `obtenerTareasDelDia` (resuelve por sesión o fallback single-tenant). Para `marcarTarea`/`historico` usar la `empleadaId` de `resolverRol` (necesaria para 401/403 y la pertenencia BR-3).
- Llama a: `diaSemanaDe(isoDate)` en `src/features/liquidacion/domain/dias-laborales.ts` — firma: `(isoDate: string) => DiaSemana`. REUTILIZAR para mapear `fecha → DiaSemana` (TZ-safe, BR-4). NO reimplementar.
- Llama a: `errorResponse(status, code, message, details?)` y `validationErrorResponse(details)` en `src/features/config/application/api-error.ts` (mismas firmas que el spec hermano). Códigos de negocio nuevos a usar: `"NO_ENCONTRADO"` (404), `"NO_AUTORIZADO"` (401/403). `validationErrorResponse` ya produce `422 VALIDACION`.
- Conversión de fecha: `isIsoDate(value)`, `isoToDate(value)`, `toIsoDate(date)` en `src/features/config/application/date-iso.ts` — firmas: `isIsoDate(string)=>boolean`, `isoToDate(string)=>Date` (medianoche UTC), `toIsoDate(Date)=>string`. Usar para validar/convertir entre `YYYY-MM-DD` y `Date` (Prisma `CumplimientoTarea.fecha` es `DateTime`).
- **Aplicación (crear):** `src/features/tareas/application/cumplimiento-service.ts`:
  - `obtenerTareasDelDia(empleadaId, fecha): Promise<TareaDelDiaDto[]>` — mapea `fecha→DiaSemana` con `diaSemanaDe`, lista la rutina de ese día, hace join con los cumplimientos de esa fecha (default `false`), ordena por `orden`.
  - `marcarTarea(empleadaId, input): Promise<CumplimientoTareaDto>` — verifica que `rutinaTareaId` pertenece a `empleadaId` (si no, lanza un error mapeable a `404`, p. ej. `TareaNoEncontradaError`), upsert del `CumplimientoTarea`, devuelve el DTO con `descripcion` de la rutina.
  - `obtenerHistorico(empleadaId, desde, hasta): Promise<CumplimientoTareaDto[]>` — lista los cumplimientos de las tareas de la empleada en `[desde, hasta]`, con `descripcion` de cada rutina, ordenados.
  - Definir `class TareaNoEncontradaError extends Error` (espejo de `MenuValidacionError`) para traducir a `404` en la frontera.
- **Schemas (crear):** añadir a `src/features/tareas/application/schemas.ts` (o un archivo nuevo): `fechaQuerySchema` (string `YYYY-MM-DD` válida vía `isIsoDate`), `marcarTareaInputSchema` (`{ fecha: isoDate, rutinaTareaId: z.string().min(1), hecha: z.boolean() }`), y validación del rango `desde ≤ hasta` (puede ser un `.refine` sobre un objeto `{desde, hasta}` o chequeo explícito en el handler). Reutilizar el patrón `isoDateString` de `src/features/config/application/schemas.ts` (no duplicar `isIsoDate`).
- **Persistencia (crear):** `src/features/tareas/data/cumplimiento-repository.ts`:
  - `listarRutinaPorDia(empleadaId, diaSemana): Promise<RutinaTarea[]>` (where `empleadaId` + `diaSemana`, order `orden asc`).
  - `listarCumplimientosDeFecha(empleadaId, fecha: Date): Promise<CumplimientoTarea[]>` (cumplimientos cuyas `rutinaTarea.empleadaId = empleadaId` y `fecha` = la fecha dada).
  - `pertenece(rutinaTareaId, empleadaId): Promise<boolean>` (existe `RutinaTarea` con ese id y empleadaId).
  - `upsertCumplimiento(rutinaTareaId, fecha: Date, hecha): Promise<CumplimientoTarea>` — como `CumplimientoTarea` no tiene `@@unique(rutinaTareaId, fecha)`, hacer find-then-update/create (o `updateMany`/`create`) para garantizar un único registro por par (idempotencia AC-10). Cliente único `db` de `src/lib/db.ts`.
  - `listarHistorico(empleadaId, desde: Date, hasta: Date): Promise<(CumplimientoTarea & {rutinaTarea})[]>` — cumplimientos de tareas de la empleada con `fecha` en `[desde, hasta]`, incluyendo la `rutinaTarea` para la `descripcion`/`orden`, ordenados por `(fecha asc, orden asc)`.
  - Modelos Prisma (Epic 1.2): `RutinaTarea { id, empleadaId, diaSemana, descripcion, horaInicio?, horaFin?, orden }`, `CumplimientoTarea { id, rutinaTareaId, fecha(DateTime), hecha(Boolean) }`. La relación `RutinaTarea.cumplimientos` y `CumplimientoTarea.rutinaTarea` ya existen.
- **Fixtures disponibles (no duplicar):** `buildEmpleadaAggregate(overrides?)` (`src/lib/test/factories.ts`); `setupTestDatabase/teardownTestDatabase/resetDatabase` (`src/lib/test/db-test-setup.ts`, ya borra `cumplimientoTarea`/`rutinaTarea`); `generarEnlace(email, baseUrl)` (`src/features/auth/application/acceso-service.ts`) + mock de `obtenerSesionEmpleador` para token de empleada (patrón de `src/app/api/v1/menu/route.test.ts`). Sembrar `RutinaTarea`/`CumplimientoTarea` directo con `db.rutinaTarea.create` / `db.cumplimientoTarea.create`.
- **Ubicación de los tests (RED):** co-localizados: `src/app/api/v1/tareas/dia/route.test.ts`, `src/app/api/v1/tareas/cumplimiento/route.test.ts`, `src/app/api/v1/tareas/historico/route.test.ts`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
