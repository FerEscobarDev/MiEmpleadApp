# SPEC: API Rutina de Tareas — id: epic-6.2-api-tareas-diarias/tareas-rutina-api

**Epic:** Epic 6.2 (API Tareas diarias) — ROADMAP Milestone 6   **Módulo:** architecture.md §2.2 (Frontera), §2.3 (Aplicación), §2.5 (Persistencia)

## Objetivo

Exponer la **rutina de tareas por día de la semana** (checklist repetible con horarios opcionales, RN-15): lectura para ambos roles y reemplazo total de la rutina solo por el empleador (RN-13). La rutina es la plantilla que se repite cada semana; el marcado histórico por fecha vive en el spec hermano (`tareas-dia-cumplimiento-api`).

## Fuera de Scope (NO testear, NO implementar)

- `obtenerTareasDelDia`, `marcarTarea`, `obtenerHistoricoTareas` (spec hermano).
- El mapeo fecha→día de la semana y el estado `hecha` (spec hermano).
- Cualquier UI / pantalla (eso es Milestone 8).
- Autenticación real / emisión de sesión o token (ya provistos por Epic 4.1/4.2 y la costura de auth existente).
- Validación de solapamiento entre tareas o unicidad de `orden` (no la exige el negocio).

## Operaciones del Contrato de API

- **Implementa** (spec de backend): `obtenerRutinaTareas` (GET `/api/v1/tareas/rutina`), `actualizarRutinaTareas` (PUT `/api/v1/tareas/rutina`).
- El contrato (`api-contract.openapi.yaml`) es la fuente de verdad de los shapes `RutinaTarea`, `RutinaTareaInput`. NO se redefinen aquí.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | **GET** `/tareas/rutina`: sin body. **PUT** `/tareas/rutina`: body = `RutinaTareaInput[]` — cada item `{ diaSemana: DiaSemana, descripcion: string (no vacía), horaInicio?: "HH:mm"\|null, horaFin?: "HH:mm"\|null, orden: int }`. |
| Salidas (éxito) | **GET** → `200` `RutinaTarea[]` ordenadas por `(diaSemana, orden)`; cada item `{ id, diaSemana, descripcion, horaInicio?, horaFin?, orden }`. **PUT** → `200` `RutinaTarea[]` (la rutina resultante tras el reemplazo, mismo orden/shape). |
| Salidas (error) | Body Zod inválido (diaSemana fuera del enum, `descripcion` vacía, `orden` no entero, `horaInicio`/`horaFin` con formato ≠ `HH:mm`, body no-array) → `422` `{ code: "VALIDACION" }`. Regla `horaInicio > horaFin` (ambas presentes) → `422` `{ code: "VALIDACION" }`. PUT con token de empleada (rol empleada o token inválido) → `403` `{ code: "NO_AUTORIZADO" }` (RN-13). Fallo inesperado → `500`. |
| Efectos secundarios | **GET**: ninguno. **PUT**: reemplazo TOTAL y atómico de las `RutinaTarea` de la empleada (borra las actuales, crea las nuevas) en una transacción. |
| Idempotencia | **GET** sí. **PUT** sí: dos PUT idénticos dejan el mismo conjunto de tareas (los `id` regenerados pueden diferir, pero el conjunto lógico de tareas es el mismo). |

## Reglas de Negocio

