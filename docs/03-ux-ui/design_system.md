# Design System: MiEmpleadApp

> Fuente de verdad del estilo y los componentes de la UI. Se **codificará en los epics de frontend de la Fase 4** (Ruta 2): tokens → componentes → página `/dev/design-system` para aprobación → páginas. Librería: **shadcn/ui** (Radix + Tailwind). Sin código en este documento.

## 1. Identidad de Marca

- **Nombre del producto:** MiEmpleadApp.
- **Voz y tono:** cercano, claro y respetuoso; profesional sin ser frío. Lenguaje sencillo en español (Colombia), sin tecnicismos. Transmite confianza y transparencia entre empleador y empleada.
- **Audiencia:** dos perfiles no técnicos. (1) **Empleador**: configura y liquida desde el celular, valora claridad y rapidez. (2) **Empleada**: consulta su pago, su menú y sus tareas; puede tener baja familiaridad con apps → todo debe ser legible, con textos grandes y pocos pasos.
- **Referencias visuales:** ninguna provista por el usuario (no se inventan).

## 2. Tokens del Design System

> shadcn/ui consume estos tokens vía variables CSS de tema. El principal es **teal** (cuidado/confianza), deliberadamente distinto de los colores del calendario para evitar confusión semántica.

### 2.1 Color — Marca y semánticos

| Token | Valor (HEX) | Uso |
|-------|-------------|-----|
| `color.primary.500` | `#0D9488` | Acción principal, navegación activa, total destacado |
| `color.primary.600` | `#0F766E` | Hover/active de acción principal |
| `color.primary.50` | `#F0FDFA` | Fondos suaves de acento primario |
| `color.secondary.500` | `#475569` | Acción secundaria, texto de apoyo fuerte |
| `color.accent.500` | `#F59E0B` | Resaltos puntuales (badges, cumpleaños) |
| `color.success` | `#15803D` | Éxito (guardado, confirmaciones) |
| `color.warning` | `#B45309` | Advertencias |
| `color.error` | `#DC2626` | Errores, acción destructiva |
| `color.info` | `#1D4ED8` | Información |

### 2.2 Color — Neutrales (escala slate)

| Token | Valor (HEX) | Uso |
|-------|-------------|-----|
| `color.neutral.0` | `#FFFFFF` | Fondo claro / superficies |
| `color.neutral.50` | `#F8FAFC` | Fondo de página |
| `color.neutral.100` | `#F1F5F9` | Superficies sutiles, hover de filas |
| `color.neutral.200` | `#E2E8F0` | Bordes, divisores |
| `color.neutral.400` | `#94A3B8` | Texto deshabilitado, placeholders |
| `color.neutral.600` | `#475569` | Texto secundario |
| `color.neutral.800` | `#1E293B` | Texto fuerte |
| `color.neutral.900` | `#0F172A` | Texto principal (modo claro) |

### 2.3 Color — Tokens del Calendario (dominio)

> Cada tipo de día tiene color **y** etiqueta/ícono (nunca solo color, por accesibilidad y daltonismo). Se usan en el calendario de `/liquidar`, `/historial/[mes]` y la consulta de la empleada.

| Token | Valor (HEX) | Significado | Texto sobre el color |
|-------|-------------|-------------|----------------------|
| `cal.trabajado` | `#16A34A` (verde) | Día efectivamente trabajado | blanco (AA) |
| `cal.inasistencia` | `#EA580C` (naranja) | Inasistencia (descuenta) | blanco (AA) |
| `cal.festivo` | `#7C3AED` (morado) | Festivo en día laboral (pagado, no descuenta) | blanco (AA) |
| `cal.noLaboral` | `#94A3B8` (gris) | Domingo / día no laboral | `neutral.900` |
| `cal.fueraContrato` | `#E2E8F0` (gris claro) | Antes del inicio o después del fin de contrato | `neutral.600` |
| `cal.itemAdicional` | configurable (default `#DB2777`) | Día con item adicional registrado | blanco |

> Los días con item adicional se indican con un **punto/indicador** sobre el color del día, no reemplazando el color base, para que el día siga comunicando su estado.

### 2.4 Tipografía

> Familia **Inter** (UI). Números con **variante tabular** para alinear montos en COP. Tamaños mobile-first.

