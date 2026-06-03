# SPEC: Credenciales del empleador (hash + verificación + authorize) — id: epic-4.1-auth-empleador/auth-empleador-credenciales

**Epic:** [Epic 4.1 — Autenticación del empleador (Auth.js)](../../04-roadmap/ROADMAP.md)   **Módulo:** [§2.6 Autenticación y Acceso](../../02-architecture/architecture.md#26-autenticación-y-acceso-authjs--token-de-empleada)

## Objetivo

Establecer el núcleo verificable de la autenticación del empleador: el hashing seguro de la contraseña, su verificación, y la lógica de `authorize` que, dadas unas credenciales (email + contraseña), resuelve la identidad del empleador o la rechaza. Incluye el repositorio para buscar al empleador por email y un script de bootstrap para crear la cuenta del empleador (single-tenant), ya que no existe registro público (RN-13: solo el empleador escribe; no hay auto-registro).

## Fuera de Scope (NO testear, NO implementar)

- La configuración de Auth.js (NextAuth), los Route Handlers HTTP de `/auth/login`, `/auth/logout`, `/auth/sesion`, y la cookie de sesión (eso es el spec hermano `auth-sesion-y-costura`).
- El cableado de la costura `getCurrentEmpleadaId()` a la sesión (spec hermano).
- La autorización por rol en los endpoints de escritura (rechazar a la empleada): es Epic 4.2.
- El acceso de la empleada por token/enlace (Epic 4.2).
- Cualquier UI de login (Milestone 8).

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)

- **N/A — lógica interna.** Este spec implementa la capa de aplicación y persistencia (hashing, verificación, `authorize`, búsqueda por email, bootstrap). El boundary HTTP de las operaciones `iniciarSesionEmpleador`, `cerrarSesionEmpleador`, `obtenerSesion` se cablea en el spec hermano.

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `hashPassword(plain: string)`; `verifyPassword(plain: string, hash: string)`; `authorizeEmpleador({ email: string, password: string })`; `buscarEmpleadorPorEmail(email: string)`; `crearCuentaEmpleador(input)` |
| Salidas (éxito) | `hashPassword` → `string` (hash distinto del texto plano). `verifyPassword` → `boolean`. `authorizeEmpleador` → identidad `{ id: string, email: string }` cuando las credenciales son válidas; `null` cuando son inválidas. `buscarEmpleadorPorEmail` → `Empleador \| undefined`. |
| Salidas (error) | Credenciales inválidas (email inexistente o contraseña que no verifica) → `authorizeEmpleador` retorna `null` (NO lanza). Fallos de infraestructura (DB caída) → propagan excepción (no se capturan aquí). |
| Efectos secundarios | `crearCuentaEmpleador` persiste un `Empleador` (con su `Empleada` + `Configuracion` por defecto, reutilizando el repositorio existente). `hashPassword`/`verifyPassword`/`authorizeEmpleador` no escriben. |
| Idempotencia | `hashPassword` NO es determinista (salt aleatorio): dos hashes del mismo texto difieren pero ambos verifican. `authorizeEmpleador`/`verifyPassword` son funciones de solo lectura, idempotentes. |

## Reglas de Negocio

