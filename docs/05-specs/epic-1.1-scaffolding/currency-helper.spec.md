# SPEC: Helper de moneda COP — id: epic-1.1-scaffolding/currency-helper

**Epic:** [Epic 1.1 — Scaffolding del proyecto](../../04-roadmap/ROADMAP.md#milestone-1-foundation)   **Módulo:** [§2.1 Capa de Presentación](../../02-architecture/architecture.md#21-capa-de-presentación-ui) — utilidad transversal en `lib/`.

## Objetivo
Proveer un helper centralizado que formatee montos en pesos colombianos (COP) **sin decimales**, usando el formato regional de Colombia. Es la única fuente para mostrar dinero en toda la app, de modo que ningún componente vuelva a construir un formateador de moneda a mano.

## Fuera de Scope (NO testear, NO implementar)
- Parseo de strings a número (de "$700.000" a `700000`): no se requiere en este epic.
- Conversión de centavos / subunidades: los montos del negocio son enteros de pesos; no hay subunidades.
- Aritmética monetaria (sumas, descuentos, valor-día): es del dominio de liquidación (Epic 2.2), no de este helper.
- Otras monedas o locales distintos de `es-CO` / COP.
- Internacionalización de etiquetas de UI.

## Operaciones del Contrato de API
N/A — lógica interna (utilidad de presentación pura). No toca boundary HTTP.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | `amount`: number — monto entero en pesos colombianos (sin decimales). Puede ser 0, positivo o negativo. |
| Salidas (éxito) | `string` — el monto formateado como moneda COP con el símbolo de peso, separadores de miles según `es-CO`, y **cero decimales** (`maximumFractionDigits: 0`). Producido con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`. |
| Salidas (error) | N/A — función pura total; no lanza para entradas numéricas finitas. (El manejo de `NaN`/`Infinity` no entra en este spec; el dominio garantiza enteros finitos.) |
| Efectos secundarios | Ninguno (función pura, sin IO, sin estado, sin acceso a `Date.now()`). |
| Idempotencia | Sí — misma entrada produce siempre la misma salida. |

## Reglas de Negocio
- **BR-1:** RN-16 — todos los montos se manejan y muestran en pesos colombianos (COP) **sin decimales**. Fuente: `business_requirements.md` RN-16.
- **BR-2:** El formateo de moneda se centraliza siempre con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`, en `lib/currency`. Fuente: `conventions.md` §9.
- **BR-3:** Cálculos monetarios con `number` flotante para acumulados sensibles deben redondearse a pesos; COP no usa decimales en la UI. Este helper nunca muestra decimales. Fuente: `conventions.md` §4.

## Criterios de Aceptación (≥1 test por ID)
> Los criterios describen la salida observable. NO se fija el string exacto carácter-a-carácter en la prosa (el símbolo y los separadores los decide `Intl` del runtime); el test verifica las propiedades observables: símbolo de peso presente, dígitos del monto presentes con separación de miles, y ausencia de parte decimal.

- **AC-1:** `formatCOP(700000)` produce un string que representa setecientos mil pesos: incluye el símbolo de peso (`$`), contiene los dígitos agrupados en miles (los grupos "700" y "000" separados por el separador de miles de `es-CO`), y **no** contiene una parte decimal (ni `,00` ni `.00`).
- **AC-2:** `formatCOP(0)` produce el cero formateado como moneda COP: incluye el símbolo de peso y el dígito `0`, sin parte decimal.
- **AC-3:** `formatCOP` de un monto grande (p. ej. `1500000`) agrupa correctamente los millones y miles según `es-CO`, con símbolo de peso y sin decimales.
- **AC-4:** Para cualquier entero, la salida **no** contiene dos dígitos decimales (se verifica que no exista el patrón de separador-decimal seguido de exactamente dos dígitos al final): se cumple `maximumFractionDigits: 0`.
- **AC-5:** El helper produce exactamente lo mismo que `new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)` para los montos de los AC anteriores (equivalencia con el formateador canónico, de modo que el test sea robusto al runtime).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** `amount = 0` → cero formateado con símbolo y sin decimales (cubierto por AC-2).
- **EC-2:** `amount` negativo (p. ej. `-50000`, posible en un ajuste/descuento mostrado) → string negativo formateado como moneda COP sin decimales, con el símbolo de peso y la marca de negativo según `es-CO`.
- **EC-3:** `amount` con valor que en otras monedas tendría decimales (p. ej. `1234`) → se muestra sin decimales (no `1.234,00`).

## Superficie de Código Existente (para el implementer)
- Crea: función `formatCOP(amount: number): string` exportada desde `src/lib/currency.ts` (archivo kebab-case por `conventions.md` §1).
- Co-localización del test: `src/lib/currency.test.ts` (lo escribe el `tdd-test-writer`).
- Debe usar el API estándar `Intl.NumberFormat` del runtime — sin dependencias externas.
- Identificadores en inglés (`conventions.md` §8); el archivo respeta el máximo de 300 líneas y 100 columnas.
- Fixtures disponibles: ninguno.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