- **BR-1 (RN-15):** la rutina se define **por día de la semana** con **horarios opcionales** por tarea y se repite cada semana — fuente: business_requirements.md §Reglas (RN-15). El `orden` ordena las tareas dentro de un día.
- **BR-2 (RN-13):** solo el **empleador** puede escribir la rutina; la **empleada** es de solo lectura para esta operación (su única escritura es `marcarTarea`, spec hermano) — fuente: business_requirements.md §Reglas (RN-13). La lectura (`obtenerRutinaTareas`) está permitida a **ambos** roles (contrato: `sesionEmpleador` o `accesoEmpleada`).
- **BR-3:** una tarea de la rutina tiene `descripcion` no vacía (ni solo espacios). Los horarios `horaInicio`/`horaFin` son **opcionales**; si están presentes deben tener formato `HH:mm` 24h (`00:00`–`23:59`). Si **ambos** están presentes, `horaInicio ≤ horaFin` (comparación lexicográfica de `HH:mm`, válida por el cero a la izquierda).
- **BR-4:** el PUT es un **reemplazo total** de la rutina de la empleada (no un merge): la rutina resultante es exactamente el arreglo recibido. Un arreglo vacío borra toda la rutina y responde `200` con `[]`.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `GET /tareas/rutina` con tareas sembradas responde `200` con un arreglo conforme a `RutinaTarea` (campos `id, diaSemana, descripcion, horaInicio?, horaFin?, orden`), ordenado por `(diaSemana, orden)`.
- **AC-2:** `GET /tareas/rutina` sin tareas responde `200` con `[]`.
- **AC-3:** `GET /tareas/rutina` con token de empleada válido responde `200` (lectura permitida a la empleada, BR-2).
- **AC-4:** `PUT /tareas/rutina` con un arreglo válido (incluyendo una tarea con `horaInicio`/`horaFin` y otra sin horarios) responde `200`, persiste, y un `GET` posterior devuelve exactamente esa rutina.
- **AC-5:** `PUT /tareas/rutina` reemplaza por completo: un segundo PUT con un conjunto distinto deja solo las nuevas tareas (el conteo en base coincide con el segundo arreglo).
- **AC-6:** `PUT /tareas/rutina` con `diaSemana` fuera del enum `DiaSemana` responde `422 VALIDACION`.
- **AC-7:** `PUT /tareas/rutina` con `horaInicio` de formato inválido (ej. `"8:00"`, `"25:00"`, `"abc"`) responde `422 VALIDACION`.
- **AC-8:** `PUT /tareas/rutina` con `horaInicio > horaFin` (ambas presentes, ej. `"10:00"` > `"09:00"`) responde `422 VALIDACION`.
- **AC-9 (BR-2/RN-13):** `PUT /tareas/rutina` con token de empleada responde `403 NO_AUTORIZADO` y NO modifica la rutina persistida.
- **AC-10:** `PUT /tareas/rutina` es idempotente: dos PUT idénticos dejan el mismo conjunto lógico de tareas (mismo conteo y mismos datos lógicos).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** `PUT` con body que NO es un arreglo (ej. objeto) → `422 VALIDACION`.
- **EC-2:** `PUT` con arreglo vacío → `200` y borra toda la rutina (conteo en base = 0).
- **EC-3:** `PUT` con `descripcion` vacía o solo espacios → `422 VALIDACION`.
- **EC-4:** `PUT` con `orden` no entero (ej. `1.5` o `"a"`) → `422 VALIDACION`.
- **EC-5:** `PUT` con JSON malformado → `422 VALIDACION` (no `500`).
- **EC-6:** `PUT` con token de empleada **inválido** (no resuelve a empleada y sin sesión) → `403 NO_AUTORIZADO`.
- **EC-7:** `PUT` con una tarea que tiene SOLO `horaInicio` (sin `horaFin`) y formato válido → `200` (la regla de orden solo aplica con ambas presentes).
- **EC-8:** `GET`/`PUT` aceptan `horaInicio`/`horaFin` como `null` u omitidos indistintamente; la salida los expone como `null` (u omitidos) sin romper el shape.

## Superficie de Código Existente (para el implementer)

