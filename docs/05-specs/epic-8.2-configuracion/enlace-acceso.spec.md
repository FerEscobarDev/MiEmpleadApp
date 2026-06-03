# SPEC: Enlace de acceso de la empleada — id: epic-8.2-configuracion/enlace-acceso

**Epic:** Epic 8.2 (Configuración) — ROADMAP Milestone 8   **Módulo:** architecture.md §2.1 Capa de Presentación (UI)

## Objetivo

Permitir al empleador, dentro de `/configuracion`, gestionar el **enlace de acceso de solo lectura de la empleada**: ver el enlace cuando está activo, **copiarlo** al portapapeles, **regenerarlo** y **revocarlo** (con confirmación). Consume las operaciones de generación/revocación del contrato vía el cliente tipado.

## Fuera de Scope (NO testear, NO implementar)

- Ficha/salario/días laborales (spec `ficha-y-configuracion`) e items adicionales (spec `items-adicionales`).
- La vista de la empleada `/consulta/[token]` (Epic 8.7).
- Validación del token del lado de la empleada (`validarAccesoEmpleada`) — no se consume aquí.
- Persistencia / handlers.

## Operaciones del Contrato de API

> Consumidas EXCLUSIVAMENTE vía `apiClient`, nunca URLs a mano.

- **Consume** (frontend): `generarEnlaceAcceso` (POST `/acceso/enlace`), `revocarEnlaceAcceso` (DELETE `/acceso/enlace`).

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `generarEnlaceAcceso`: sin body. `revocarEnlaceAcceso`: sin body. |
| Salidas (éxito) | `generarEnlaceAcceso`→200 `EnlaceAcceso` = `{ token: string, url: string, activo: boolean }`; `revocarEnlaceAcceso`→204. |
| Salidas (error) | 401 → no autorizado (manejado por el shell/guard, fuera de scope); otros/red → Toast de error genérico. |
| Efectos secundarios | `generarEnlaceAcceso` crea/regenera el token (invalida el anterior — RN no requiere confirmar regeneración, sí revocación). `revocarEnlaceAcceso` desactiva el acceso. |
| Idempotencia | `generarEnlaceAcceso` NO idempotente (regenera); `revocarEnlaceAcceso` idempotente. |

## Reglas de Negocio

- **BR-1 (RN: HU-02):** el empleador puede **generar/compartir** un enlace de acceso para la empleada y **revocarlo**. — fuente: business_requirements.md HU-02.
- **BR-2 (Casos Límite):** un enlace **revocado/inválido** hace que la empleada pierda el acceso de consulta; la UI debe reflejar claramente el estado activo/revocado. — fuente: business_requirements.md §Casos Límite.
- **BR-3:** la **revocación** es una acción destructiva → requiere **confirmación** (Dialog) antes de ejecutarse. — fuente: design_system.md §3 Modal/Dialog (revocar enlace).

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** cuando hay un enlace activo, se muestra la **URL completa** del enlace y el estado "Activo".
- **AC-2:** copiar invoca la API de portapapeles con la URL del enlace y da retroalimentación de éxito (Toast "enlace copiado" o equivalente).
- **AC-3:** "Regenerar" invoca `generarEnlaceAcceso` (POST `/acceso/enlace`) **una vez**; al recibir el nuevo `EnlaceAcceso`, la UI muestra la nueva URL y estado activo.
- **AC-4:** "Revocar" abre un **diálogo de confirmación**; solo al confirmar se invoca `revocarEnlaceAcceso` (DELETE `/acceso/enlace`) **una vez**; cancelar NO invoca la operación.
- **AC-5:** tras revocar con éxito (204), la UI refleja el estado **revocado** (sin URL activa / badge "Revocado") y deshabilita copiar/revocar.
- **AC-6:** durante una operación en curso (regenerar/revocar) el control correspondiente queda deshabilitado (evita doble envío).
- **AC-7 (a11y):** los botones copiar/regenerar/revocar tienen nombre accesible; el diálogo de confirmación tiene título y foco atrapado (Radix Dialog); se cierra con Esc/cancelar.

## Edge Cases

- **EC-1:** estado inicial sin enlace activo (revocado o nunca generado) → se muestra el estado "Revocado"/sin enlace y la acción principal disponible es "Regenerar"/"Generar".
- **EC-2:** `generarEnlaceAcceso` falla (red/500) → Toast de error; el estado previo del enlace no cambia.
- **EC-3:** `revocarEnlaceAcceso` falla → Toast de error; el enlace permanece activo.
- **EC-4:** la API de portapapeles no está disponible o falla → Toast de error en lugar de éxito.

## Superficie de Código Existente (para el implementer)

- Cliente tipado: `apiClient` (`src/lib/api/client.ts`) — `apiClient.POST("/acceso/enlace")` (sin body) y `apiClient.DELETE("/acceso/enlace")`. Tipo: `components["schemas"]["EnlaceAcceso"]` en `src/lib/api/schema.d.ts`.
- Dominio: `AccessLinkCard` (`src/components/domain/AccessLinkCard.tsx`) — shell por props: `url: string`, `activo: boolean`, `onCopy?`, `onRegenerate?`, `onRevoke?`. El contenedor cablea las acciones al cliente tipado y abre el Dialog de confirmación para revocar.
- UI: `Dialog`/`DialogContent`/`DialogTitle`/`DialogDescription`/`DialogFooter`/`DialogClose` (`src/components/ui/Dialog.tsx`), `Button`, `Skeleton` (mientras se carga el estado inicial si aplica).
- Portapapeles: `navigator.clipboard.writeText(url)` (mockeable en tests vía `vi.stubGlobal`/`Object.defineProperty(navigator, "clipboard", ...)`).
- Toast: `toast.success` / `toast.error` de `sonner`.
- Crea: componente contenedor cliente `src/app/(employer)/configuracion/enlace-acceso-section.tsx` (consumido por `configuracion/page.tsx`). Tests co-localizados `*.test.tsx`.
- Patrón de test de referencia: `src/app/login/login-form.test.tsx` (mock de `fetch` global).
- Nota de estado inicial: el contrato NO expone una operación GET del enlace; la sección arranca en estado "sin enlace/revocado" y se genera bajo demanda. No inventar un GET fuera del contrato.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
