# SPEC: API Menú — entradas de la plantilla — id: epic-6.1-menu/menu-entradas-api

**Epic:** [Epic 6.1 — API Menú de cocina](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.2–§2.5](../../02-architecture/architecture.md#2-componentes-de-alto-nivel)

## Objetivo
Permitir al empleador definir/actualizar las entradas de la plantilla de menú (`actualizarMenu`): cada entrada es la descripción de una comida para un día de la semana en una semana del ciclo. El PUT **reemplaza** por completo el conjunto de entradas de la plantilla. Se valida el rango de semana según la periodicidad configurada (RN-14) y que la comida de cada entrada sea una de las comidas configuradas (RN-19). La escritura es exclusiva del empleador (RN-13).

## Fuera de Scope (NO testear, NO implementar)
- `obtenerMenu` y `actualizarConfiguracionMenu` → spec hermano `menu-configuracion-api` (este spec asume que `MenuConfig` ya existe/se lee con su default).
- UI / cliente tipado (Epic 8.5).
- Proyección de la plantilla a fechas concretas del calendario (no está en el contrato; fuera de Epic 6.1).

## Operaciones del Contrato de API
> Referencia por `operationId` de `docs/02-architecture/api-contract.md`.
- **Implementa** (backend): `actualizarMenu` (PUT `/api/v1/menu/entradas`).

## Contrato (machine-readable — identificadores en inglés, dominio en español, conventions.md §8)

### `actualizarMenu` — PUT `/api/v1/menu/entradas`
| Aspecto | Detalle |
|---------|---------|
| Entradas | Body JSON = `MenuEntrada[]`. Cada `MenuEntrada` = `{ semana: int≥0, diaSemana: DiaSemana, comida: string (no vacío), descripcion: string }`. |
| Salidas (éxito) | `200` con el arreglo `MenuEntrada[]` persistido (mismo shape del contrato). |
| Salidas (error) | `422` `{ code: "VALIDACION", message, details }` si: body no es JSON / no es array; algún `diaSemana` ∉ enum `DiaSemana`; algún `semana` < 0 o no entero; algún `semana` fuera del rango permitido por la periodicidad configurada (ver BR-2); alguna `comida` vacía o NO incluida en las `comidas` configuradas (ver BR-3); `descripcion` ausente. `403` `{ code: "NO_AUTORIZADO" }` con token de empleada. `500` ante fallo inesperado. |
| Efectos secundarios | **Reemplazo total**: borra todas las `MenuEntrada` actuales de la `MenuConfig` de la empleada y crea las nuevas. Atómico (transacción). La `MenuConfig` se asegura existente (se crea con el default si no existe, para colgar las entradas). |
| Idempotencia | Sí. Dos PUT con el mismo arreglo dejan el mismo conjunto de entradas (sin duplicados acumulados). |

## Reglas de Negocio
- **BR-1 (RN-14):** la plantilla del menú se organiza por (semana del ciclo, día de semana, comida) y se repite según la periodicidad. Fuente: business_requirements.md §RN-14.
- **BR-2 (RN-14 — rango de semana, DOCUMENTADO):** el número de semanas del ciclo se deriva de la periodicidad configurada en `MenuConfig`:
  - `SEMANAL` → 1 semana → `semana` debe ser exactamente `0`.
  - `QUINCENAL` → 2 semanas → `semana` ∈ {0, 1}.
  - `MENSUAL` → 4 semanas → `semana` ∈ {0, 1, 2, 3}.
  Una entrada con `semana` fuera del rango de la periodicidad vigente se rechaza con `422 VALIDACION`. Si no hay `MenuConfig` persistida, rige el default `SEMANAL` (rango {0}).
- **BR-3 (RN-19 — acoplamiento comida↔comidas, DOCUMENTADO):** la `comida` de cada entrada debe ser una de las `comidas` configuradas en `MenuConfig` (comparación exacta, sensible a mayúsculas/acentos, igual que se persistió). Una `comida` que no esté en la lista configurada se rechaza con `422 VALIDACION`. Con el default (`["Desayuno","Almuerzo","Cena"]`) las comidas válidas son esas tres.
- **BR-4 (RN-13):** solo el empleador escribe las entradas; la empleada no. Fuente: RN-13.
- **BR-5:** el guard de escritura preserva el flujo existente cuando NO hay token de empleada presente (backward-compat con `rechazarSiNoEmpleador`).
- **BR-6:** validación en dos fases — primero la forma estructural con Zod (tipos, enum `DiaSemana`, `semana` entero ≥0, `comida`/`descripcion` strings); luego las reglas dependientes de la configuración (rango de semana por periodicidad, comida ∈ comidas) en la capa de aplicación, devolviendo `422 VALIDACION`. Toda violación es `422`, nunca `500`.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** `PUT /menu/entradas` con un arreglo válido (semanas dentro del rango y comidas configuradas) responde `200` y devuelve las entradas; `GET /menu` (o consulta directa) refleja exactamente esas entradas.
- **AC-2 (reemplazo):** un segundo `PUT /menu/entradas` con un arreglo distinto reemplaza por completo al anterior (las entradas viejas desaparecen; el conteo coincide con el nuevo arreglo).
- **AC-3:** `PUT /menu/entradas` con `diaSemana` inválido (ej. `"LUNADES"`) responde `422 VALIDACION`.
- **AC-4 (BR-2):** con periodicidad `SEMANAL`, una entrada con `semana: 1` responde `422 VALIDACION`.
- **AC-5 (BR-2):** con periodicidad `QUINCENAL`, `semana: 1` es válida (`200`) y `semana: 2` responde `422 VALIDACION`.
- **AC-6 (BR-2):** con periodicidad `MENSUAL`, `semana: 3` es válida (`200`) y `semana: 4` responde `422 VALIDACION`.
- **AC-7 (BR-3):** una entrada con `comida` NO incluida en las `comidas` configuradas (ej. comida `"Onces"` cuando solo hay `["Desayuno","Almuerzo","Cena"]`) responde `422 VALIDACION`.
- **AC-8 (BR-3):** una entrada con `comida` que SÍ está en las `comidas` configuradas responde `200`.
- **AC-9 (BR-2 default):** sin `MenuConfig` persistida, rige `SEMANAL`: `semana: 0` con comida del default es válida (`200`); `semana: 1` responde `422`.
- **AC-10 (RN-13):** `PUT /menu/entradas` con header `X-Acceso-Token` de empleada responde `403 NO_AUTORIZADO` y NO modifica las entradas existentes.
- **AC-11 (idempotencia):** dos PUT idénticos dejan el mismo conjunto de entradas (sin acumular duplicados).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** `PUT /menu/entradas` con body que NO es un array (ej. objeto) responde `422 VALIDACION`.
- **EC-2:** `PUT /menu/entradas` con arreglo vacío `[]` responde `200` y deja la plantilla sin entradas (borra las previas).
- **EC-3:** `PUT /menu/entradas` con `semana: -1` responde `422 VALIDACION`.
- **EC-4:** `PUT /menu/entradas` con `comida` vacía (`""`) responde `422 VALIDACION`.
- **EC-5:** `PUT /menu/entradas` con JSON malformado responde `422 VALIDACION` (no `500`).
- **EC-6:** `PUT /menu/entradas` con token de empleada INVÁLIDO responde `403 NO_AUTORIZADO`.

## Superficie de Código Existente (para el implementer)
- Llama a: `getCurrentEmpleadaId(): Promise<string>` en `src/features/auth/current-empleada.ts`.
- Llama a: `rechazarSiNoEmpleador(request): Promise<Response | null>` en `src/features/auth/authorize.ts`.
- Llama a: `errorResponse`, `validationErrorResponse`, `CODE_VALIDACION` en `src/features/config/application/api-error.ts`.
- Reutiliza del spec hermano (mismo epic): `diaSemanaSchema` / `periodicidadSchema` y el repositorio `src/features/menu/data/menu-repository.ts` (extender con `reemplazarEntradas(menuConfigId, entradas[])` y un asegurador de `MenuConfig`), `obtenerMenuConfig`, `COMIDAS_DEFAULT`/`PERIODICIDAD_DEFAULT`. Si el spec hermano aún no creó un símbolo, créalo aquí.
- Cliente Prisma único: `db` en `src/lib/db.ts`. Modelo `db.menuEntrada` y `db.menuConfig` (ver schema en `prisma/schema.prisma`). Para el reemplazo atómico usar `db.$transaction([...])` (patrón existente en otros repos del proyecto).
- Crea:
  - `src/features/menu/application/schemas.ts` — añade `menuEntradaInputSchema` (objeto) y `menuEntradasInputSchema = z.array(menuEntradaInputSchema)` con `diaSemana` enum, `semana` `z.int().min(0)`, `comida`/`descripcion` strings (comida `.min(1)`).
  - Función de aplicación `actualizarEntradasMenu(empleadaId, entradas)` en `src/features/menu/application/menu-service.ts` que: asegura `MenuConfig` (con default si falta), valida rango de semana por periodicidad y comida ∈ comidas, y delega el reemplazo al repositorio. Devuelve `MenuEntradaDto[]` o lanza un error de validación esperable que la frontera traduce a `422`.
  - `src/app/api/v1/menu/entradas/route.ts` — `PUT`.
- Error de validación de aplicación: definir/usar una clase de error esperable (ej. `MenuValidacionError` con `details`) capturada por el handler → `validationErrorResponse(details)`; NO usar `throw` genérico para reglas de negocio (conventions.md §6).
- Fixtures disponibles (no duplicar): `buildEmpleadaAggregate`, `setupTestDatabase`/`resetDatabase`/`teardownTestDatabase`, `generarEnlace` + mock de `session-reader` (ver `src/app/api/v1/rn13-enforcement.test.ts`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
