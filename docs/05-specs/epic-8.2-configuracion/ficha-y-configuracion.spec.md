# SPEC: Ficha de la empleada, salario y días laborales — id: epic-8.2-configuracion/ficha-y-configuracion

**Epic:** Epic 8.2 (Configuración) — ROADMAP Milestone 8   **Módulo:** architecture.md §2.1 Capa de Presentación (UI)

## Objetivo

Permitir al empleador ver y editar, dentro de la página `/configuracion` (grupo protegido `(employer)`), la **ficha de la empleada** (nombre, fecha de nacimiento, fecha de inicio de contrato y fecha de fin opcional) y la **configuración** (salario base en COP y días de la semana laborales). Los datos se cargan al entrar y se guardan mediante las operaciones del contrato. Si hoy es el cumpleaños de la empleada, se destaca un aviso (RN-20).

## Fuera de Scope (NO testear, NO implementar)

- CRUD de items adicionales (spec `items-adicionales`).
- Enlace de acceso de la empleada (spec `enlace-acceso`).
- Validación de negocio del backend (Zod): solo se *consume* y se *superficie* el error 422; la página NO reimplementa esas reglas.
- Cálculo de liquidación, calendario o cualquier lógica de dominio.
- Layout/shell del empleador y guard de sesión (ya entregados en Epic 8.1; la página solo vive dentro del grupo).
- Persistencia, route handlers o Server Actions (la página es solo presentación que consume el cliente tipado).

## Operaciones del Contrato de API

> Consumidas EXCLUSIVAMENTE vía el cliente tipado `apiClient` (`src/lib/api/client.ts`), nunca URLs a mano.

- **Consume** (frontend): `obtenerEmpleada` (GET `/empleada`), `actualizarEmpleada` (PUT `/empleada`), `obtenerConfiguracion` (GET `/configuracion`), `actualizarConfiguracion` (PUT `/configuracion`).

## Contrato (machine-readable)

> Resume lo que ya define `api-contract.md`/`.openapi.yaml`. El contrato es la fuente de verdad.

| Aspecto | Detalle |
|---------|---------|
| Entradas | Lectura: ninguna. Guardar ficha: `Empleada` = `{ nombre: string, fechaNacimiento: date(YYYY-MM-DD), fechaInicioContrato: date, fechaFinContrato?: date \| null }`. Guardar config: `Configuracion` = `{ salarioBase: integer (COP entero), diasLaborales: DiaSemana[] }`. `DiaSemana` ∈ `LUNES\|MARTES\|MIERCOLES\|JUEVES\|VIERNES\|SABADO\|DOMINGO`. |
| Salidas (éxito) | `obtenerEmpleada`→200 `Empleada`; `actualizarEmpleada`→200 `Empleada`; `obtenerConfiguracion`→200 `Configuracion`; `actualizarConfiguracion`→200 `Configuracion`. |
| Salidas (error) | 401 → no autorizado (manejado por el shell/guard, fuera de scope aquí); 422 → entrada inválida (envelope `{ code, message, details? }`) → la página muestra un Toast de error y mantiene los datos editados; otros/red → Toast genérico. |
| Efectos secundarios | Ninguno en la UI más allá de la llamada HTTP; el guardado persiste en backend. |
| Idempotencia | `actualizarEmpleada` y `actualizarConfiguracion` son idempotentes (PUT). |

## Reglas de Negocio

