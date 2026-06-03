# SPEC: Sesión del empleador (Auth.js) + costura de identidad — id: epic-4.1-auth-empleador/auth-sesion-y-costura

**Epic:** [Epic 4.1 — Autenticación del empleador (Auth.js)](../../04-roadmap/ROADMAP.md)   **Módulo:** [§2.6 Autenticación y Acceso](../../02-architecture/architecture.md#26-autenticación-y-acceso-authjs--token-de-empleada), [§5.1](../../02-architecture/architecture.md#51-autenticación-y-autorización)

## Objetivo

Cablear la sesión del empleador con Auth.js (NextAuth v5, App Router, provider de credenciales que reutiliza `authorizeEmpleador`) y exponer las operaciones del contrato `iniciarSesionEmpleador`, `cerrarSesionEmpleador` y `obtenerSesion` como Route Handlers delgados que respetan exactamente paths/shapes/códigos del contrato y el envelope de error único. Además, cablear la costura de autenticación `getCurrentEmpleadaId()` para que, cuando exista una sesión válida de empleador, resuelva la empleada de **ese** empleador, manteniendo compatibilidad con los tests existentes que corren sin sesión (single-tenant fallback).

## Fuera de Scope (NO testear, NO implementar)

- El hashing/verificación de contraseña y la lógica `authorizeEmpleador`/`crearCuentaEmpleador` (spec hermano `auth-empleador-credenciales`, ya implementado y disponible).
- La autorización por rol en endpoints de escritura (rechazar a la empleada con 403): es Epic 4.2. Aquí NO se añade ningún chequeo de rol a los handlers de config existentes.
- El token/enlace de la empleada (Epic 4.2).
- Tests end-to-end que levanten toda la maquinaria de cookies de Auth.js a través de HTTP real: son frágiles. Se prueba la **lógica** de resolución de sesión (lectura de la sesión → DTO) y de la costura mediante una costura de lectura de sesión inyectable/mockeable, no el ciclo completo de cookies. Documentar la cobertura.

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)

- **Implementa** (backend): `iniciarSesionEmpleador` (POST `/auth/login`), `cerrarSesionEmpleador` (POST `/auth/logout`), `obtenerSesion` (GET `/auth/sesion`).
- Shapes según `docs/02-architecture/api-contract.md` §3 y `api-contract.openapi.yaml` (NO se redefinen aquí):
  - `iniciarSesionEmpleador`: request `{ email, password }`; éxito **204** (cookie de sesión establecida); credenciales inválidas **401** con el envelope de error único.
  - `cerrarSesionEmpleador`: sin body; éxito **204** (cookie eliminada). Idempotente.
  - `obtenerSesion`: éxito **200** con `{ autenticado: boolean, email?: string|null }`. (Decisión de reconciliación: a diferencia de la fila genérica del contrato que marca 401, `obtenerSesion` se usa por el layout del empleador como sonda de sesión y por tanto responde **200 `{ autenticado:false }`** cuando NO hay sesión, en vez de 401 — ver "Nota de reconciliación".)

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `iniciarSesionEmpleador`: POST JSON `{ email: string, password: string }`. `cerrarSesionEmpleador`: POST sin body. `obtenerSesion`: GET sin body. |
| Salidas (éxito) | login → `204` sin cuerpo. logout → `204` sin cuerpo. sesion → `200` `{ autenticado, email? }`. |
| Salidas (error) | login con credenciales inválidas → `401` `{ code: "NO_AUTORIZADO", message }`. login con body inválido (falta email/password o JSON roto) → `422` `{ code: "VALIDACION", ... }`. Fallo inesperado → `500` `{ code: "ERROR_INTERNO", ... }` sin filtrar internals. |
| Efectos secundarios | login válido establece la cookie de sesión de Auth.js; logout la elimina. sesion no escribe. Nunca se loguean credenciales (architecture.md §5.2). |
| Idempotencia | login: no. logout: sí (sin sesión → igualmente 204). sesion: sí. |

## Nota de reconciliación (contrato ↔ Auth.js)

