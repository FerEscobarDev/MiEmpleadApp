# Code Review — epic-7.1-frontend-foundation-design-system

**Date:** 2026-06-03
**Reviewer:** code-reviewer (rol ejecutado in-process por el orquestador del epic)
**Spec:** docs/05-specs/epic-7.1-frontend-foundation-design-system/{design-tokens,base-components-showcase,typed-client-app-shell-pwa}.spec.md
**RED commit:** 0b58d7fb23294e546cbd438290ffb55f7c776729 (RED re-establecido vía Recovery opción 2)
**HEAD commit:** 841ca257cf904a248eed4e7571d137de420219a8
**Range reviewed:** `git diff 0b58d7f..841ca25`

## Verdict

**STATUS: APPROVED**

## TDD Honesty

- Test diff check: `git diff 0b58d7f..841ca25 -- "src/**/*.test.ts" "src/**/*.test.tsx"`
- Result: **empty** — ningún archivo de test modificado entre RED y HEAD.
- Vacuous-green: revisado. Cada test verde corresponde a comportamiento real:
  - Componentes (Radix + cva) implementan roles/estados/aria reales; no hay `return true` ni hardcodes que satisfagan asercones vacíamente.
  - `apiClient` realmente construye la URL desde el `paths` generado del contrato (verificado con `fetch` mockeado).
  - `assertDevOnly` invoca `notFound()` real desde `next/navigation`.
- Nota de transparencia: el RED original (679dde4) se corrigió a 0b58d7f (Recovery opción 2 de
  `docs/tdd-honesty-violations.md`): el test de `CurrencyDisplay` comparaba `getByText(formatCOP(x))`
  con el NBSP (U+00A0) que emite Intl es-CO, imposible de satisfacer con la normalización de
  espacios de RTL sin debilitar. La corrección mantiene la intención (afirma el valor exacto de
  `formatCOP`, normalizando whitespace en ambos lados) y NO debilita la aserción. El componente
  quedó usando `formatCOP` verbatim (BR-3: formateador único intacto).

## Spec Compliance

Spec A (tokens): AC-1..AC-8 cubiertos — `darkMode: ["class"]`, semánticos + calendario + slate,
spacing/radios/sombras/foco, variables CSS claro/oscuro, Inter vía `next/font` con `--font-sans`,
utilidad tabular, layout con `lang="es-CO"` + ThemeProvider (system). Sin findings.

Spec B (componentes + showcase): AC-1..AC-15 cubiertos. Button (variantes/estados/loading/iconOnly),
Input (label+error aria), Checkbox/Switch (roles+estado), Badge (texto+color), Tabs/Dialog/Tooltip
(Radix a11y), CurrencyDisplay (formatCOP+tabular), MonthCalendar (leyenda + etiqueta textual por
día + indicador de item), TaskChecklist (marcable/solo-lectura), EmptyState, y `/dev/design-system`
con guard dev-only + paleta/tipografía/spacing. Sin findings.

Spec C (cliente tipado + PWA): AC-1..AC-8 cubiertos — script `gen:api`, `schema.d.ts` generado con
paths/Error/enums, wrapper `openapi-fetch` con base `/api/v1`, sustitución de params de path,
`manifest.webmanifest` con campos de instalación + iconos, `next build` verde. Sin findings.

No se detectó sobre-implementación: los componentes de dominio sin test (MenuBoard,
ItemAdicionalEditor, AccessLinkCard, BirthdayBanner) están listados explícitamente como entregables
de la Spec B y se renderizan en el showcase; no son features fuera de scope.

## Architecture Compliance

- Stack respetado: Next.js App Router + TS + Tailwind + shadcn-style (Radix) + Vitest. `openapi-fetch`
  (runtime) y `openapi-typescript` (dev) son tooling del cliente tipado, avalado por la guía del epic
  y `architecture.md §2.1` (UI consume backend solo vía cliente tipado). Sin libs de UI fuera de shadcn.
- Boundary §2.1 respetado: ninguna URL escrita a mano (verificado por grep), ningún acceso a Prisma/DB
  desde la UI. El cliente es el único canal.
- `state_management: none` respetado: solo hooks/Context (next-themes); sin store global.
- ADR-001 (shadcn/Tailwind/Vitest) y ADR-002 (sin impacto frontend) honrados.
- Sin patrones de la deny-list (`conventions.md §4`): no hay lógica de negocio en componentes;
  `CurrencyDisplay` reusa `formatCOP` (no segundo formateador).

## Code Quality

- Naming: componentes React en PascalCase.tsx; identificadores en inglés; texto visible en español
  (`conventions.md §1, §8`). `theme-provider.tsx`/`tokens-display.tsx` en kebab-case (infra/no-componente).
- Sin código muerto, sin `console.log`, sin `TODO`. Archivos < 300 líneas (showcase dividido en
  `sections.tsx` + `tokens-display.tsx` para respetar el límite).
- `cn` centraliza el merge de clases; variantes con cva (idiomático shadcn).
- `apiClient`: el wrapper `dynamicFetch` resuelve `fetch` en cada llamada y normaliza el `Request` de
  openapi-fetch a `(url, init)` — comentado el porqué (entornos/tests). Correcto y documentado.
- tsc limpio (0 errores), `next lint` limpio (0 warnings/errores).

## Stack Idiomaticity

Skipped — `context7.enabled` es false en `.specture/conventions.md §10`. (Se consultó Context7 solo
durante el diseño para confirmar el API de openapi-typescript/openapi-fetch, no como gate de review.)

## Frontend Fidelity

- Tokens: todos los valores visuales provienen de tokens del DS (clases `bg-primary`, `text-h2`,
  `gap-md`, `rounded-lg`, `shadow-focus`, `bg-cal-*`...). Únicos hex: color configurable de items
  adicionales (`ItemAdicional.color`, dato de dominio del contrato, default `#DB2777` per §2.3) — no es
  violación de token. Sin findings.
- Contrato: la UI accede al backend solo vía `apiClient` tipado generado desde
  `api-contract.openapi.yaml`; cero URLs a mano. Sin findings.
- A11y: focus-visible en controles, `aria-label` en botones solo-ícono (Dialog cerrar, eliminar item),
  labels ligados a inputs, roles ARIA vía Radix, calendario y badges con etiqueta textual (no solo
  color, §2.3/§6), touch targets ≥44px en checkbox/tabs, `motion-reduce` en animaciones. Sin findings
  BLOCKER. Contraste: los pares de token se definieron per §6 (AA); la verificación visual fina queda
  para el gate humano.
- Marca: sin emojis en UI; iconografía lucide consistente; `primary = teal` separado de los verdes del
  calendario (§7). Sin findings.
- Showcase dev-only: `assertDevOnly()` → `notFound()` en producción (verificado por test y por build).

## Strengths

- Tokens respaldados por variables CSS permiten dark mode real (conmutación de valores), no solo
  recoloreo de clases.
- El cliente tipado se genera del contrato (script versionado + `schema.d.ts` commiteado), eliminando
  la posibilidad de URLs a mano en las páginas del Milestone 8.
- Componentes de dominio como shells por props: limpios para que las páginas los cableen al cliente.

## Notes

- `next lint` está deprecado en Next 16 (warning informativo); no afecta este epic.
- 3 vulnerabilidades de npm audit son transitivas preexistentes (postcss vía next, vitest UI) y
  requieren cambios breaking fuera del scope de este epic.
- La aprobación VISUAL del showcase es un gate humano pendiente (lo corre el coordinador); este review
  certifica fidelidad objetiva (tokens/contrato/a11y), no estética.
</content>