- **BR-1:** La contraseña del empleador se almacena como **hash**, nunca en texto plano (architecture.md §4: `Empleador.passwordHash`; §5.2: nunca se loguean credenciales). — fuente: architecture.md §4, §5.2.
- **BR-2:** Solo existe la cuenta del **empleador**; no hay auto-registro público. La cuenta se crea por un mecanismo de bootstrap controlado (seed/script), no por un endpoint expuesto. — fuente: business_requirements.md (Actores: "sin registro propio" aplica a la empleada; el empleador es "Dueño de la cuenta"), RN-13.
- **BR-3:** La verificación de credenciales es binaria: o las credenciales corresponden a un empleador existente y la contraseña verifica (éxito), o no (fallo, sin distinguir entre "email no existe" y "contraseña incorrecta" hacia el llamador — ambos producen `null`). — fuente: architecture.md §5.1.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** `hashPassword(plain)` retorna un string que **no** es igual al texto plano y que **no** lo contiene literalmente.
- **AC-2:** `verifyPassword(plain, hashPassword(plain))` retorna `true`.
- **AC-3:** `verifyPassword(otroTexto, hashPassword(plain))` (contraseña incorrecta) retorna `false`.
- **AC-4:** Dos invocaciones de `hashPassword(plain)` con el mismo texto producen hashes **distintos** (salt), y **ambos** verifican `true` contra el texto original.
- **AC-5:** `buscarEmpleadorPorEmail(email)` retorna el `Empleador` cuando existe (incluye `id`, `email`, `passwordHash`) y `undefined` cuando no existe.
- **AC-6:** `authorizeEmpleador({ email, password })` con credenciales válidas (empleador existente cuya contraseña verifica) retorna una identidad `{ id, email }` con el `id` y el `email` correctos del empleador.
- **AC-7:** `authorizeEmpleador` con email **inexistente** retorna `null`.
- **AC-8:** `authorizeEmpleador` con email existente pero **contraseña incorrecta** retorna `null`.
- **AC-9:** `crearCuentaEmpleador({ email, password, ...ficha/config })` persiste un empleador cuyo `passwordHash` **no** es el texto plano y verifica `true` contra la contraseña dada; y deja resoluble al empleador vía `buscarEmpleadorPorEmail`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** `authorizeEmpleador` con `email` o `password` vacío (`""`) → `null` (no hay empleador con email vacío / no verifica). No lanza.
- **EC-2:** El `email` se compara tal como está almacenado; el bootstrap y la búsqueda usan el mismo email. (No se exige normalización de mayúsculas en este spec; documentarlo como fuera de scope si surge.)
- **EC-3:** `verifyPassword(plain, hashInvalido)` con un hash con formato no válido → retorna `false` (no lanza una excepción que tumbe el flujo de login).

## Superficie de Código Existente (para el implementer — lo llena el orquestador en Step 2)

- Llama a: `crearEmpleadorConEmpleada(input: CrearEmpleadorConEmpleadaInput): Promise<EmpleadorConEmpleada>` en `src/features/config/data/empleada-repository.ts`.
  - `CrearEmpleadorConEmpleadaInput = { email: string; passwordHash: string; nombre: string; fechaNacimiento: Date; fechaInicioContrato: Date; fechaFinContrato?: Date | null; salarioBase: number; diasLaborales: string[] }`.
  - `EmpleadorConEmpleada = { empleador: Empleador; empleada: Empleada; configuracion: Configuracion }`.
- Llama a: `db` (cliente Prisma único) en `src/lib/db.ts` — firma: `export const db: PrismaClient`. Modelo: `db.empleador.findUnique({ where: { email } })`. `Empleador` Prisma: `{ id: string; email: string; passwordHash: string }`.
- Crea: `hashPassword(plain: string): Promise<string>` y `verifyPassword(plain: string, hash: string): Promise<boolean>` en `src/features/auth/password.ts` (usar **bcryptjs** — librería pura JS aprobada en la guía; añadir dependencia `bcryptjs` + `@types/bcryptjs`).
- Crea: `buscarEmpleadorPorEmail(email: string): Promise<Empleador | undefined>` en `src/features/auth/data/empleador-repository.ts` (capa de persistencia; único acceso a Prisma de auth — architecture.md §2.6/§6).
- Crea: `authorizeEmpleador(credenciales: { email: string; password: string }): Promise<EmpleadorIdentidad | null>` con `EmpleadorIdentidad = { id: string; email: string }`, en `src/features/auth/application/auth-service.ts`.
- Crea: `crearCuentaEmpleador(input): Promise<{ empleador, empleada, configuracion }>` en `src/features/auth/application/auth-service.ts` (hashea la contraseña y delega en `crearEmpleadorConEmpleada`). Firma sugerida del input: `{ email: string; password: string; nombre?: string; fechaNacimiento?: Date; fechaInicioContrato?: Date; fechaFinContrato?: Date | null; salarioBase?: number; diasLaborales?: string[] }` con defaults sensatos (RN-18 salario 700000) para el bootstrap.
- Crea: script de bootstrap `scripts/seed-empleador.ts` invocable vía `npm run seed:empleador`, que lee `EMPLEADOR_EMAIL` y `EMPLEADOR_PASSWORD` del entorno y llama a `crearCuentaEmpleador`. Documentar en `.env.example`. (El script en sí no necesita test unitario; la lógica testeable vive en `crearCuentaEmpleador`.)
- Fixtures disponibles: `buildEmpleadaAggregate(overrides)` en `src/lib/test/factories.ts` (crea empleador+empleada+config; acepta `email`, `passwordHash` overrides). `setupTestDatabase`/`resetDatabase`/`teardownTestDatabase` en `src/lib/test/db-test-setup.ts`. NO duplicar.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