`obtenerSesion` resuelve la sesión actual de Auth.js y la traduce al shape `{ autenticado, email? }`. Como es la sonda que el layout del empleador usa para saber si hay sesión, devuelve **200 con `autenticado:false`** cuando no hay sesión (no 401). El `securityScheme sesionEmpleador` del contrato es exactamente la cookie que gestiona Auth.js. `iniciarSesionEmpleador`/`cerrarSesionEmpleador` son handlers delgados que envuelven `signIn("credentials", ...)` / `signOut` de Auth.js para que la superficie del contrato (paths/códigos) sea exactamente la especificada, conservando el envelope de error único en los handlers propios.

## Reglas de Negocio

- **BR-1:** La sesión del empleador la gestiona Auth.js mediante cookie de sesión (architecture.md §2.6, §5.1). El `securityScheme` `sesionEmpleador` del contrato ES esa cookie. — fuente: architecture.md §2.6/§5.1, api-contract §1.
- **BR-2:** Credenciales inválidas en login → `401` con `code: NO_AUTORIZADO`; nunca se revela si fue el email o la contraseña. — fuente: api-contract §3 (`iniciarSesionEmpleador` 401), architecture.md §5.1.
- **BR-3:** La costura `getCurrentEmpleadaId()`, cuando hay sesión de empleador válida, resuelve la empleada **de ese empleador** (identidad real). Sin sesión (contexto de test / consulta de empleada aún no implementada en Epic 4.2), mantiene el fallback single-tenant a la única empleada existente para no romper los 132 tests existentes ni los endpoints de config. — fuente: architecture.md §2.6, RN-13, current-empleada.ts (TODO Epic 4.2).
- **BR-4:** Nunca se loguean credenciales ni el `passwordHash`. — fuente: architecture.md §5.2.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `obtenerSesion` (handler GET) con una sesión válida (empleador autenticado, costura de lectura de sesión retorna su email) responde **200** con `{ autenticado: true, email: <email del empleador> }`.
- **AC-2:** `obtenerSesion` sin sesión (costura de lectura retorna `null`) responde **200** con `{ autenticado: false }` (sin `email`, o `email: null`).
- **AC-3:** `mapSesionADto(session)` (la función pura que traduce la sesión de Auth.js al DTO del contrato) mapea una sesión con `user.email` a `{ autenticado: true, email }`, y `null`/sesión sin usuario a `{ autenticado: false }`.
- **AC-4:** `iniciarSesionEmpleador` (handler POST) con body sin `email` o sin `password`, o con JSON malformado, responde **422** `{ code: "VALIDACION" }` (no 500, no 401), **sin** invocar la maquinaria de sign-in.
- **AC-5:** `iniciarSesionEmpleador` con credenciales inválidas responde **401** `{ code: "NO_AUTORIZADO" }`. (El sign-in subyacente, inyectado/mockeado, falla.)
- **AC-6:** `iniciarSesionEmpleador` con credenciales válidas responde **204** sin cuerpo. (El sign-in subyacente, inyectado/mockeado, tiene éxito.)
- **AC-7:** `cerrarSesionEmpleador` responde **204** (invoca el sign-out subyacente); es idempotente (sin sesión también 204).
- **AC-8 (costura, con sesión):** `getCurrentEmpleadaId()`, cuando la costura de lectura de sesión resuelve a un empleador que **tiene** empleada, retorna el `id` de la empleada **de ese empleador** (no necesariamente la primera de la base si hay varias cuentas).
- **AC-9 (costura, sin sesión — backward-compat):** `getCurrentEmpleadaId()` sin sesión retorna el `id` de la única empleada existente (fallback single-tenant), exactamente como hoy; lanza `EmpleadaNoResueltaError` si no hay ninguna.
- **AC-10:** La suite completa existente sigue verde tras el cambio de la costura (los tests de `configuracion`/`empleada`/`items-adicionales` que corren sin sesión siguen pasando vía el fallback). *(Se valida en Step 7 corriendo `npm test`; no requiere un test nuevo dedicado, pero es criterio de aceptación del epic.)*

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** `obtenerSesion` cuando la sesión existe pero su `user.email` es `null`/ausente → `{ autenticado: true, email: null }` (autenticado pero sin email expuesto). Alternativamente, si la sesión es `null`, `autenticado:false`. La distinción la define `mapSesionADto`.
- **EC-2:** Costura con sesión cuyo empleador **no** tiene empleada (caso teórico, no debería ocurrir tras bootstrap) → lanza `EmpleadaNoResueltaError` (no retorna un id de otra cuenta).
- **EC-3:** `cerrarSesionEmpleador` llamado sin sesión activa → **204** (idempotente), no error.

