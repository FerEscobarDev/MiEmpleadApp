# SPEC: Schema Prisma (SQLite) y cliente único — id: epic-1.2-persistencia/prisma-schema-and-client

**Epic:** [Epic 1.2 — Persistencia y Prisma](../../04-roadmap/ROADMAP.md)   **Módulo:** [§2.5 Persistencia](../../02-architecture/architecture.md#25-capa-de-persistencia-prisma), [§4 Modelo de Datos](../../02-architecture/architecture.md#4-modelo-de-datos-inicial)

## Objetivo

Incorporar Prisma al proyecto con provider `sqlite`, definir el schema de **todas** las entidades del modelo de datos (§4) respetando relaciones, restricciones de unicidad e invariantes que el motor pueda imponer, generar la migración inicial y exponer un **cliente Prisma único** (`src/lib/db.ts`) como singleton para evitar múltiples instancias en desarrollo. Es la base de persistencia sobre la que se construirán los módulos de acceso a datos y, más adelante, las APIs.

## Fuera de Scope (NO testear, NO implementar)

- Módulos de acceso a datos por feature (repositorios) y el factory/builder de pruebas → van en el spec hermano `data-access-modules`.
- Rutas API, Server Actions, servicios de aplicación, lógica de dominio (cálculo), autenticación, UI.
- Lógica de congelamiento (RN-09): aquí solo existen los **campos** congelados en `Liquidacion` / `LiquidacionItem`; la lógica que los rellena al cerrar vive en Milestone 5.
- Validación Zod de los enums-como-String: ocurre en la frontera (epics de API), no aquí.
- Configuración de despliegue (volumen persistente Docker/Dokploy) → Epic 9.1. Aquí solo se documenta la expectativa y se habilita el modo WAL a nivel de conexión.
- Seed de datos de producción.

## Operaciones del Contrato de API

N/A — lógica interna de persistencia. No toca ningún boundary HTTP.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | N/A (no es una función de negocio; es schema + cliente). El cliente exporta una instancia `PrismaClient`. |
| Salidas (éxito) | `src/lib/db.ts` exporta `prisma` (o export nombrado `db`): una instancia única de `PrismaClient`. El schema compila y la migración inicial aplica sin error sobre SQLite. |
| Salidas (error) | Conexión inválida / archivo no escribible → Prisma lanza al usar el cliente (error de infraestructura, no de negocio). |
| Efectos secundarios | Genera el cliente Prisma (`@prisma/client`); la migración crea el esquema en el archivo SQLite. En dev, reutiliza la misma instancia entre recargas (singleton vía `globalThis`). |
| Idempotencia | El singleton: importar el módulo varias veces en el mismo proceso devuelve la **misma** instancia. La migración es idempotente respecto al historial de Prisma (no re-aplica migraciones ya aplicadas). |

## Reglas de Negocio

- **BR-1 (RN-10 — unicidad mes/año):** debe existir una sola `Liquidacion` por combinación `(empleadaId, anio, mes)`. El schema impone un índice **único compuesto** sobre `(empleadaId, anio, mes)`. — fuente: business_requirements.md RN-10.
- **BR-2 (RN-09 — congelamiento, solo estructura):** `Liquidacion` incluye los campos congelables `salarioBaseCongelado` (entero, opcional hasta el cierre), `diasLaboralesCongelado` (JSON, opcional) y `totalCongelado` (entero, opcional); `LiquidacionItem` incluye snapshot `nombre` (String) y `valorUnitario` (entero) además de `cantidad`. — fuente: business_requirements.md RN-09.
- **BR-3 (relaciones §4):** las relaciones del diagrama ER se modelan con sus cardinalidades:
  - `Empleador` 1—1 `Empleada` (una empleada por empleador): FK única `empleadorId` en `Empleada`.
  - `Empleador` 1—0..1 `EnlaceAcceso` no es del diagrama; el enlace se asocia a `Empleada` (ver §4: `EnlaceAcceso.empleadaId`). Modelar `EnlaceAcceso` con FK única `empleadaId` (un enlace activo por empleada).
  - `Empleada` 1—1 `Configuracion` (FK única `empleadaId`).
  - `Empleada` 1—1 `MenuConfig` (FK única `empleadaId`).
  - `Empleada` 1—N `ItemAdicional`, `Liquidacion`, `RutinaTarea`.
  - `MenuConfig` 1—N `MenuEntrada`.
  - `RutinaTarea` 1—N `CumplimientoTarea`.
  - `Liquidacion` 1—N `Inasistencia`, `LiquidacionItem`, `MontoPuntual`.
  - `ItemAdicional` 1—N `LiquidacionItem` (relación opcional: el snapshot sobrevive aunque el item se borre; FK `itemId` opcional).
- **BR-4 (enums como String — RN del modelo SQLite):** SQLite+Prisma no soporta enums nativos; `Liquidacion.estado`, `MenuEntrada.diaSemana`, `RutinaTarea.diaSemana`, `MenuConfig.periodicidad` se modelan como `String`. Su dominio (`BORRADOR`/`CERRADA`, días de semana, `SEMANAL`/`QUINCENAL`/`MENSUAL`) se valida en la frontera con Zod (fuera de este spec). — fuente: architecture.md §4 Nota SQLite.
- **BR-5 (JSON):** `Configuracion.diasLaborales`, `Liquidacion.diasLaboralesCongelado` y `MenuConfig.comidas` se persisten como JSON (en SQLite, Prisma usa `String`/`Json` según soporte; usar el tipo `Json` de Prisma si el provider lo admite, si no `String` con (de)serialización explícita documentada). — fuente: architecture.md §4 Nota SQLite.
- **BR-6 (ids cuid):** todos los identificadores primarios son `String` con default `cuid()`. `EnlaceAcceso` usa `token` (String) como su identificador de acceso; puede además tener un `id` cuid o usar `token` como `@id` — elegir `id` cuid + `token` único. — fuente: architecture.md §4 Nota SQLite.
- **BR-7 (montos enteros — RN-16):** todos los montos monetarios (`salarioBase`, `valorUnitario`, `monto`, `*Congelado`) son enteros (`Int`), COP sin decimales. — fuente: business_requirements.md RN-16.
- **BR-8 (cliente único — boundary §6):** ningún otro módulo instancia `PrismaClient`; solo `src/lib/db.ts`. El cliente es un singleton que en desarrollo se guarda en `globalThis` para no crear una instancia por hot-reload. — fuente: architecture.md §6, conventions.md §3/§4.
- **BR-9 (WAL + zona horaria — RN-17):** la conexión SQLite habilita el modo WAL (vía `PRAGMA journal_mode=WAL` ejecutado al inicializar el cliente, o configuración equivalente documentada). La zona horaria America/Bogotá (RN-17) es responsabilidad de la capa de dominio/aplicación que recibe fechas como parámetro; el schema solo almacena fechas/strings y no impone zona. Se documenta que las fechas se guardan en UTC y se interpretan en America/Bogotá aguas arriba. — fuente: ADR-002, business_requirements.md RN-17.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** El módulo `src/lib/db.ts` exporta una instancia de `PrismaClient`. Importarlo dos veces en el mismo proceso (o invocar el getter dos veces) devuelve **la misma** instancia (identidad referencial), demostrando el singleton.
- **AC-2:** Contra una base SQLite de prueba real (archivo temporal o `:memory:` vía Prisma) con el schema aplicado, se puede crear un `Empleador`, su `Empleada` (1—1) y la `Configuracion` de esa empleada, y leerlos de vuelta con sus relaciones.
- **AC-3 (RN-10):** Crear dos `Liquidacion` con el mismo `(empleadaId, anio, mes)` falla por violación del índice único compuesto; cambiar el `mes` (o `anio`, o `empleadaId`) permite la segunda creación.
- **AC-4 (JSON round-trip):** Guardar `Configuracion.diasLaborales` (p. ej. lista de días laborales) y `MenuConfig.comidas` (p. ej. lista de comidas) y volver a leerlos devuelve la **misma** estructura (round-trip sin pérdida).
- **AC-5:** Existe una migración Prisma inicial versionada bajo `prisma/migrations/` que crea todas las tablas de §4; el cliente generado expone modelos para **todas** las entidades de §4 (Empleador, Empleada, Configuracion, EnlaceAcceso, ItemAdicional, Liquidacion, Inasistencia, LiquidacionItem, MontoPuntual, MenuConfig, MenuEntrada, RutinaTarea, CumplimientoTarea).
- **AC-6:** El provider del datasource es `sqlite`; `Liquidacion.estado`, `*.diaSemana` y `MenuConfig.periodicidad` son de tipo `String` en el schema (no enum nativo).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** Borrar una `Liquidacion` debe borrar en cascada sus `Inasistencia`, `LiquidacionItem` y `MontoPuntual` (relación de composición) → configurar `onDelete: Cascade` en esas FKs.
- **EC-2:** Borrar un `ItemAdicional` que ya fue usado en una `LiquidacionItem` NO borra el snapshot histórico (el `LiquidacionItem` conserva `nombre`/`valorUnitario`) → la FK `itemId` es opcional y `onDelete: SetNull` (o sin cascada). El histórico congelado sobrevive (RN-09).
- **EC-3:** Crear una segunda `Empleada` para el mismo `Empleador` falla (FK única `empleadorId`) → una empleada por empleador.
- **EC-4:** Crear una segunda `Configuracion` (o `MenuConfig`) para la misma `Empleada` falla (FK única `empleadaId`).

## Superficie de Código Existente (para el implementer)

- **Crea:** `prisma/schema.prisma` — datasource `sqlite` (`url = env("DATABASE_URL")`), generator `prisma-client-js`, y los 13 modelos de §4 con relaciones, índices únicos y cascadas según BR-3/EC-1/EC-2.
- **Crea:** `src/lib/db.ts` — exporta el singleton `PrismaClient`. Patrón `globalThis` para dev. Habilita WAL al inicializar (PRAGMA o equivalente documentado).
- **Crea:** `prisma/migrations/**` — migración inicial (`init`) generada con `npx prisma migrate dev --name init` (si requiere shadow DB interactiva, usar `--skip-generate` y luego `npx prisma generate`, o `prisma db push` para la base de prueba; documentar el comando usado).
- **Crea/edita:** `.env` y/o `.env.test` con `DATABASE_URL` para SQLite (p. ej. `file:./dev.db` y una base de prueba desechable). Añadir patrones de DB a `.gitignore` (`*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, `prisma/*.db*`).
- **Añade dependencias:** `@prisma/client` (runtime) y `prisma` (dev) vía `npm install`. Añadir script `postinstall`/`db:*` si conviene (opcional, no requerido).
- **Llama a:** `formatCOP` NO aplica aquí. Sin símbolos de negocio existentes a invocar (Epic 1.1 solo dejó `src/lib/currency.ts`).
- Fixtures disponibles: ninguno todavía (el builder de pruebas se crea en el spec hermano). Para los tests de ESTE spec, el test-writer puede crear su propia base SQLite desechable (archivo temporal o `:memory:`) y aplicar el schema con `prisma db push`/`migrate deploy` en el setup; debe limpiarla en teardown.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
