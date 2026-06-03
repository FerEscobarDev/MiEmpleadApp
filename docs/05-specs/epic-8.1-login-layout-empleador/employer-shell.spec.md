# SPEC: Shell autenticado del empleador + gating de rutas + Inicio — id: epic-8.1-login-layout-empleador/employer-shell

**Epic:** [Epic 8.1 — Login y layout del empleador](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §5.1 (sesión Auth.js), §2.1 (cliente tipado UI→backend), navigation_map.md (layout autenticado)]

## Objetivo
Construir el layout autenticado del empleador que envuelve las rutas protegidas: una navegación (barra inferior en móvil / lateral en desktop) con las 6 secciones del mapa de navegación (Inicio, Configuración, Liquidar, Historial, Menú, Tareas) y un menú de usuario con "Cerrar sesión". El cierre de sesión consume `cerrarSesionEmpleador` (vía cliente tipado) y redirige a `/login`. El acceso a rutas protegidas se controla con `obtenerSesion`: una sesión no autenticada redirige a `/login`. Incluye una página `/` (Inicio) mínima como destino del login y para que el shell sea visible. Español (Colombia), mobile-first, accesible.

## Fuera de Scope (NO testear, NI implementar)
- El contenido rico del dashboard de Inicio (HU-15/HU-27, tarjeta del mes, banner de cumpleaños): basta un saludo + enlaces a las secciones o un placeholder claro.
- Las páginas de Configuración, Liquidar, Historial, Menú, Tareas (otros epics 8.x). El shell solo debe enlazarlas; no se implementan aquí.
- La página `/login` y su formulario (spec `login-page`).
- La zona de la empleada (`/consulta/[token]`).
- Estética pixel-perfect / modo oscuro afinado (gate visual del coordinador, no tests).

## Operaciones del Contrato de API
- **Consume** (frontend, vía cliente tipado `src/lib/api/client.ts`, nunca URL escrita a mano):
  - `obtenerSesion` (GET `/auth/sesion`, 200 `{ autenticado: boolean, email?: string|null }`) — para gating de rutas protegidas.
  - `cerrarSesionEmpleador` (POST `/auth/logout`, 204) — para "Cerrar sesión".

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Interacción del usuario: clic en un ítem de navegación (navega a su ruta); clic en "Cerrar sesión" (dispara `cerrarSesionEmpleador`). El gating recibe el resultado de `obtenerSesion`. |
| Salidas (éxito) | Shell renderiza los 6 ítems de navegación enlazados a `/`, `/configuracion`, `/liquidar`, `/historial`, `/menu`, `/tareas`. Logout: tras 204 navega a `/login`. Gating: `autenticado: true` ⇒ renderiza los hijos protegidos. |
| Salidas (error) | Gating con `autenticado: false` (o fallo de `obtenerSesion`) ⇒ redirige a `/login`, no renderiza el contenido protegido. |
| Efectos secundarios | El logout invalida la cookie de sesión en el backend (Auth.js); la UI no manipula cookies. |
| Idempotencia | `cerrarSesionEmpleador` es idempotente (sin sesión también responde 204); reintentar el logout es seguro. |

