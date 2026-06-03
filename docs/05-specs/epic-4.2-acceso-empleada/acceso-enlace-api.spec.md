# SPEC: Acceso de la empleada — enlace y validación — id: epic-4.2-acceso-empleada/acceso-enlace-api

**Epic:** ROADMAP Epic 4.2 (Acceso de la empleada por enlace)   **Módulo:** architecture.md §2.6 (Autenticación y Acceso), §2.2 (Frontera), §2.3 (Aplicación), §2.5 (Persistencia)

## Objetivo
Permitir al empleador generar (y regenerar) un enlace de acceso de solo lectura para su empleada, revocarlo, y permitir a la empleada validar su token de acceso para obtener su contexto de consulta. El token es aleatorio criptográficamente fuerte; regenerar invalida el token anterior; revocar deja el enlace inactivo. La validación rechaza tokens faltantes, inválidos o revocados.

## Fuera de Scope (NO testear, NO implementar)
- La capa de autorización por rol reutilizable y el strip de `notas` (RN-12) → spec hermano `autorizacion-por-rol`.
- La aplicación de RN-13 sobre los handlers de configuración (3.1/3.2) → spec hermano.
- La UI de configuración que consume estas operaciones (Epic 8.2).
- Cualquier operación de liquidación, menú o tareas.

## Operaciones del Contrato de API
- **Implementa** (backend): `generarEnlaceAcceso` (POST `/api/v1/acceso/enlace`), `revocarEnlaceAcceso` (DELETE `/api/v1/acceso/enlace`), `validarAccesoEmpleada` (GET `/api/v1/acceso/validar`).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `generarEnlaceAcceso`: ninguna (identidad por sesión de empleador). `revocarEnlaceAcceso`: ninguna (sesión de empleador). `validarAccesoEmpleada`: header `X-Acceso-Token: <token>`. |
| Salidas (éxito) | `generarEnlaceAcceso` → `200` `EnlaceAcceso { token: string, url: string, activo: true }`. `revocarEnlaceAcceso` → `204` sin cuerpo. `validarAccesoEmpleada` → `200` `ContextoEmpleada { nombre: string, valido: true }`. |
| Salidas (error) | `generarEnlaceAcceso` / `revocarEnlaceAcceso` sin sesión de empleador → `401` envelope `{ code: "NO_AUTORIZADO", message }`. `validarAccesoEmpleada` con token faltante/ inválido/ revocado → `401` envelope `{ code: "ACCESO_INVALIDO", message }`. |
| Efectos secundarios | `generarEnlaceAcceso` crea o reemplaza la fila `EnlaceAcceso` de la empleada con un token nuevo y `activo=true` (una sola fila por empleada: `empleadaId` es `@unique`). `revocarEnlaceAcceso` pone `activo=false` (o borra) el enlace de la empleada. `validarAccesoEmpleada` no escribe. |
| Idempotencia | `generarEnlaceAcceso`: NO (cada llamada produce un token distinto e invalida el previo). `revocarEnlaceAcceso`: SÍ (revocar dos veces deja el mismo estado, sin error). `validarAccesoEmpleada`: SÍ. |

### Shape `url`
- `url` es el enlace completo de consulta: el path es `/consulta/<token>`, precedido por la base URL derivada del entorno o de la petición — NO se hardcodea un dominio. La base URL se resuelve, en orden: variable de entorno de base pública si existe; en su defecto, el origin de la `Request` entrante. El test verifica que `url` termina en `/consulta/<token>` y contiene el token, no un dominio fijo.

### Almacenamiento del token (decisión)
- El token visible para el empleador es 32 bytes aleatorios (`node:crypto`) codificados en base64url. En reposo, en la fila `EnlaceAcceso.token`, se guarda el **hash SHA-256** del token (hex), no el token en claro: la validación re-hashea el token recibido y compara contra el almacenado. Esto evita exponer un secreto reutilizable si se filtra la base. El campo `token` del modelo Prisma (ya `@unique`) almacena el hash.

