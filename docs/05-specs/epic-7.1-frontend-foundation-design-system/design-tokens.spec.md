# SPEC: Design Tokens como tema Tailwind + globals — id: epic-7.1-frontend-foundation-design-system/design-tokens

**Epic:** [ROADMAP Epic 7.1 — Frontend Foundation y Design System](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.1 Capa de Presentación](../../02-architecture/architecture.md#21-capa-de-presentación-ui)

## Objetivo
Codificar el Design System de MiEmpleadApp como **tokens** (color de marca/semánticos, neutrales slate, colores del calendario, tipografía Inter con números tabulares, spacing, radios, sombras) en el mecanismo de tema de Tailwind v3 + variables CSS, con **modo oscuro por clase** que siga la preferencia del sistema. Estos tokens son la base sobre la que se construyen los componentes (spec B) y las páginas (Milestone 8). Sin lógica de negocio.

## Fuera de Scope (NO testear, NO implementar)
- Componentes (Button, Input, etc.) → spec B (`base-components-showcase`).
- La ruta `/dev/design-system` → spec B.
- Cliente tipado de API y shell PWA → spec C.
- Cualquier consumo de datos del backend.

## Operaciones del Contrato de API
- **N/A — capa de presentación (tokens), sin boundary HTTP.**

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | N/A (tokens estáticos de estilo). |
| Salidas (éxito) | Variables CSS de tema en `globals.css` (modo claro y oscuro) + extensión del tema en `tailwind.config.ts` que mapea cada token a una clase utilitaria (colores, fuentes, spacing, radios, sombras). Fuente Inter cargada vía `next/font` y expuesta como variable CSS `--font-sans`. |
| Salidas (error) | N/A. |
| Efectos secundarios | Ninguno (solo estilos). El modo oscuro se activa con la clase `dark` en `<html>` (estrategia `class`). |
| Idempotencia | N/A. |

## Reglas de Negocio
- **BR-1:** Idioma de la UI español (Colombia); `<html lang="es-CO">`. — fuente: business_requirements.md (Restricciones No Funcionales — idioma) y design_system.md §6.
- **BR-2:** Color primario = **teal** (`#0D9488`), deliberadamente distinto de los colores del calendario para no confundir "acción" con "día trabajado". — fuente: design_system.md §2.1 y §7.
- **BR-3:** Cada tipo de día del calendario tiene color **y** etiqueta/ícono asociable (nunca solo color); los tokens de calendario deben existir como clases. — fuente: design_system.md §2.3 y §6.
- **BR-4:** Tipografía **Inter** con **variante tabular** para alinear montos COP (clase de números tabulares disponible). — fuente: design_system.md §2.4 y §7.
- **BR-5:** **Modo oscuro** soportado vía estrategia `class`; los neutrales y semánticos mapean a una paleta oscura manteniendo contraste AA; preferencia inicial = sistema. — fuente: design_system.md §6.
- **BR-6:** Contraste mínimo WCAG **AA** en todos los pares de color de §2. — fuente: design_system.md §6.

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** `tailwind.config.ts` define `darkMode: "class"`.
- **AC-2:** La extensión del tema de Tailwind expone los colores semánticos de marca: `primary` (con `DEFAULT`/`hover` o escalas 50/500/600), `secondary`, `accent`, `success`, `warning`, `error`, `info`.
- **AC-3:** La extensión del tema expone los **colores del calendario** como tokens: `cal.trabajado`, `cal.inasistencia`, `cal.festivo`, `cal.noLaboral`, `cal.fueraContrato`, `cal.itemAdicional` (o equivalentes `cal-trabajado`...).
- **AC-4:** La extensión del tema expone los neutrales de la escala slate usados por el DS (0/50/100/200/400/600/800/900).
- **AC-5:** El spacing del DS (`xs`/`sm`/`md`/`lg`/`xl`/`2xl` = 4/8/16/24/32/48px), los radios (`sm` 6 / `md` 10 / `lg` 16 / `full`) y las sombras (`sm`/`md`/`lg`/`focus`) están en el tema.
- **AC-6:** `globals.css` declara las variables CSS de tema para modo claro (`:root`) y modo oscuro (`.dark`), de modo que los tokens semánticos cambian de valor entre ambos.
- **AC-7:** La familia tipográfica de la app es Inter (variable de fuente `--font-sans` aplicada al body) y existe una utilidad de números tabulares (`tabular-nums`) disponible para montos.
- **AC-8:** El `RootLayout` aplica la clase de la fuente y mantiene `lang="es-CO"`, e incluye un proveedor de tema que sigue `prefers-color-scheme` por defecto.

## Edge Cases (los que cambian comportamiento)
- **EC-1:** Tema sin preferencia explícita del usuario → sigue el sistema (`prefers-color-scheme`).
- **EC-2:** Token de color de calendario `itemAdicional` → tiene un default (`#DB2777`) pero su valor real puede ser configurable por item (en este epic solo se fija el default como token).

## Superficie de Código Existente (para el implementer)
- Modifica: `tailwind.config.ts` (extensión de tema; ya define `content` y `theme.extend: {}`).
- Modifica: `src/app/globals.css` (hoy solo tiene las 3 directivas `@tailwind`).
- Modifica: `src/app/layout.tsx` (hoy: `metadata`, `<html lang="es-CO">`, `<body>{children}</body>`).
- Crea: utilidad `cn` en `src/lib/utils.ts` (merge de clases con `clsx` + `tailwind-merge`) — la consumirán los componentes del spec B.
- Crea: proveedor de tema en `src/components/theme-provider.tsx` (envoltura cliente de `next-themes`).
- Fixtures disponibles: ninguno (primer spec de frontend).
- Dependencias ya instaladas: `clsx`, `tailwind-merge`, `tailwindcss-animate`, `next-themes`, `class-variance-authority`.
- Convenciones: archivos de componentes en PascalCase no aplica a `theme-provider.tsx` (es infra); identificadores en inglés; 2 espacios; comillas dobles en TSX; `;` obligatorios; línea ≤100.
</content>
</invoke>