| Token | Familia | Tamaño | Line-height | Peso | Uso |
|-------|---------|--------|-------------|------|-----|
| `text.display` | Inter | 30px | 1.2 | 700 | Total a pagar destacado |
| `text.h1` | Inter | 24px | 1.25 | 700 | Título de pantalla |
| `text.h2` | Inter | 20px | 1.3 | 600 | Subtítulo de sección |
| `text.h3` | Inter | 17px | 1.35 | 600 | Encabezado de tarjeta |
| `text.body` | Inter | 16px | 1.5 | 400 | Texto general |
| `text.bodyStrong` | Inter | 16px | 1.5 | 600 | Énfasis en texto |
| `text.caption` | Inter | 13px | 1.4 | 500 | Labels, ayudas, leyendas |
| `text.money` | Inter (tabular) | según contexto | — | 600 | Montos COP (alineados) |

### 2.5 Spacing

| Token | Valor |
|-------|-------|
| `space.xs` | 4px |
| `space.sm` | 8px |
| `space.md` | 16px |
| `space.lg` | 24px |
| `space.xl` | 32px |
| `space.2xl` | 48px |

### 2.6 Otros

- **Border radius:** `sm` 6px · `md` 10px · `lg` 16px · `full` 9999px (avatares, badges).
- **Shadows:** `sm` (tarjetas), `md` (popovers/menus), `lg` (modales), `focus` (anillo de foco visible con `primary.500`).
- **Breakpoints:** `sm` 640px · `md` 768px · `lg` 1024px · `xl` 1280px. (Mobile-first: base = móvil.)
- **Z-index:** dropdown 100 · barra de navegación 200 · modal 1000 · toast 2000 · tooltip 3000.
- **Touch targets:** mínimo 44×44px (pensado para la empleada en móvil).

## 3. Especificación de Componentes Base

> Descripción textual (sin código). Se implementan con shadcn/ui en la Fase 4. Todos: foco visible, navegables por teclado, `aria-label` en íconos sin texto.

### Button
- **Variantes:** primary | secondary | ghost | danger | link.
- **Estados:** default | hover | focus | active | disabled | loading (spinner + texto, deshabilitado).
- **Tamaños:** sm | md | lg (lg para acciones principales en móvil).
- **Íconos:** soporta ícono izquierda/derecha o solo ícono (con `aria-label`).

### Input / NumberInput / CurrencyInput
- **Variantes:** text | email | password | number | search; **CurrencyInput** formatea en COP (es-CO, sin decimales) y alinea a la derecha.
- **Estados:** default | hover | focus | error | disabled | readonly.
- **Affordances:** label encima, helper text debajo, mensaje de error con ícono; prefijo/sufijo opcional (ej. "$").

### Select / Combobox
- Para periodicidad de menú, año/mes, día de la semana. Estados con error y deshabilitado; navegable por teclado; lista accesible (Radix).

### Checkbox
- Para el **checklist de tareas** y selección de días. Estados: marcado | sin marcar | indeterminado | disabled. Touch target ≥44px. Etiqueta clicable.

### Switch / Toggle
- Para activar/desactivar **días laborales** (L–D) y `activo` de items. Estado on/off con color `primary`, label asociado.

### Textarea
- Para **notas del mes** (privadas) y descripciones largas. Con contador opcional; estados de error.

### DatePicker / Selector de fechas
- Selección de **inicio/fin de contrato** y de **fechas de inasistencia** dentro del mes. Bloquea/avisa fechas inválidas (festivo, no laboral, fuera de contrato) según RN-05.

### TimeRangeField
- Para horarios **opcionales** de una tarea (hora inicio / hora fin, formato HH:mm). Validación de rango.

### Card
- Contenedor de secciones y KPIs. Variantes: estándar | destacada (para el **total a pagar**, con borde/acento `primary`). Header opcional, contenido, acciones.

### StatBlock / Panel de Desglose
- Muestra el desglose de la liquidación: días L–S, festivos en día laboral, días trabajados, valor-día, subtotales y **total** (con `text.display`). Cada línea con label (`caption`) y monto (`text.money`).

### Badge
- Estado de liquidación: **Borrador** (neutral/amber) · **Cerrada** (success). Y etiquetas de tipo de día en la leyenda. Texto + color (nunca solo color).

### Tabs
- Para la **consulta de la empleada** (Pago · Menú · Tareas) y posibles sub-vistas de tareas (Hoy · Histórico). Accesibles por teclado (Radix).

### Modal / Dialog
- Confirmaciones destructivas o de cambio de estado: **eliminar liquidación** (RN-19), **cerrar/reabrir liquidación**, **revocar enlace**. Botón primario y de cancelar; foco atrapado; cierre con Esc.

### Toast
- Feedback no bloqueante: guardado, errores de negocio (ej. "mes cerrado", "inasistencia inválida"), enlace copiado. Variantes: success | error | info; respeta `prefers-reduced-motion`.

### Avatar
- Iniciales/imagen de la empleada en encabezados; tamaño sm/md.

### Tooltip
- Aclaraciones breves (ej. "Los festivos no se descuentan"); accesible vía foco, no solo hover.

