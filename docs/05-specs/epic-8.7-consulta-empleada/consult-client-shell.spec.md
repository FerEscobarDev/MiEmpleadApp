# SPEC: Cliente de consulta + shell por token — id: epic-8.7-consulta-empleada/consult-client-shell

**Epic:** Epic 8.7 (ROADMAP Milestone 8)   **Módulo:** architecture.md §2.1 (cliente tipado UI), §2.2 (frontera acceso), §2.6 (autorización por rol)

## Objetivo
Construir la ruta pública por token `/consulta/[token]` (fuera del grupo `(employer)`, sin SessionGuard) y un mecanismo limpio para que el cliente tipado envíe el header `X-Acceso-Token` en TODAS las peticiones de consulta. Al entrar se valida el token (`validarAccesoEmpleada`); si es inválido/revocado se muestra una pantalla amable; si es válido se carga la ficha (`obtenerEmpleada`) y se renderiza el shell de consulta: encabezado con nombre + Avatar + BirthdayBanner (RN-20) y las pestañas Pago / Menú / Tareas (vacías en este spec — el contenido lo aportan los specs B y C).

## Fuera de Scope (NO testear, NO implementar)
- El contenido funcional de las pestañas Pago, Menú y Tareas (specs B y C). Aquí las pestañas existen y conmutan, pero su cuerpo es un placeholder que los specs B/C reemplazan.
- Cualquier cambio en el backend (las operaciones y el strip de notas ya existen, Epic 4.2/5.1/6.x). Este epic es solo frontend.
- Generación/registro de Service Worker, PWA install, deep-linking nativo.
- La lógica de "cuántos días faltan" para el cumpleaños: el banner se muestra solo si la fecha de nacimiento cae HOY (mismo mes y día); no se calcula "en N días" en este spec.

## Operaciones del Contrato de API
> Referencia por `operationId` de `docs/02-architecture/api-contract.md`. El contrato es la fuente de verdad; no se redefine el shape aquí.
- **Consume** (frontend, vía cliente tipado, NUNCA URL a mano):
  - `validarAccesoEmpleada` — `GET /acceso/validar` (header `X-Acceso-Token`).
  - `obtenerEmpleada` — `GET /empleada` (header `X-Acceso-Token`).

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `token`: string (segmento de ruta `/consulta/[token]`) |
| Salidas (éxito) | `validarAccesoEmpleada` → `ContextoEmpleada { nombre, valido }` (200). `obtenerEmpleada` → `Empleada { nombre, fechaNacimiento, fechaInicioContrato, fechaFinContrato? }` (200) |
| Salidas (error) | token ausente/ inválido/ revocado → `validarAccesoEmpleada` responde 401 `ACCESO_INVALIDO` → la UI muestra la pantalla "enlace inválido o revocado" |
| Efectos secundarios | Ninguno (lecturas). El header `X-Acceso-Token` se adjunta a cada petición de consulta. |
| Idempotencia | Sí (solo lecturas). |

