# SPEC: API Configuración — id: epic-3.1-api-empleada-configuracion/configuracion-api

**Epic:** Epic 3.1 (API Empleada y Configuración) — `docs/04-roadmap/ROADMAP.md`
**Módulo:** §2.2 Frontera (Route Handlers), §2.3 Aplicación, §2.5 Persistencia — `docs/02-architecture/architecture.md`

## Objetivo
Exponer la configuración de la empleada por la frontera HTTP: leer salario base y días laborales (`obtenerConfiguracion`) y actualizarlos (`actualizarConfiguracion`). La entrada se valida con Zod en la frontera (incluyendo el enum `DiaSemana`, almacenado como String en SQLite). Si aún no hay configuración, el salario base por defecto es 700000 (RN-18). Reutiliza el repositorio y la costura de auth introducidos por el spec hermano `empleada-api`.

## Fuera de Scope (NO testear, NO implementar)
- Autenticación/autorización real (Auth.js, rol RN-13): solo se usa la costura `getCurrentEmpleadaId()`. NO simular chequeo de rol.
- Ficha de la empleada (`nombre`, fechas de contrato): la cubre el spec hermano `empleada-api`.
- Uso de `diasLaborales` en el cálculo de liquidación (eso es Milestone 5): aquí solo se persiste/lee el conjunto configurado.
- Items de pago adicional (Epic 3.2).

## Operaciones del Contrato de API
> Fuente de verdad: `docs/02-architecture/api-contract.openapi.yaml`. NO redefinir shapes aquí.
- **Implementa** (backend): `obtenerConfiguracion` (GET `/api/v1/configuracion`), `actualizarConfiguracion` (PUT `/api/v1/configuracion`).
- DTO: `Configuracion` = `{ salarioBase: integer, diasLaborales: DiaSemana[] }`. Enum `DiaSemana` = `LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO`. Envelope de error único: `Error` = `{ code, message, details? }`.

## Contrato (machine-readable)

### `obtenerConfiguracion` — GET `/api/v1/configuracion`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Ninguna (empleada resuelta por la costura `getCurrentEmpleadaId()`). |
| Salidas (éxito) | `200` con body `Configuracion`: `salarioBase` (entero), `diasLaborales` (array de `DiaSemana`). Si la empleada no tiene configuración persistida, se devuelve el default RN-18: `salarioBase = 700000`, `diasLaborales = []`. |
| Salidas (error) | Ninguna de negocio (siempre `200`; el contrato no define `404` para configuración). |
| Efectos secundarios | Ninguno (lectura). No persiste el default. |
| Idempotencia | Sí. |

### `actualizarConfiguracion` — PUT `/api/v1/configuracion`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Body JSON validado con Zod contra `Configuracion`: `salarioBase` entero ≥ 0; `diasLaborales` array cuyos elementos pertenecen al enum `DiaSemana`. |
| Salidas (éxito) | `200` con body `Configuracion` persistido. |
| Salidas (error) | Entrada inválida (Zod): `salarioBase` negativo / no entero, `DiaSemana` fuera del enum, tipos incorrectos, o JSON malformado → `422` con envelope `{ code: "VALIDACION", message, details }`. |
| Efectos secundarios | Crea o actualiza (upsert) la `Configuracion` de la empleada resuelta vía aplicación → repositorio. `diasLaborales` se persiste como JSON (SQLite). |
| Idempotencia | Sí (PUT). |

