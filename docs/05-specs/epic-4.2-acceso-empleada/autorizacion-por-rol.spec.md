# SPEC: Autorización por rol y privacidad de notas — id: epic-4.2-acceso-empleada/autorizacion-por-rol

**Epic:** ROADMAP Epic 4.2 (Acceso de la empleada por enlace)   **Módulo:** architecture.md §2.6, §2.2 (Frontera), §5.1 (Autenticación y Autorización), §6 (Boundaries)

## Objetivo
Proveer una capa de autorización reutilizable que resuelve el **rol** del llamador (empleador por sesión Auth.js, o empleada por token `X-Acceso-Token`) y que la Capa de Frontera usa para: (a) permitir lecturas a ambos roles, (b) rechazar escrituras de la empleada con `403 NO_AUTORIZADO` (excepto `marcarTarea`, fuera de scope aquí), y (c) ocultar las `notas` a la empleada (RN-12). Además, cablear RN-13 en los handlers de escritura de configuración existentes (Epic 3.1/3.2).

## Fuera de Scope (NO testear, NO implementar)
- Las operaciones de generar/revocar/validar el enlace → spec hermano `acceso-enlace-api` (este spec asume el resolver de token de empleada ya existe).
- La operación `marcarTarea` (es de Epic 6.2): aquí solo se define que la capa expone la noción de excepción, sin implementar ese handler.
- La lectura de liquidación que porta `notas` (Epic 5.1): aquí se prueba el **helper de strip de notas de forma aislada** y se documenta que la lectura de liquidación de 5.1 lo consumirá. No se crea ningún handler de liquidación.
- La UI.

## Operaciones del Contrato de API
- **Toca** (no agrega operaciones nuevas): refuerza el rol en `actualizarEmpleada` (PUT `/empleada`), `actualizarConfiguracion` (PUT `/configuracion`), `crearItemAdicional` (POST `/items-adicionales`), `actualizarItemAdicional` (PUT `/items-adicionales/{id}`), `eliminarItemAdicional` (DELETE `/items-adicionales/{id}`). El contrato ya marca estas como `sesionEmpleador`.

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | De la `Request`: cookie de sesión (empleador, vía costura `obtenerSesionEmpleador`) y/o header `X-Acceso-Token` (empleada). |
| Salidas (éxito) | Resolución de rol: `{ rol: "EMPLEADOR" | "EMPLEADA", empleadaId: string }` o `null` (sin identidad). Helpers: `esEmpleador(rol)`, `puedeEscribir(rol)` (true solo para empleador), `stripNotas(obj)` (devuelve copia sin `notas` para empleada). |
| Salidas (error) | Cuando un handler de escritura es invocado por una empleada (o sin empleador) ⇒ el handler responde `403` envelope `{ code: "NO_AUTORIZADO", message }`. (La ausencia total de identidad en los handlers de config preserva el comportamiento backward-compat: ver BR-4.) |
| Efectos secundarios | Ninguno (la capa de autorización no escribe). |
| Idempotencia | N/A (resolución de identidad, pura respecto a la base salvo lecturas). |

## Reglas de Negocio
- **BR-1 (RN-13):** la empleada es de solo lectura; solo el empleador escribe (configura, registra novedades, etc.). Una escritura autenticada **solo** como empleada (token) ⇒ `403 NO_AUTORIZADO` — fuente: business_requirements.md §RN-13.
- **BR-2 (RN-12):** las `notas` del mes son privadas del empleador; nunca se exponen al rol empleada — fuente: business_requirements.md §RN-12. El helper `stripNotas` elimina la clave `notas` para la empleada y la conserva para el empleador.
- **BR-3 (contrato §1):** las lecturas aceptan `sesionEmpleador` O `accesoEmpleada`; las escrituras requieren `sesionEmpleador` (excepto `marcarTarea`) — fuente: api-contract.md §1.
- **BR-4 (backward-compat de la costura):** los handlers de escritura de configuración deben rechazar a una empleada con token, pero **no** romper el flujo existente donde no hay token de empleada (sesión de empleador o fallback single-tenant de los tests). Sin token de empleada presente, el handler procede como empleador (comportamiento previo). Con token de empleada presente y sin sesión de empleador ⇒ `403`.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** `resolverRol` con sesión de empleador (costura mockeada con email) y sin header de token ⇒ `{ rol: "EMPLEADOR", empleadaId }` con la empleada del empleador.
- **AC-2:** `resolverRol` sin sesión y con header `X-Acceso-Token` de un token válido y activo ⇒ `{ rol: "EMPLEADA", empleadaId }` con la empleada dueña del token.
- **AC-3:** `resolverRol` con token inválido/ revocado y sin sesión ⇒ `null` (sin identidad).
- **AC-4:** `puedeEscribir({ rol: "EMPLEADOR" })` es `true`; `puedeEscribir({ rol: "EMPLEADA" })` es `false`.
- **AC-5:** `stripNotas` sobre un objeto con `notas` devuelve, para `EMPLEADA`, una copia **sin** la clave `notas`; para `EMPLEADOR`, conserva `notas` intacta.
- **AC-6:** un PUT a `/configuracion` con header `X-Acceso-Token` de un token de empleada **válido** (y sin sesión de empleador) responde `403 NO_AUTORIZADO` y NO modifica la configuración.
- **AC-7:** un PUT a `/empleada` con header `X-Acceso-Token` de un token de empleada válido (sin sesión) responde `403 NO_AUTORIZADO`.
- **AC-8:** un POST a `/items-adicionales` con header `X-Acceso-Token` de empleada válido (sin sesión) responde `403 NO_AUTORIZADO`; un PUT y un DELETE a `/items-adicionales/{id}` con ese header también responden `403`.
- **AC-9 (backward-compat):** un PUT a `/configuracion` SIN header de token (flujo existente) sigue respondiendo `200` y persiste (no regresa los tests de Epic 3.1).

