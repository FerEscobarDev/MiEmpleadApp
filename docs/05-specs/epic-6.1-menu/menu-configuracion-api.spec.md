# SPEC: API Menú — lectura y configuración — id: epic-6.1-menu/menu-configuracion-api

**Epic:** [Epic 6.1 — API Menú de cocina](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo
Exponer la lectura del menú de cocina (`obtenerMenu`) y la configuración de las comidas y la periodicidad de la plantilla (`actualizarConfiguracionMenu`). La lectura está permitida a ambos roles (empleador y empleada); la escritura de la configuración es exclusiva del empleador (RN-13). Cuando aún no hay configuración persistida, la lectura devuelve un default sensato sin materializarlo en base (RN-19).

## Fuera de Scope (NO testear, NO implementar)
- La operación `actualizarMenu` (PUT `/menu/entradas`) y la validación de rango de semana / acoplamiento comida↔comidas configuradas → spec hermano `menu-entradas-api`.
- Cualquier UI o cliente tipado del frontend (Epic 8.5).
- Persistencia/migración del schema Prisma (ya existe: modelos `MenuConfig` / `MenuEntrada`, Epic 1.2).
- Autenticación real de la empleada por token más allá de lo ya provisto por la costura de auth existente (`resolverRol`, `rechazarSiNoEmpleador`).

## Operaciones del Contrato de API
> Referencia por `operationId` de `docs/02-architecture/api-contract.md`. El contrato es la fuente de verdad de los shapes.
- **Implementa** (backend): `obtenerMenu` (GET `/api/v1/menu`), `actualizarConfiguracionMenu` (PUT `/api/v1/menu/configuracion`).
- **Sin consumo de frontend en este spec.**

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

### `obtenerMenu` — GET `/api/v1/menu`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Ninguna en el body. Identidad/rol resuelto por la costura de auth (`resolverRol` / `getCurrentEmpleadaId`). |
| Salidas (éxito) | `200` con DTO `Menu` = `{ configuracion: MenuConfig, entradas: MenuEntrada[] }`. `MenuConfig` = `{ comidas: string[], periodicidad: "SEMANAL"\|"QUINCENAL"\|"MENSUAL" }`. `MenuEntrada` = `{ semana: int≥0, diaSemana: DiaSemana, comida: string, descripcion: string }`. |
| Salidas (error) | `500` envelope `{ code, message }` ante fallo inesperado. (`401` se materializa en el epic de auth real; aquí no se ejercita.) |
| Efectos secundarios | Ninguno. Lectura pura. El default NO se persiste. |
| Idempotencia | Sí. Múltiples GET devuelven lo mismo y no crean filas. |
| Lectura por rol | Permitida para empleador Y empleada (ambos esquemas de seguridad). No hay campo `notas` en menú → sin concern RN-12. |

### `actualizarConfiguracionMenu` — PUT `/api/v1/menu/configuracion`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Body JSON `MenuConfig` = `{ comidas: string[], periodicidad: Periodicidad }`. Validado con Zod en la frontera. |
| Salidas (éxito) | `200` con el `MenuConfig` persistido. |
| Salidas (error) | `422` `{ code: "VALIDACION", message, details }` si: body no es JSON; `periodicidad` ∉ {SEMANAL,QUINCENAL,MENSUAL}; `comidas` ausente, no-array, vacío, o contiene una cadena vacía/blanca. `403` `{ code: "NO_AUTORIZADO" }` si el llamador presenta token de empleada (rol empleada o token inválido). `500` ante fallo inesperado. |
| Efectos secundarios | Upsert de la fila `MenuConfig` de la empleada: persiste `comidas` (JSON) y `periodicidad` (String). Una sola config por empleada (`@@unique empleadaId`). NO toca las `entradas`. |
| Idempotencia | Sí. Dos PUT idénticos dejan el mismo estado y una sola fila. |

## Reglas de Negocio
- **BR-1 (RN-19):** las comidas del menú son configurables por el empleador (lista de strings no vacíos). Fuente: business_requirements.md §Reglas de Negocio RN-19.
- **BR-2 (RN-14):** la periodicidad de la plantilla es `SEMANAL | QUINCENAL | MENSUAL`; define el número de semanas del ciclo (1/2/4). En este spec solo se valida/persiste el valor; el rango de semanas se aplica en el spec de entradas. Fuente: RN-14.
- **BR-3 (RN-13):** solo el empleador escribe; la empleada es de solo lectura. La lectura (`obtenerMenu`) la pueden hacer ambos roles. Fuente: RN-13.
- **BR-4 (default, RN-19):** cuando no hay `MenuConfig` persistida, `obtenerMenu` devuelve un default DOCUMENTADO: `comidas = ["Desayuno","Almuerzo","Cena"]`, `periodicidad = "SEMANAL"`, `entradas = []`. El default NO se persiste (no se materializa fila al leer). El contenido del menú NUNCA se hardcodea: solo la lista de comidas por defecto y la periodicidad inicial.
- **BR-5:** el guard de escritura preserva el flujo existente cuando NO hay token de empleada presente (backward-compat con la costura `rechazarSiNoEmpleador`): sin token → se permite (se resolverá por sesión/fallback).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** `GET /menu` sin configuración persistida devuelve `200` con el default `{ configuracion: { comidas: ["Desayuno","Almuerzo","Cena"], periodicidad: "SEMANAL" }, entradas: [] }` y NO crea ninguna fila `MenuConfig` (count = 0).
- **AC-2:** tras configurar (`PUT /menu/configuracion`) con `{ comidas: ["Desayuno","Cena"], periodicidad: "QUINCENAL" }`, `GET /menu` devuelve `200` con esa configuración y `entradas: []`.
- **AC-3:** `GET /menu` con configuración Y entradas previamente sembradas devuelve ambas: la `configuracion` guardada y el arreglo de `entradas` con el shape del contrato (`semana, diaSemana, comida, descripcion`).
- **AC-4:** `PUT /menu/configuracion` con body válido responde `200`, persiste `comidas` + `periodicidad` (round-trip por `GET /menu`).
- **AC-5:** `PUT /menu/configuracion` con `periodicidad` inválida (ej. `"DIARIA"`) responde `422` `code: "VALIDACION"` con `details`.
- **AC-6:** `PUT /menu/configuracion` con `comidas: []` (vacío) responde `422` `code: "VALIDACION"`.
- **AC-7:** `PUT /menu/configuracion` con `comidas` conteniendo una cadena vacía o solo-espacios (ej. `["Desayuno",""]`) responde `422` `code: "VALIDACION"`.
- **AC-8 (RN-13):** `PUT /menu/configuracion` con header `X-Acceso-Token` de empleada válida responde `403` `code: "NO_AUTORIZADO"` y NO modifica la configuración existente.
- **AC-9:** `GET /menu` con header `X-Acceso-Token` de empleada válida responde `200` (lectura permitida a la empleada).
- **AC-10:** `PUT /menu/configuracion` es idempotente: dos PUT idénticos dejan el mismo resultado y una sola fila `MenuConfig` (count = 1).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** `PUT /menu/configuracion` con JSON malformado responde `422 VALIDACION` (no `500`).
- **EC-2:** `PUT /menu/configuracion` con `comidas` ausente responde `422 VALIDACION`.
- **EC-3:** `PUT /menu/configuracion` con token de empleada INVÁLIDO (no resuelve a ningún rol) responde `403 NO_AUTORIZADO` (no se filtra como 500).
- **EC-4:** `PUT /menu/configuracion` SIN token de empleada sigue respondiendo `200` (backward-compat, BR-5).
- **EC-5:** actualizar la configuración NO borra las entradas previamente guardadas (solo cambia comidas/periodicidad).

## Superficie de Código Existente (para el implementer)
- Llama a: `getCurrentEmpleadaId(): Promise<string>` en `src/features/auth/current-empleada.ts`.
- Llama a: `rechazarSiNoEmpleador(request: Request): Promise<Response | null>` en `src/features/auth/authorize.ts`.
- Llama a: `errorResponse(status, code, message, details?): Response`, `validationErrorResponse(details): Response`, const `CODE_VALIDACION` en `src/features/config/application/api-error.ts` (reutilizar el envelope existente; NO duplicar).
- Cliente Prisma único: `db` en `src/lib/db.ts`. Modelos `db.menuConfig` (`{ id, empleadaId @unique, comidas: Json, periodicidad: String default "SEMANAL" }`) y `db.menuEntrada` (`{ id, menuConfigId, semana: Int, diaSemana: String, comida: String, descripcion: String }`).
- Patrón Zod enum a imitar: `diaSemanaSchema` en `src/features/config/application/schemas.ts` (`z.enum([...])`).
- Crea: 
  - `src/features/menu/application/schemas.ts` — `menuConfigInputSchema` (`periodicidadSchema = z.enum(["SEMANAL","QUINCENAL","MENSUAL"])`, `comidas` array de strings no vacíos `.min(1)` con refine de no-blanco, array `.min(1)`).
  - `src/features/menu/application/menu-service.ts` — `obtenerMenu(empleadaId)`, `guardarConfiguracionMenu(empleadaId, input)`, DTOs `MenuDto`/`MenuConfigDto`/`MenuEntradaDto`, const `COMIDAS_DEFAULT`/`PERIODICIDAD_DEFAULT`.
  - `src/features/menu/data/menu-repository.ts` — `obtenerMenuConfig(empleadaId)`, `guardarMenuConfig(empleadaId, {comidas, periodicidad})` (upsert), `listarEntradas(menuConfigId)`.
  - `src/app/api/v1/menu/route.ts` — `GET`.
  - `src/app/api/v1/menu/configuracion/route.ts` — `PUT`.
- Fixtures disponibles (no duplicar): `buildEmpleadaAggregate(overrides)` en `src/lib/test/factories.ts`; `setupTestDatabase`/`teardownTestDatabase`/`resetDatabase` en `src/lib/test/db-test-setup.ts` (ya incluye `menuConfig`/`menuEntrada` en el orden de borrado); `generarEnlace(email, baseUrl)` en `src/features/auth/application/acceso-service.ts` y el mock de `session-reader` para tokens de empleada (ver `src/app/api/v1/rn13-enforcement.test.ts`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