## Reglas de Negocio
- **BR-1 (RN-18):** el salario base por defecto es 700000 COP cuando no hay configuración persistida; configurable por el empleador. El default se devuelve en lectura pero NO se materializa en base hasta un PUT. Fuente: business_requirements.md RN-18.
- **BR-2 (RN-02):** `diasLaborales` es el conjunto configurable de días de la semana laborales; sus valores válidos son exactamente el enum `DiaSemana`. Fuente: business_requirements.md RN-02.
- **BR-3 (§4 Nota SQLite + §5.4):** `DiaSemana` se almacena como String/JSON en SQLite; su dominio se valida con Zod en la frontera (el enum del contrato es la autoridad).
- **BR-4 (RN-13):** solo el empleador escribe; la autorización real se difiere al Epic 4 vía la costura `getCurrentEmpleadaId()` (sin chequeo de rol falso aquí).
- **BR-5 (§2.2/§6, conventions §4):** el Route Handler no contiene lógica de negocio ni toca Prisma directamente; delega en la aplicación → repositorio.
- **BR-6 (RN-16):** `salarioBase` es entero en COP (sin decimales).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** `GET /api/v1/configuracion` con una empleada cuya configuración existe (factory) responde `200` y un body que conforma `Configuracion`: `salarioBase` entero, `diasLaborales` array de `DiaSemana`.
- **AC-2 (RN-18):** `GET /api/v1/configuracion` cuando la empleada NO tiene configuración persistida responde `200` con `salarioBase = 700000` y `diasLaborales = []`, sin crear una fila de configuración.
- **AC-3:** `PUT /api/v1/configuracion` con body válido (`salarioBase` entero, `diasLaborales` subconjunto del enum) responde `200` y devuelve esos valores; un `GET` posterior devuelve los mismos datos (round-trip por SQLite real).
- **AC-4:** `PUT /api/v1/configuracion` con un `DiaSemana` inválido (ej. `"FUNES"`) responde `422` con envelope `{ code: "VALIDACION", message, details }`.
- **AC-5:** `PUT /api/v1/configuracion` con `salarioBase` negativo responde `422` envelope `VALIDACION`.
- **AC-6:** `PUT /api/v1/configuracion` con `salarioBase` no entero (ej. `700000.5`) responde `422` envelope `VALIDACION`.

## Edge Cases (los que cambian comportamiento)
- **EC-1:** JSON malformado en el body → `422` envelope `VALIDACION` (no `500`).
- **EC-2:** `diasLaborales = []` (vacío) es válido → `200`, persiste y devuelve `[]`.
- **EC-3:** `PUT` idempotente: dos PUT con el mismo body válido → ambos `200` con el mismo resultado (upsert).
- **EC-4:** `salarioBase` ausente o `diasLaborales` ausente → `422` (ambos son requeridos en el DTO `Configuracion`).

## Superficie de Código Existente (para el implementer)
- Repositorio existente (Epic 1.2) — `src/features/config/data/empleada-repository.ts`:
  - `obtenerConfiguracionDeEmpleada(empleadaId: string): Promise<Configuracion | undefined>`
  - Tipo Prisma `Configuracion = { id, empleadaId, salarioBase: number, diasLaborales: Json }` (modelo `Configuracion` con `@@unique` en `empleadaId`).
  - NOTA: el repositorio NO tiene aún un upsert de configuración por `empleadaId`. El implementer debe AÑADIR (ej. `guardarConfiguracion(empleadaId, { salarioBase, diasLaborales }): Promise<Configuracion>`) usando el cliente único `db` (`@/lib/db`) con `db.configuracion.upsert`. `diasLaborales` se guarda como JSON (array de string).
- Costura de auth y helper de error — los introduce el spec hermano `empleada-api`:
  - `getCurrentEmpleadaId(): Promise<string>` bajo `src/features/auth/`.
  - Helper de envelope de error `{ code, message, details? }` → reutilizar el mismo módulo; NO duplicar. Reutilizar también la constante de código `"VALIDACION"`.
  - Si el spec hermano aún no está mergeado al implementar este, el implementer reutiliza esos símbolos si existen; si no, los crea en la misma ubicación acordada (no duplicar la costura).
- Constante RN-18: el default `700000` ya está documentado; centralizarlo (ej. `SALARIO_BASE_DEFAULT`) en el feature `config`, no hardcodear mágicamente disperso.
- Crea (nuevos):
  - `src/app/api/v1/configuracion/route.ts` — Route Handlers `GET` y `PUT` (frontera) con validación Zod del DTO `Configuracion` y del enum `DiaSemana`.
  - `src/features/config/application/configuracion-service.ts` — `obtenerConfiguracion(empleadaId)` (devuelve default RN-18 si no existe) y `guardarConfiguracion(empleadaId, datos)`.
  - Esquema Zod del enum `DiaSemana` y del DTO `Configuracion` — junto al handler o en `*-schema.ts` del feature `config`.
- Fixtures disponibles (NO duplicar): `src/lib/test/factories.ts` → `buildEmpleadaAggregate(overrides)` (default `salarioBase 700000`, `diasLaborales` L–S); `src/lib/test/db-test-setup.ts` → `setupTestDatabase`/`resetDatabase`/`teardownTestDatabase`. Para AC-2 (sin configuración) crear una empleada sin fila de configuración (ej. `db.empleada.create` directo en el test, o un override del factory), reusando el patrón de `empleada-repository.test.ts`.
- Invocar el handler en tests llamando a las funciones `GET`/`PUT` exportadas del `route.ts` con un `Request` construido a mano (sin levantar server).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés/español según conventions.md §8.*