## Edge Cases (los que cambian comportamiento)
- **EC-1:** PUT a `/configuracion` con header `X-Acceso-Token` presente pero con un token **inválido** (no corresponde a ningún enlace activo) ⇒ `403 NO_AUTORIZADO` (presentó credencial de empleada que no autoriza escritura; no se trata como empleador).
- **EC-2:** `stripNotas` sobre un objeto sin la clave `notas` no falla y devuelve el objeto equivalente (para ambos roles).
- **EC-3:** el helper de strip no muta el objeto original (devuelve copia).

## Superficie de Código Existente (para el implementer)
- Llama a: `obtenerSesionEmpleador()` en `src/features/auth/application/session-reader.ts` — firma: `() => Promise<{ email: string | null } | null>`.
- Llama a: `buscarEmpleadorPorEmail(email)` en `src/features/auth/data/empleador-repository.ts` — firma: `(email: string) => Promise<Empleador | undefined>`.
- Llama a: `buscarEmpleadaPorEmpleador(empleadorId)` en `src/features/config/data/empleada-repository.ts` — firma: `(empleadorId: string) => Promise<Empleada | undefined>`.
- Llama a: el resolver de token de empleada creado en el spec hermano: `resolverEmpleadaPorToken(token: string)` en `src/features/auth/application/acceso-service.ts` — firma: `(token: string) => Promise<{ empleadaId: string; nombre: string } | null>` (devuelve `null` si el token es inválido/revocado). **Si el nombre exacto difiere, consúltalo en `acceso-service.ts`.**
- Llama a: `errorResponse(status, code, message)` en `src/features/config/application/api-error.ts`.
- Modifica (mínimamente, agregar guard de rol al inicio de cada handler de ESCRITURA): `src/app/api/v1/configuracion/route.ts` (PUT), `src/app/api/v1/empleada/route.ts` (PUT), `src/app/api/v1/items-adicionales/route.ts` (POST), `src/app/api/v1/items-adicionales/[id]/route.ts` (PUT, DELETE). El guard lee el header `X-Acceso-Token` de la `Request`; si hay token de empleada (presente) y NO hay sesión de empleador ⇒ `403 NO_AUTORIZADO` antes de tocar la aplicación. Sin token de empleada ⇒ procede como antes (backward-compat, BR-4). NO tocar los handlers GET (lectura permitida a ambos).
- Crea: `src/features/auth/authorize.ts` (o `role.ts`) con `resolverRol(request: Request)`, `esEmpleador`, `puedeEscribir`, y un guard de escritura reutilizable para los handlers (ej. `rechazarSiNoEmpleador(request): Promise<Response | null>` que devuelve la `Response` 403 o `null` si está permitido).
- Crea: helper `stripNotas` (en `authorize.ts` o un `notas.ts` del feature auth/config) que Epic 5.1 consumirá para la lectura de liquidación.
- Fixtures disponibles: `buildEmpleadaAggregate`, `setupTestDatabase/resetDatabase/teardownTestDatabase`, mock de `session-reader` como en `current-empleada.test.ts`. Para fabricar un token de empleada válido en los tests, usa el servicio de acceso del spec hermano (generar enlace) o inserta una fila `EnlaceAcceso` con el hash correspondiente.

### Nota HEALTH BAR (next build)
- Mantener la firma de `Request` como primer parámetro **requerido** en los handlers tocados (no opcional). El guard necesita la `Request` para leer el header, así que ya la usa.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