## Superficie de Código Existente (para el implementer — lo llena el orquestador en Step 2)

- Llama a: `authorizeEmpleador(credenciales: { email: string; password: string }): Promise<{ id: string; email: string } | null>` en `src/features/auth/application/auth-service.ts` (spec hermano).
- Llama a: `buscarEmpleadorPorEmail(email): Promise<Empleador | undefined>` en `src/features/auth/data/empleador-repository.ts` (spec hermano) — para resolver la empleada del empleador de la sesión.
- Llama a: `buscarPrimeraEmpleadaId(): Promise<string | undefined>` en `src/features/config/data/empleada-repository.ts` — firma actual; es el fallback single-tenant. Y `buscarEmpleadaPorEmpleador(empleadorId: string): Promise<Empleada | undefined>` en el mismo archivo (ya existe) para resolver la empleada por empleador.
- Modifica: `src/features/auth/current-empleada.ts` — funciones actuales: `getCurrentEmpleadaId(): Promise<string>` y `class EmpleadaNoResueltaError extends Error`. Debe consultar primero una costura de lectura de sesión; si hay empleador autenticado, resolver su empleada por `empleadorId`; si no, mantener el fallback `buscarPrimeraEmpleadaId()`. **Mantener la firma pública `getCurrentEmpleadaId(): Promise<string>` y `EmpleadaNoResueltaError` intactas** (las usan los Route Handlers de config existentes).
- Crea: configuración de Auth.js en `src/features/auth/auth.ts` (NextAuth v5): `export const { auth, handlers, signIn, signOut } = NextAuth({ providers: [Credentials({...authorize → authorizeEmpleador})], session: { strategy: "jwt" }, ... })`. Usa `AUTH_SECRET` del entorno. La `authorize` del provider delega en `authorizeEmpleador`. Mantener este archivo y los handlers ≤300 líneas (conventions.md §2).
- Crea: Route Handler de Auth.js en `src/app/api/auth/[...nextauth]/route.ts` → `export const { GET, POST } = handlers`. (Endpoints internos de Auth.js; NO confundir con los del contrato.)
- Crea: una **costura de lectura de sesión** fina y mockeable, p.ej. `obtenerSesionEmpleador(): Promise<{ email: string | null } | null>` en `src/features/auth/application/session-reader.ts`, que en runtime invoca `auth()` de Auth.js. La costura existe para que `obtenerSesion`, `getCurrentEmpleadaId` y sus tests no dependan de la maquinaria de cookies. (Inyectable por parámetro o mockeable con `vi.mock`.)
- Crea: `mapSesionADto(session): { autenticado: boolean; email?: string | null }` (función pura) en `src/features/auth/application/session-dto.ts`.
- Crea: Route Handlers del contrato:
  - `src/app/api/v1/auth/login/route.ts` → `POST` (valida `{email,password}` con Zod; envuelve `signIn`; 204/401/422/500). Reutiliza `errorResponse`/`validationErrorResponse` de `src/features/config/application/api-error.ts`.
  - `src/app/api/v1/auth/logout/route.ts` → `POST` (envuelve `signOut`; 204).
  - `src/app/api/v1/auth/sesion/route.ts` → `GET` (lee la costura de sesión; `mapSesionADto`; 200).
- Reutiliza: `errorResponse(status, code, message, details?)`, `validationErrorResponse(details)`, `CODE_VALIDACION = "VALIDACION"` en `src/features/config/application/api-error.ts`. Código de negocio para 401: `NO_AUTORIZADO`.
- Añade dependencia: `next-auth@beta` (NextAuth v5, compatible con Next 15 App Router). `AUTH_SECRET` documentado en `.env.example`.
- Fixtures disponibles: `buildEmpleadaAggregate({ email, passwordHash })`, `setupTestDatabase`/`resetDatabase`/`teardownTestDatabase`. NO duplicar.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
