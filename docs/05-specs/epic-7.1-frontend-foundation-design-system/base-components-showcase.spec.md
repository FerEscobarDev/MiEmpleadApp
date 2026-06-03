# SPEC: Librería de componentes base + dominio + showcase /dev/design-system — id: epic-7.1-frontend-foundation-design-system/base-components-showcase

**Epic:** [ROADMAP Epic 7.1 — Frontend Foundation y Design System](../../04-roadmap/ROADMAP.md)   **Módulo:** [architecture.md §2.1 Capa de Presentación](../../02-architecture/architecture.md#21-capa-de-presentación-ui)

## Objetivo
Construir la librería de **componentes base** (estilo shadcn/ui: Radix + Tailwind + cva) y los **componentes de dominio** (shells presentacionales por props) del Design System, con sus variantes/estados y accesibilidad AA, y la ruta **`/dev/design-system`** (solo desarrollo) que los renderiza a todos en cada variante/estado junto con la paleta de tokens y las escalas tipográfica/de spacing. Es el artefacto que el usuario aprobará visualmente. Sin lógica de negocio ni consumo de datos.

## Fuera de Scope (NO testear, NO implementar)
- Tokens de tema → spec A (`design-tokens`), ya disponibles.
- Cliente tipado de API, shell de app autenticado, PWA/manifest → spec C.
- Cableado de los componentes de dominio a datos reales (eso es Milestone 8). Aquí son **shells dirigidos por props** con datos de muestra.
- Cálculo de liquidación, festivos, formato de fechas: NO se reimplementan (el dominio ya existe en backend).

## Operaciones del Contrato de API
- **N/A — componentes presentacionales, sin boundary HTTP.** (Los de dominio reciben datos por props.)

## Contrato (machine-readable)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Props de cada componente (variantes, estados, datos de muestra para los de dominio). |
| Salidas (éxito) | Componentes React accesibles exportados desde `src/components/ui/*` (base) y `src/components/domain/*` (dominio); ruta `/dev/design-system` que los muestra. |
| Salidas (error) | La ruta `/dev/design-system` devuelve **404 (`notFound()`)** cuando `NODE_ENV === "production"`. |
| Efectos secundarios | Ninguno (sin red, sin DB). |
| Idempotencia | N/A (presentacional). |

## Reglas de Negocio
- **BR-1:** Todo texto visible en español (Colombia). — fuente: design_system.md §6.
- **BR-2:** **Color nunca como único indicador**: calendario y badges combinan color + etiqueta/ícono (daltonismo). — fuente: design_system.md §2.3, §6.
- **BR-3:** `CurrencyDisplay` usa **exclusivamente** el helper existente `formatCOP` (`src/lib/currency.ts`, es-CO COP sin decimales). NO se crea un segundo formateador. — fuente: conventions.md §9, design_system.md §4.
- **BR-4:** Accesibilidad AA: foco visible (`focus-visible`), navegación por teclado, `aria-label` en controles solo-ícono, objetivos táctiles ≥44px en casillas/controles móviles, respeto a `prefers-reduced-motion`. — fuente: design_system.md §6.
- **BR-5:** La ruta `/dev/design-system` es **solo de desarrollo**: nunca debe quedar expuesta en producción. — fuente: build/SKILL.md (showcase dev-only) y guía del epic.
- **BR-6:** Los días con item adicional se indican con un **punto/indicador** sobre el color del día, sin reemplazar el color base. — fuente: design_system.md §2.3.

## Criterios de Aceptación (≥1 test por ID)
> Tests RTL sobre comportamiento/a11y verificable (roles, nombres accesibles, estados disabled/aria), NO sobre estética de píxeles.

- **AC-1:** `Button` renderiza con rol `button`, soporta variantes (primary/secondary/ghost/danger/link) y refleja `disabled`; en estado `loading` queda deshabilitado y comunica el estado de carga de forma accesible.
- **AC-2:** Un `Button` solo-ícono expone un nombre accesible (`aria-label`).
- **AC-3:** `Input` se asocia a su `label` (consultable por `getByLabelText`/rol `textbox` con nombre) y refleja estado de error con texto de ayuda asociado (`aria-invalid` / `aria-describedby`).
- **AC-4:** `Checkbox` expone rol `checkbox`, alterna marcado/sin marcar al hacer clic y soporta estado `disabled`; su etiqueta es clicable.
- **AC-5:** `Switch` expone rol `switch` y refleja su estado on/off (`aria-checked`).
- **AC-6:** `Badge` de estado de liquidación muestra **texto** ("Borrador" / "Cerrada"), no solo color.
- **AC-7:** `Tabs` expone roles `tab`/`tablist`/`tabpanel`; al activar una pestaña muestra su panel correspondiente y es navegable por teclado.
- **AC-8:** `Dialog`/`Modal` se abre y atrapa el foco; expone rol `dialog` con nombre accesible; se cierra con Esc.
- **AC-9:** `Tooltip` expone su contenido como descripción accesible y es alcanzable por foco (no solo hover).
- **AC-10:** `CurrencyDisplay` renderiza un monto formateado con `formatCOP` (ej. `1500000` → `"$ 1.500.000"` según es-CO) y usa números tabulares.
- **AC-11:** `MonthCalendar` renderiza una **leyenda** con todos los tipos de día (cada uno con etiqueta textual) y, para cada celda de día, una etiqueta textual accesible de su tipo (no solo color). Indica item adicional con un indicador adicional sobre el color base.
- **AC-12:** `TaskChecklist` renderiza cada tarea con su casilla (`checkbox`) y descripción; en modo marcable, alternar una casilla invoca el callback con el id de la tarea y su nuevo estado.
- **AC-13:** `EmptyState` renderiza un mensaje guía y (opcionalmente) una acción.
- **AC-14:** La ruta `/dev/design-system`: la función guard devuelve/produce `notFound()` cuando `NODE_ENV === "production"` y renderiza el showcase en otro caso. (Testeable a nivel de la función de guard/render aislada.)
- **AC-15:** El showcase incluye secciones para la **paleta de tokens** (colores de marca, semánticos y de calendario), la **escala tipográfica** y la **escala de spacing**, además de cada componente base y de dominio en sus variantes/estados.

## Edge Cases (los que cambian comportamiento)
- **EC-1:** `CurrencyDisplay` con `0` → muestra `"$ 0"` (sin decimales).
- **EC-2:** `MonthCalendar` con un día `FUERA_CONTRATO` → la celda comunica "fuera de contrato" por etiqueta, no solo por color gris claro.
- **EC-3:** `TaskChecklist` en modo solo-lectura (empleador histórico) → las casillas no son interactivas / no invocan callback de marcado.
- **EC-4:** `Button` `loading` y `disabled` simultáneos → permanece no interactivo.

## Componentes a entregar
**Base (`src/components/ui/`):** Button, Input (con variante CurrencyInput de alineación derecha + número), Select, Checkbox, Switch, Textarea, Calendar/DatePicker (selector de fecha base), Card (estándar + destacada), Badge, Tabs, Dialog/Modal, Toast (Sonner/Toaster), Avatar, Tooltip, Table/List, EmptyState, Skeleton, Label.
**Dominio (`src/components/domain/`):** MonthCalendar, CurrencyDisplay, TaskChecklist, MenuBoard, ItemAdicionalEditor (shell), AccessLinkCard, BirthdayBanner. (StatBlock/Desglose como parte de Card o dominio.)

## Superficie de Código Existente (para el implementer)
- Llama a: `formatCOP(amount: number): string` en `src/lib/currency.ts` — **único** formateador de moneda (CurrencyDisplay lo usa).
- Llama a: `cn(...inputs)` en `src/lib/utils.ts` (creado en spec A) — merge de clases.
- Consume: tokens de tema definidos en spec A (`tailwind.config.ts` + `globals.css`), incluidos los `cal.*`.
- Consume: enums del contrato para los shells de dominio: `TipoDiaCalendario` (TRABAJADO/INASISTENCIA/FESTIVO/NO_LABORAL/FUERA_CONTRATO), `EstadoLiquidacion` (BORRADOR/CERRADA), `DiaSemana`. (Definidos en `api-contract.openapi.yaml`; pueden tomarse del cliente tipado del spec C **o** declararse como tipos locales del shell si C aún no está integrado — preferir consumir el tipo del cliente cuando exista.)
- Crea: componentes base en `src/components/ui/*.tsx`, dominio en `src/components/domain/*.tsx`.
- Crea: ruta `src/app/dev/design-system/page.tsx` + helper de guard dev-only (p.ej. `src/app/dev/design-system/guard.ts` con `assertDevOnly()` que llama `notFound()` en producción) para hacerlo testeable.
- Fixtures disponibles: ninguno de UI; usar datos de muestra inline en el showcase.
- Dependencias ya instaladas: `@radix-ui/react-*` (slot, checkbox, switch, select, tabs, dialog, tooltip, avatar, label), `class-variance-authority`, `lucide-react`, `sonner`.
- Convenciones: componentes React en PascalCase.tsx; identificadores en inglés; texto visible en español; 2 espacios; comillas dobles en TSX; `;` obligatorios; línea ≤100; archivo ≤300 líneas (dividir el showcase en sub-secciones/componentes si excede).
</content>