### Table / List
- **Historial** de meses (mes-año, estado, total, acción) y **lista de items adicionales**. En móvil colapsa a tarjetas apiladas. Con estado vacío.

### EmptyState
- Mensajes guía cuando no hay datos (sin meses liquidados, sin items, sin tareas), con acción sugerida.

### Skeleton / Loading
- Esqueletos de carga para calendario, historial y consulta, evitando saltos de layout.

## 4. Componentes de Dominio (específicos de la app)

> Compuestos a partir de los base; necesarios según el mapa de navegación.

### MonthCalendar
- Cuadrícula del mes con celdas coloreadas por tipo de día (tokens §2.3) + **leyenda** siempre visible. Indicador de item adicional. Selección de fechas para inasistencias (modo edición) y modo lectura (consulta/historial). Etiqueta textual del estado por día (accesible).

### CurrencyDisplay
- Renderiza montos en COP con `Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 })`. Usa `text.money` (tabular). Único punto de formateo de moneda en la UI.

### TaskChecklist
- Lista de tareas del día con casilla, descripción y horario opcional; orden respetado. En consulta de la empleada las casillas son **marcables** (única escritura permitida a la empleada).

### TaskRoutineEditor
- Editor por día de la semana: agregar/editar/eliminar/reordenar tareas, con horario opcional.

### MenuBoard
- Tablero de menú: días × comidas, por cada semana del ciclo (según periodicidad). Edición para el empleador; vista de "hoy" resaltada para la consulta.

### ItemAdicionalEditor
- Lista editable de items (nombre, valor unitario en COP, color, activo) con crear/editar/eliminar.

### AccessLinkCard
- Muestra el enlace de acceso de la empleada con acciones **copiar**, **regenerar** y **revocar** (confirmación). Indica si está activo.

### BirthdayBanner
- Aviso destacado del cumpleaños de la empleada (cuando la fecha coincide o se acerca), con tono cálido (`accent`).

### RoleGuard / ReadOnlyWrapper
- Patrón visual que, en modo empleada, oculta acciones de escritura y las **notas**, dejando solo lectura + marcar tareas.

## 5. Especificación para IA de Diseño

> No aplica — se eligió **Ruta 2** (Specture renderiza el Design System en la Fase 4). Sección omitida intencionalmente.

## 6. Reglas de Accesibilidad y Responsividad

- **Nivel WCAG mínimo:** AA. Texto normal ≥ 4.5:1; texto grande/UI ≥ 3:1. Todos los pares de §2 cumplen AA (los colores de calendar usan texto blanco o `neutral.900` según la tabla).
- **Color nunca como único indicador:** el calendario y los badges combinan color con etiqueta/ícono (clave para daltonismo).
- **Mobile-first:** diseñado para 320px de ancho mínimo; layout fluido hasta desktop (navegación inferior en móvil, lateral en desktop).
- **Teclado:** navegación completa por teclado, foco visible (`shadow.focus`), orden lógico; modales atrapan foco y cierran con Esc.
- **Touch:** objetivos táctiles ≥44×44px; especial cuidado en casillas de tareas y selección de días.
- **Texto legible:** tamaño base 16px, evitar textos diminutos (la empleada puede tener baja familiaridad/visión).
- **Movimiento:** respetar `prefers-reduced-motion` (sin animaciones llamativas en toasts/transiciones).
- **Idioma:** todo en español (Colombia); fechas y moneda con formato local.
- **Modo oscuro:** **sí**, soportado. Los tokens semánticos y neutrales mapean a una paleta oscura (fondo `neutral.900`, superficies `neutral.800`, texto claro); `primary` mantiene contraste AA. Los colores de calendario conservan su tono pero ajustan luminosidad para AA sobre fondo oscuro. Preferencia inicial: seguir el sistema (`prefers-color-scheme`).

## 7. Notas de Decisión

- **Primary = teal** para no colisionar con el **verde de "día trabajado"** del calendario ni con el morado de festivos; mantiene separación semántica clara.
- **Color del calendario alineado a los requerimientos** del documento original (verde/naranja/azul-morado/gris/gris claro + color configurable de items), reforzado con etiquetas por accesibilidad.
- **shadcn/ui** elegido (ya en `stack.yml`): da componentes accesibles base (Radix) que cubren formularios, tabs, dialog, tooltip y tabla; lo de dominio (calendario, tablero de menú, checklist) se compone encima.
- **Números tabulares** para que las columnas de montos en COP queden alineadas en historial y desgloses.
- Si en la Fase 4 surge una decisión visual estructural (ej. cambiar la familia tipográfica o el modo oscuro), se registrará como ADR en `.specture/decisions/`.