- **BR-1 (RN-18):** el salario base por defecto es **$700.000 COP**, configurable. La página muestra el valor que devuelve `obtenerConfiguracion` (que ya aplica el default del backend); no inventa un default propio si el backend devuelve uno. — fuente: business_requirements.md §Reglas de Negocio RN-18.
- **BR-2 (RN-02):** los días laborales son los días de la semana que el empleador configura; se persisten como `diasLaborales: DiaSemana[]`. La UI presenta los 7 días como toggles independientes. — fuente: RN-02.
- **BR-3 (RN-16):** el salario se maneja y muestra en **COP enteros sin decimales**; el formateo de moneda usa el único formateador `formatCOP`/`CurrencyDisplay` (no se añade un segundo formateador). — fuente: RN-16.
- **BR-4 (RN-20):** a partir de `fechaNacimiento`, si hoy (día y mes) coincide con el cumpleaños, se destaca un aviso (BirthdayBanner). — fuente: RN-20.
- **BR-5 (RN-07):** `fechaFinContrato` es **opcional**; ausente/`null` significa contrato vigente. — fuente: RN-07.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** al montar, la página carga la ficha vía `obtenerEmpleada` (GET `/empleada`) y la configuración vía `obtenerConfiguracion` (GET `/configuracion`), y rellena los campos: nombre, fecha de nacimiento, fecha de inicio, fecha de fin, salario base y los toggles de días laborales según la respuesta.
- **AC-2:** mientras las cargas están pendientes se muestra un estado de carga (Skeleton) y no se muestran los formularios todavía.
- **AC-3:** guardar la ficha invoca `actualizarEmpleada` (PUT `/empleada`) **una vez** con los valores actuales del formulario (nombre, fechaNacimiento, fechaInicioContrato y fechaFinContrato cuando esté presente).
- **AC-4:** guardar la configuración invoca `actualizarConfiguracion` (PUT `/configuracion`) **una vez** con `salarioBase` (entero) y `diasLaborales` reflejando exactamente los toggles activos.
- **AC-5:** al activar/desactivar un toggle de día, ese día se agrega/quita de `diasLaborales` enviado al guardar.
- **AC-6:** durante un guardado el botón correspondiente queda **deshabilitado** (y `aria-busy`), y se rehabilita al terminar.
- **AC-7:** un guardado exitoso (200) muestra retroalimentación de éxito (Toast success).
- **AC-8:** un 422 al guardar muestra un Toast de error y NO descarta los valores que el usuario editó.
- **AC-9 (a11y):** todos los campos tienen label asociado (accesibles por `getByLabelText`); cada toggle de día tiene nombre accesible (rol `switch` con el nombre del día); los botones de guardar tienen nombre accesible.
- **AC-10 (RN-20):** si `fechaNacimiento` coincide en día y mes con la fecha actual, se renderiza el BirthdayBanner con el nombre de la empleada; si no coincide, no se renderiza.

## Edge Cases

- **EC-1:** `obtenerEmpleada` u `obtenerConfiguracion` falla (red/500) → se muestra un estado de error legible (Toast o mensaje) y no se cuelga en el Skeleton indefinidamente.
- **EC-2:** `fechaFinContrato` ausente/`null` en la respuesta → el campo de fin queda vacío y al guardar sin fin no se envía una fecha de fin inválida (se omite o se envía `null`).
- **EC-3:** guardado de configuración con cero días activos → se envía `diasLaborales: []` (la página no fuerza un mínimo; la autoridad es el backend, que puede responder 422 → Toast).

## Superficie de Código Existente (para el implementer)

- Cliente tipado: `apiClient` en `src/lib/api/client.ts` — `apiClient.GET("/empleada")`, `apiClient.PUT("/empleada", { body })`, `apiClient.GET("/configuracion")`, `apiClient.PUT("/configuracion", { body })`. Devuelven `{ data, error, response }` (openapi-fetch). Tipos en `src/lib/api/schema.d.ts` (`components["schemas"]["Empleada"]`, `["Configuracion"]`, `["DiaSemana"]`).
- Componentes UI: `Input` (`src/components/ui/Input.tsx`, props `label`, `error`, `currency`, acepta `type`), `Switch` (`src/components/ui/Switch.tsx`, Radix, `checked`/`onCheckedChange`, requiere `aria-label` o `id`+`Label`), `Label` (`src/components/ui/Label.tsx`), `Button` (`src/components/ui/Button.tsx`, props `loading`, `size`, `variant`), `Card`/`CardHeader`/`CardTitle`/`CardContent` (`src/components/ui/Card.tsx`), `Skeleton` (`src/components/ui/Skeleton.tsx`).
- Dominio: `BirthdayBanner` (`src/components/domain/BirthdayBanner.tsx`, props `nombre`, `cuando?`). `CurrencyDisplay`/`formatCOP` (`src/lib/currency.ts`) si se necesita mostrar el salario formateado.
- Toast: `sonner` ya está integrado vía `Toaster` (`src/components/ui/Toaster.tsx`, montado en el layout raíz). Usar `toast.success(...)` / `toast.error(...)` de `sonner`.
- Crea: la página `src/app/(employer)/configuracion/page.tsx` y los componentes cliente de sección (ej. `ficha-empleada-form.tsx`, `configuracion-form.tsx`) co-localizados en `src/app/(employer)/configuracion/`. Tests co-localizados `*.test.tsx`.
- Patrón de test de referencia (mock de `fetch` global + `next/navigation`): `src/app/login/login-form.test.tsx`.
- Fixtures disponibles: ninguno específico de UI; los tests mockean `fetch`.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