## Reglas de Negocio
- **BR-1 (RN-13):** La vista de consulta es de SOLO LECTURA salvo marcar tareas (spec C); no expone ninguna acción de escritura del empleador. — fuente: business_requirements.md §Reglas de Negocio (RN-13).
- **BR-2 (HU-03):** El acceso de la empleada es por enlace/token, no por sesión de empleador. La autenticación se realiza enviando el token en el header `X-Acceso-Token`. — fuente: business_requirements.md HU-03; api-contract `accesoEmpleada` securityScheme.
- **BR-3 (RN-20):** A partir de `fechaNacimiento` de la empleada, se destaca su cumpleaños cuando la fecha de hoy coincide en mes y día. — fuente: business_requirements.md §Reglas de Negocio (RN-20), HU-27.
- **BR-4 (RN-12):** La vista de consulta NUNCA muestra las notas del mes; este spec no carga liquidación, pero el shell no debe exponer ningún campo de notas. — fuente: business_requirements.md §Reglas de Negocio (RN-12).

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Al montar `/consulta/[token]`, la página llama a `validarAccesoEmpleada` (GET `/acceso/validar`) enviando el header `X-Acceso-Token` con el token de la ruta. (Aserción sobre el header de la petición mockeada.)
- **AC-2:** Si `validarAccesoEmpleada` responde 401, la página muestra una pantalla amable de "enlace inválido o revocado" (texto en español) y NO renderiza las pestañas.
- **AC-3:** Si `validarAccesoEmpleada` responde 200 (token válido), la página carga `obtenerEmpleada` (también con el header `X-Acceso-Token`) y renderiza el shell: el nombre de la empleada, un Avatar, y las pestañas Pago / Menú / Tareas.
- **AC-4:** Mientras valida el token, la página muestra un estado de carga (no las pestañas ni la pantalla de error).
- **AC-5:** El header `X-Acceso-Token` se inyecta vía el cliente tipado (no URL a mano): toda petición emitida por el contexto de consulta lleva ese header con el valor del token. (Aserción: las dos llamadas — validar y empleada — contienen el header.)
- **AC-6:** Si la fecha de nacimiento de la empleada coincide con la fecha de hoy (mes y día), se muestra el BirthdayBanner con su nombre; si no coincide, no se muestra. (La fecha "hoy" debe ser inyectable para testabilidad — sin `Date.now()` oculto, conventions.md §3/§7.)
- **AC-7 (a11y):** El conmutador de pestañas es accesible por teclado (roles `tab`/`tablist`/`tabpanel`, vía el componente Tabs del DS) y la pantalla de error tiene un encabezado legible.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Token presente en la ruta pero `validarAccesoEmpleada` devuelve 401 → pantalla de error, sin pestañas. (Mismo flujo que token revocado.)
- **EC-2:** `obtenerEmpleada` falla (500) tras un token válido → se muestra un estado de error amable de carga de la ficha (no se cae la app, no Skeleton infinito).
- **EC-3:** `fechaNacimiento` con año distinto al actual pero mismo mes y día que hoy → SÍ se muestra el banner (cumpleaños se compara por mes+día, no por año).

## Superficie de Código Existente (para el implementer)
- Cliente tipado: `apiClient` en `src/lib/api/client.ts` — firma: `apiClient.GET("/acceso/validar", { headers?: Record<string,string> })`, `apiClient.GET("/empleada", { headers?: Record<string,string> })`. openapi-fetch (v0.17) soporta la opción `headers` por llamada y `apiClient.use(middleware)` con `onRequest({ request })`. El `fetch` se resuelve en cada llamada (testeable con `vi.stubGlobal("fetch", ...)`).
- Tipos del contrato: `components["schemas"]["ContextoEmpleada"]`, `components["schemas"]["Empleada"]` en `src/lib/api/schema` (`@/lib/api/schema`).
- Componentes DS a reusar: `Tabs, TabsList, TabsTrigger, TabsContent` en `@/components/ui/Tabs`; `Avatar, AvatarFallback` en `@/components/ui/Avatar`; `BirthdayBanner` en `@/components/domain/BirthdayBanner` — firma: `BirthdayBanner({ nombre: string, cuando?: string, className?: string })`; `Skeleton` en `@/components/ui/Skeleton`; `EmptyState` en `@/components/ui/EmptyState`.
- Crea: la ruta `src/app/consulta/[token]/page.tsx` (Server Component que lee el `token` de params y lo pasa al cliente); el componente cliente del shell (p. ej. `src/app/consulta/[token]/consulta-view.tsx`); un wrapper/contexto del cliente de consulta que inyecta `X-Acceso-Token` (p. ej. `src/app/consulta/[token]/use-consulta-client.ts` o `consulta-client.ts`). Helper puro de cumpleaños (mes+día) — sin DB, fecha por parámetro.
- Patrón de página de referencia: `src/app/(employer)/tareas/page.tsx` (Server Component + secciones cliente). NO usar SessionGuard ni EmployerShell aquí.
- Fixtures disponibles: tests RTL con `vi.stubGlobal("fetch", ...)` — ver `src/app/(employer)/tareas/checklist-section.test.tsx` (no duplicar el patrón de mock de fetch; reusar el estilo). El body bufferizado del cliente llega como `ArrayBuffer` en el mock.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