## Reglas de Negocio
- **BR-1 (RN-13):** Solo el empleador autenticado accede al shell y sus secciones; el acceso no autenticado se redirige a `/login`. — fuente: business_requirements.md §Reglas de Negocio (RN-13).
- **BR-2 (navegación):** El layout autenticado expone exactamente las 6 secciones del mapa: Inicio, Configuración, Liquidar, Historial, Menú, Tareas, más un control de "Cerrar sesión". — fuente: navigation_map.md §(Global) Layout autenticado del empleador.
- **BR-3 (responsividad):** Navegación inferior en móvil / lateral en desktop (mobile-first). — fuente: navigation_map.md, design_system.md §6.
- **BR-4 (idioma/a11y):** UI en español (Colombia); navegación accesible por teclado, foco visible, objetivos táctiles ≥44px, nombres accesibles en los enlaces. — fuente: conventions.md §8, design_system.md §6.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** El shell renderiza una región de navegación (`role="navigation"`) con exactamente 6 enlaces cuyos nombres accesibles son "Inicio", "Configuración", "Liquidar", "Historial", "Menú", "Tareas", apuntando respectivamente a `/`, `/configuracion`, `/liquidar`, `/historial`, `/menu`, `/tareas`.
- **AC-2:** El shell renderiza un control accesible "Cerrar sesión" (botón con nombre accesible "Cerrar sesión").
- **AC-3:** Al activar "Cerrar sesión" se invoca la operación `cerrarSesionEmpleador` del cliente tipado exactamente una vez (fetch mockeado; sin servidor).
- **AC-4:** Tras un logout exitoso (204) la UI navega a `/login` (mediante el `useRouter().push`/`replace` mockeado).
- **AC-5 (gating):** El guard de rutas protegidas, al recibir de `obtenerSesion` un `{ autenticado: false }`, redirige a `/login` y no renderiza el contenido protegido que envuelve.
- **AC-6 (gating):** El guard, al recibir `{ autenticado: true }`, renderiza el contenido protegido (sus hijos).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Si `obtenerSesion` falla (rechazo de red o status ≠ 200) el guard trata la sesión como NO autenticada y redirige a `/login` (no muestra contenido protegido a un usuario sin sesión verificada).
- **EC-2:** Un logout que falle (status ≠ 204) no debe dejar al usuario en un estado roto: igualmente navega a `/login` (la cookie se invalida en el servidor; el destino seguro es la pantalla de acceso).

## Superficie de Código Existente (para el implementer)
- Llama a: `apiClient` en `src/lib/api/client.ts` — `apiClient.GET("/auth/sesion")` ⇒ `{ data: { autenticado, email? }, error, response }`; `apiClient.POST("/auth/logout")` ⇒ 204. Paths tipados en `src/lib/api/schema.d.ts` (`operations["obtenerSesion"]`, `operations["cerrarSesionEmpleador"]`).
- Navegación interna: `Link` de `next/link` para los ítems de navegación; `useRouter` de `next/navigation` (`push(href)`) para el redirect de logout y del guard. Componentes cliente marcados `"use client"`.
- Usa componentes: `Button` en `src/components/ui/Button.tsx` (para "Cerrar sesión"); opcionalmente `Avatar`/`AvatarFallback` en `src/components/ui/Avatar.tsx` para el menú de usuario. Íconos de `lucide-react` permitidos con `aria-hidden`/`aria-label`.
- Crea:
  - `src/app/(employer)/layout.tsx` — layout del grupo de rutas protegidas; envuelve sus hijos con el guard de sesión y el shell de navegación. Las rutas de las secciones (configuracion, liquidar, etc.) vivirán bajo este grupo en epics posteriores; en este epic basta `/` (Inicio).
  - `src/app/(employer)/page.tsx` — Inicio mínimo (route `/`): saludo + enlaces a las secciones (o placeholder claro). Reemplaza/absorbe el `src/app/page.tsx` placeholder actual (mover `/` a este grupo para que quede protegido).
  - `src/components/shell/EmployerNav.tsx` — la navegación (6 ítems) reutilizable y testeable. Tests: `src/components/shell/EmployerNav.test.tsx`.
  - `src/components/shell/EmployerShell.tsx` — compone nav + menú de usuario con "Cerrar sesión" (Client Component que consume el cliente tipado). Tests: `src/components/shell/EmployerShell.test.tsx`.
  - `src/components/shell/SessionGuard.tsx` — Client Component que consume `obtenerSesion` vía cliente tipado, redirige a `/login` si no autenticado, y renderiza hijos si autenticado. Tests: `src/components/shell/SessionGuard.test.tsx`.
- Nota de arquitectura: el `(employer)` route group ya está previsto en conventions.md §2 (`src/app/(employer)/` para rutas del empleador). El placeholder `src/app/page.tsx` existente se reubica dentro del grupo para quedar protegido por el guard; el destino del login (`/`) sigue siendo la misma URL.
- Patrón de mock en tests existente: `vi.stubGlobal("fetch", fetchMock)` con respuestas `new Response(...)` (ver `src/lib/api/client.test.ts`). Para `next/navigation`: `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))`. Para `next/link` en jsdom se renderiza como `<a href>` (nombre accesible = texto/`aria-label`).

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.*
