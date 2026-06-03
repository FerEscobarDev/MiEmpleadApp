# SPEC: Página de login del empleador — id: epic-8.1-login-layout-empleador/login-page

**Epic:** [Epic 8.1 — Login y layout del empleador](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §5.1 (sesión Auth.js), §2.1 (cliente tipado UI→backend)]

## Objetivo
Construir la pantalla `/login` donde el empleador inicia sesión con email y contraseña. El formulario autentica consumiendo la operación del contrato `iniciarSesionEmpleador` a través del cliente tipado; al iniciar sesión correctamente redirige a `/` (Inicio); con credenciales inválidas (401) muestra un error en línea sin revelar qué campo falló; mientras envía muestra estado de carga. Español (Colombia), mobile-first, accesible.

## Fuera de Scope (NO testear, NO implementar)
- El layout autenticado, la navegación y el cierre de sesión (van en el spec `employer-shell`).
- La página `/` (Inicio) más allá de ser el destino de la redirección (la crea el spec `employer-shell`).
- Recuperación de contraseña, registro/auto-registro (no existe: single-tenant, RN-13), "recordarme".
- Validación de formato de email/longitud de contraseña en el cliente más allá de `required` del navegador (la frontera valida en el backend; el caso de credenciales inválidas se cubre con el 401).
- Estilos pixel-perfect / estética (se valida en el gate visual del coordinador, no en tests).

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado `src/lib/api/client.ts`, nunca URL escrita a mano): `iniciarSesionEmpleador` (POST `/auth/login`, 204 al iniciar sesión, 401 `NO_AUTORIZADO` con credenciales inválidas).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `email`: string (campo de formulario, `type=email`, requerido); `password`: string (campo de formulario, `type=password`, requerido) |
| Salidas (éxito) | El POST a `iniciarSesionEmpleador` responde 204 (sin cuerpo) → la UI navega a `/` |
| Salidas (error) | 401 `NO_AUTORIZADO` → mensaje en línea "Credenciales inválidas." asociado al formulario; cualquier otro fallo de red/servidor → mensaje genérico "No pudimos iniciar sesión. Intenta de nuevo." |
| Efectos secundarios | El handler del backend establece la cookie de sesión (Auth.js). La UI no manipula cookies directamente. |
| Idempotencia | El envío es disparado por el usuario; reintentar tras un error es seguro (vuelve a llamar `iniciarSesionEmpleador`). |

## Reglas de Negocio
- **BR-1 (HU-01):** El empleador inicia sesión con email + contraseña. — fuente: business_requirements.md §Historias de Usuario (HU-01).
- **BR-2 (RN-13):** Solo el empleador tiene cuenta y credenciales; no hay registro público desde esta pantalla. — fuente: business_requirements.md §Reglas de Negocio (RN-13).
- **BR-3 (seguridad):** El mensaje de error de credenciales inválidas no revela si falló el email o la contraseña. — fuente: architecture.md §5.1.
- **BR-4 (idioma):** Toda la UI en español (Colombia). — fuente: conventions.md §8.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** La página renderiza un formulario accesible con un campo de email (etiqueta "Correo electrónico", `type=email`), un campo de contraseña (etiqueta "Contraseña", `type=password`) y un botón de envío con nombre accesible "Entrar".
- **AC-2:** Al completar email y contraseña y enviar, se invoca la operación `iniciarSesionEmpleador` del cliente tipado **exactamente una vez** con el email y la contraseña ingresados (el test mockea el `fetch` global / el cliente tipado; no se levanta servidor).
- **AC-3:** Tras un envío exitoso (204), la UI navega a `/` (se verifica con un `useRouter().push`/`replace` mockeado, o el mecanismo de navegación inyectado, llamado con `/`).
- **AC-4:** Si la operación responde 401 `NO_AUTORIZADO`, se muestra un mensaje de error en línea con el texto "Credenciales inválidas." asociado accesiblemente al formulario (`role="alert"` o `aria-describedby`/`aria-live`), y NO se navega.
- **AC-5:** Mientras la petición está en curso, el botón de envío queda deshabilitado y comunica el estado de carga (`aria-busy="true"`), evitando envíos duplicados.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Un fallo de red/servidor (rechazo del fetch o status ≠ 204/401, p.ej. 500) → muestra el mensaje genérico "No pudimos iniciar sesión. Intenta de nuevo." y NO navega.
- **EC-2:** Reintentar tras un error (volver a enviar con credenciales correctas) limpia el error previo y procede normalmente.

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient` en `src/lib/api/client.ts` — uso: `apiClient.POST("/auth/login", { body: { email, password } })`; devuelve `{ data, error, response }` (openapi-fetch). El path `/auth/login` está tipado en `src/lib/api/schema.d.ts` (`operations["iniciarSesionEmpleador"]`); 204 ⇒ `error` ausente y `response.status === 204`; 401 ⇒ `error` presente y `response.status === 401`.
- Usa componentes: `Button` en `src/components/ui/Button.tsx` — props: `variant`, `size`, `loading` (deshabilita + `aria-busy`), estándar de `button`. `Input` en `src/components/ui/Input.tsx` — props: `label`, `helperText`, `error`, `type`, `id`, más props nativas de `<input>`. `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter` en `src/components/ui/Card.tsx`.
- Navegación: `useRouter` de `next/navigation` (App Router) — método `push(href)`. La página es un Client Component (`"use client"`).
- Crea: `src/app/login/page.tsx` (route `/login`) y el componente de formulario `src/app/login/login-form.tsx` (Client Component testeable con RTL). Tests co-localizados: `src/app/login/login-form.test.tsx`.
- Patrón de mock en tests existente: `vi.stubGlobal("fetch", fetchMock)` con `fetchMock.mockResolvedValue(new Response(...))` (ver `src/lib/api/client.test.ts`). Para mockear `useRouter`: `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