## Reglas de Negocio
- **BR-1 (RN-13):** solo el empleador puede generar o revocar el enlace de acceso — fuente: business_requirements.md §RN-13 / HU-02. Sin sesión de empleador ⇒ `401 NO_AUTORIZADO`.
- **BR-2 (HU-03):** la empleada accede mediante el token (sin registro). Un token válido y activo resuelve a la empleada y devuelve su contexto — fuente: business_requirements.md HU-03.
- **BR-3 (caso límite "código revocado/inválido"):** un token revocado (`activo=false`) o inexistente pierde el acceso ⇒ `401 ACCESO_INVALIDO` — fuente: business_requirements.md Casos Límite.
- **BR-4 (HU-02 regenerar):** generar el enlace cuando ya existe uno **reemplaza** el token: el token anterior deja de validar — fuente: business_requirements.md HU-02.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** con sesión de empleador, `generarEnlaceAcceso` responde `200` con `{ token, url, activo: true }`; `token` es un string no vacío; `url` termina en `/consulta/<token>`.
- **AC-2:** tras `generarEnlaceAcceso`, `validarAccesoEmpleada` con el header `X-Acceso-Token` igual al token devuelto responde `200` `{ nombre: <nombre de la empleada>, valido: true }`.
- **AC-3:** regenerar (llamar `generarEnlaceAcceso` dos veces) produce un token distinto; validar con el token **antiguo** responde `401 ACCESO_INVALIDO`; validar con el **nuevo** responde `200`.
- **AC-4:** `revocarEnlaceAcceso` con sesión de empleador responde `204`; luego `validarAccesoEmpleada` con el token previamente válido responde `401 ACCESO_INVALIDO`.
- **AC-5:** `generarEnlaceAcceso` SIN sesión de empleador responde `401 NO_AUTORIZADO`.
- **AC-6:** `revocarEnlaceAcceso` SIN sesión de empleador responde `401 NO_AUTORIZADO`.
- **AC-7:** `validarAccesoEmpleada` sin el header `X-Acceso-Token` responde `401 ACCESO_INVALIDO`.
- **AC-8:** `validarAccesoEmpleada` con un token arbitrario que nunca se generó responde `401 ACCESO_INVALIDO`.

## Edge Cases (los que cambian comportamiento)
- **EC-1:** `revocarEnlaceAcceso` cuando no existe enlace previo (nunca se generó) responde `204` igualmente (idempotente, no `404`).
- **EC-2:** el hash almacenado nunca es igual al token en claro (se persiste el SHA-256, no el token) — verificable inspeccionando la fila `EnlaceAcceso` tras generar.
- **EC-3:** dos `generarEnlaceAcceso` consecutivos mantienen **una sola** fila `EnlaceAcceso` para la empleada (no se acumulan filas).

## Superficie de Código Existente (para el implementer)
- Llama a: `obtenerSesionEmpleador()` en `src/features/auth/application/session-reader.ts` — firma: `() => Promise<{ email: string | null } | null>`. Es la costura mockeable de sesión; con sesión ⇒ objeto con `email`, sin sesión ⇒ `null`.
- Llama a: `buscarEmpleadorPorEmail(email: string)` en `src/features/auth/data/empleador-repository.ts` — firma: `(email: string) => Promise<Empleador | undefined>`.
- Llama a: `buscarEmpleadaPorEmpleador(empleadorId: string)` en `src/features/config/data/empleada-repository.ts` — firma: `(empleadorId: string) => Promise<Empleada | undefined>`.
- Llama a: `errorResponse(status, code, message, details?)` y patrón del envelope en `src/features/config/application/api-error.ts` — firma: `(status: number, code: string, message: string, details?: unknown) => Response`.
- Usa: cliente Prisma único `db` en `src/lib/db.ts`; modelo `EnlaceAcceso { id, token (@unique), empleadaId (@unique), activo }` ya existe en `prisma/schema.prisma`.
- Usa: `node:crypto` (`randomBytes`, `createHash`) — built-in, sin librerías nuevas.
- Crea: repositorio `src/features/auth/data/enlace-acceso-repository.ts` (upsert por empleadaId, buscar por hash de token activo, revocar por empleadaId).
- Crea: servicio `src/features/auth/application/acceso-service.ts` (generar token + hash, regenerar/upsert, revocar, validar token → contexto empleada). Generación de token y hash en un helper `src/features/auth/token.ts` (`generarTokenAcceso()`, `hashTokenAcceso(token)`).
- Crea: Route Handlers `src/app/api/v1/acceso/enlace/route.ts` (POST, DELETE) y `src/app/api/v1/acceso/validar/route.ts` (GET).
- Fixtures disponibles: `buildEmpleadaAggregate(overrides?)` en `src/lib/test/factories.ts`; `setupTestDatabase/resetDatabase/teardownTestDatabase` en `src/lib/test/db-test-setup.ts`. La tabla `enlaceAcceso` ya está en el `DELETION_ORDER` del reset. Mock de sesión: `vi.mock("@/features/auth/application/session-reader", ...)` como en `current-empleada.test.ts`.

### Nota sobre la firma de los Route Handlers (HEALTH BAR — next build)
- Los handlers GET/DELETE que reciben `Request` deben declararla como **primer parámetro requerido** (no opcional). `validarAccesoEmpleada` (GET) DEBE leer el header de la `Request`, así que la usa. Evitar parámetros opcionales como primer argumento (regresión de `next build`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