- **Frontera (crear):** `src/app/api/v1/tareas/rutina/route.ts` con `GET` y `PUT`. Seguir el patrón EXACTO de `src/app/api/v1/menu/configuracion/route.ts` y `src/app/api/v1/menu/route.ts` (GET no usa `request`, resuelve empleada por la costura; PUT aplica el guard de rol y valida con Zod). NO usar primer parámetro opcional en los Route Handlers (firma `GET(_request: Request)` / `PUT(request: Request)`).
- Llama a: `getCurrentEmpleadaId()` en `src/features/auth/current-empleada.ts` — firma: `() => Promise<string>` (lanza `EmpleadaNoResueltaError`). Resuelve la empleada del contexto (sesión empleador → su empleada; sin sesión → fallback single-tenant). Usar para GET y para el PUT del empleador.
- Llama a: `rechazarSiNoEmpleador(request)` en `src/features/auth/authorize.ts` — firma: `(request: Request) => Promise<Response | null>`. Devuelve `403 NO_AUTORIZADO` si hay token de empleada y NO es empleador; `null` si la escritura está permitida. Usar como primer guard del PUT (RN-13), idéntico a menu.
- Llama a: `errorResponse(status, code, message, details?)` y `validationErrorResponse(details)` en `src/features/config/application/api-error.ts` — firmas: `errorResponse(status: number, code: string, message: string, details?: unknown) => Response`; `validationErrorResponse(details: unknown) => Response` (siempre `422` `{ code: "VALIDACION", message, details }`).
- Reutiliza el enum: `diaSemanaSchema` en `src/features/config/application/schemas.ts` — `z.enum(["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"])`. NO duplicar el enum.
- Tipo de dominio: `DiaSemana` en `src/features/liquidacion/domain/dias-laborales.ts` (mismos literales que el contrato). Reutilizable.
- **Aplicación (crear):** `src/features/tareas/application/rutina-service.ts` — servicio que orquesta el repositorio: `obtenerRutina(empleadaId)` → `RutinaTareaDto[]`, `reemplazarRutina(empleadaId, inputs)` → `RutinaTareaDto[]`. Sin acceso directo a Prisma (conventions.md §4).
- **Schemas (crear):** `src/features/tareas/application/schemas.ts` — `rutinaTareaInputSchema` (objeto: `diaSemana` con `diaSemanaSchema`, `descripcion` no vacía vía `.refine(trim)`, `horaInicio`/`horaFin` opcionales-nullable con `.regex(/^([01]\d|2[0-3]):[0-5]\d$/)`, `orden` con `z.int()`), `rutinaTareasInputSchema = z.array(...)` con un `.superRefine`/`.refine` por item para `horaInicio ≤ horaFin` cuando ambas presentes. Espejo del patrón de `src/features/menu/application/schemas.ts`.
- **Persistencia (crear):** `src/features/tareas/data/rutina-repository.ts` — `listarRutina(empleadaId): Promise<RutinaTarea[]>` (ordenada por `diaSemana asc`, `orden asc`) y `reemplazarRutina(empleadaId, tareas): Promise<RutinaTarea[]>` (transacción: `deleteMany` por `empleadaId` + `createMany` + re-`listarRutina`). Modelo Prisma `RutinaTarea` ya existe (Epic 1.2): campos `id, empleadaId, diaSemana(String), descripcion, horaInicio(String?), horaFin(String?), orden(Int)`. Cliente único: `db` de `src/lib/db.ts`. Espejo de `src/features/menu/data/menu-repository.ts` (`reemplazarEntradas`).
- **Fixtures disponibles (no duplicar):** `buildEmpleadaAggregate(overrides?)` en `src/lib/test/factories.ts`; `setupTestDatabase/teardownTestDatabase/resetDatabase` en `src/lib/test/db-test-setup.ts` (ya incluye `cumplimientoTarea`/`rutinaTarea` en el orden de borrado); `generarEnlace(email, baseUrl)` en `src/features/auth/application/acceso-service.ts` para obtener un token de empleada en tests; mock de `obtenerSesionEmpleador` igual que en `src/app/api/v1/menu/route.test.ts`.
- **Ubicación del test (RED):** `src/app/api/v1/tareas/rutina/route.test.ts` (co-localizado con la ruta, `*.test.ts`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
