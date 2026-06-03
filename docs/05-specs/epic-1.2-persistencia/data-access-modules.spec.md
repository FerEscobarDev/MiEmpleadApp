# SPEC: Módulos de acceso a datos por feature + factory de pruebas — id: epic-1.2-persistencia/data-access-modules

**Epic:** [Epic 1.2 — Persistencia y Prisma](../../04-roadmap/ROADMAP.md)   **Módulo:** [§2.5 Persistencia](../../02-architecture/architecture.md#25-capa-de-persistencia-prisma)

## Objetivo

Proveer una capa **delgada** de acceso a datos por feature (estilo repositorio) sobre el cliente Prisma único, que los epics de API posteriores extenderán, y un **factory/builder de pruebas** (patrón builder, conventions.md §7) para construir datos de prueba (empleador, empleada, configuración, liquidación) sin duplicación. Cada repositorio usa exclusivamente el cliente `src/lib/db.ts`; ninguno instancia su propio `PrismaClient`.

## Fuera de Scope (NO testear, NO implementar)

- Definición del schema Prisma, el cliente `src/lib/db.ts`, la migración y WAL → ya cubiertos por el spec hermano `prisma-schema-and-client` (dependencia dura).
- Lógica de negocio: cálculo de valor-día, festivos, congelamiento al cerrar, validación de inasistencias (RN-01..RN-09) → Milestones 2 y 5. Aquí los repositorios solo persisten/leen; NO calculan ni validan reglas de negocio.
- Validación Zod, autorización por rol, route handlers, server actions, UI.
- CRUD exhaustivo de todas las entidades: aquí se entregan repositorios **base mínimos** para los features `config` (empleador/empleada/configuración), `liquidacion` y un repositorio común; los epics de API añadirán las operaciones que falten.
- Menú y tareas: NO se crean sus repositorios en este spec (los crearán los Epics 6.1/6.2 sobre el mismo patrón). El schema sí existe (spec hermano), pero la capa de acceso de menú/tareas queda fuera.

## Operaciones del Contrato de API

N/A — lógica interna de persistencia. No toca ningún boundary HTTP.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Funciones de repositorio reciben datos planos tipados (derivados de los tipos generados por Prisma) y devuelven entidades. Reciben el cliente Prisma vía import del singleton (no se inyecta por parámetro en el caso base). |
| Salidas (éxito) | Entidades persistidas/leídas (tipos de Prisma). Lecturas que pueden no existir devuelven el tipo opcional explícito (la entidad o `undefined`), nunca `null` en la firma pública (conventions.md §6). |
| Salidas (error) | Errores de infraestructura (DB caída, violación de constraint inesperada) se propagan como excepción (conventions.md §6). Errores de negocio NO aplican en esta capa (no hay reglas de negocio aquí). |
| Efectos secundarios | Escrituras/lecturas en SQLite vía el cliente único. |
| Idempotencia | Las creaciones NO son idempotentes (crean filas nuevas). Las lecturas son puras respecto al estado. El factory de pruebas crea datos nuevos en cada invocación. |

## Reglas de Negocio

- **BR-1 (boundary §6 — cliente único):** todo repositorio importa y usa el cliente de `src/lib/db.ts`; está **prohibido** instanciar `PrismaClient` en cualquier otro archivo. — fuente: architecture.md §6, conventions.md §3/§4.
- **BR-2 (capa delgada):** los repositorios NO contienen lógica de negocio (cálculo, festivos, congelamiento). Son traducción directa a llamadas Prisma. La orquestación de reglas vive en la Capa de Aplicación (Milestones futuros). — fuente: architecture.md §2.3/§2.5, conventions.md §4.
- **BR-3 (RN-10 expuesta por la capa de datos):** el repositorio de liquidación ofrece una forma de buscar la liquidación de un `(empleadaId, anio, mes)` (devolviendo la entidad o `undefined`), de modo que los epics de API puedan implementar "una sola por mes/año" sin duplicar lógica de consulta. La unicidad real la impone el índice del schema (spec hermano). — fuente: business_requirements.md RN-10.
- **BR-4 (factory builder — testing):** se provee un helper de pruebas con patrón **builder** para crear datos de prueba con valores por defecto sensatos y overrides parciales (p. ej. construir un `Empleador`+`Empleada`+`Configuracion` listos, o una `Liquidacion` para un mes/año). El default de salario base es 700000 (RN-18). — fuente: conventions.md §7, business_requirements.md RN-18.
- **BR-5 (no null en firmas públicas):** las lecturas "buscar por X" devuelven la entidad o `undefined` (tipo opcional explícito), no `null`. — fuente: conventions.md §6.

## Criterios de Aceptación (≥1 test por ID)

> Todos los tests corren contra una base SQLite **real desechable** (archivo temporal o `:memory:` vía Prisma), creada en `beforeEach`/`beforeAll` y destruida en teardown. Sin mocks de la DB (conventions.md §7: el dominio/datos se prueban con datos reales).

- **AC-1:** El repositorio de empleada/configuración crea un `Empleador` con su `Empleada` y la `Configuracion` asociada, y permite leer la empleada de un empleador con su configuración. La lectura devuelve la entidad esperada.
- **AC-2:** Buscar la empleada de un `empleadorId` inexistente devuelve `undefined` (no lanza, no `null`).
- **AC-3 (RN-10):** El repositorio de liquidación crea una liquidación para `(empleadaId, anio, mes)` y, al buscarla por esa misma tripleta, la encuentra; buscar una tripleta sin liquidación devuelve `undefined`.
- **AC-4 (RN-10, constraint):** Intentar crear dos liquidaciones con la misma tripleta `(empleadaId, anio, mes)` mediante el repositorio resulta en error (propagado desde el constraint único); con `mes` distinto, ambas se crean.
- **AC-5 (factory builder):** El factory construye un agregado `Empleador`+`Empleada`+`Configuracion` persistido con valores por defecto (salario base 700000) y permite overrides parciales (p. ej. nombre de la empleada, salario base); los datos construidos existen en la base y reflejan los overrides.
- **AC-6 (JSON vía repositorio):** Al crear/leer la configuración con `diasLaborales` mediante el repositorio, la estructura JSON se conserva en el round-trip.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)

- **EC-1:** Crear una `Configuracion` para una `empleadaId` que ya tiene configuración falla (FK única, propagado) → una configuración por empleada.
- **EC-2:** El factory invocado dos veces crea agregados **distintos** (ids diferentes), sin colisión de unicidad (cada empleador/empleada es independiente).
- **EC-3:** Buscar la liquidación de una empleada en un mes sin liquidación devuelve `undefined`, no una entidad vacía ni excepción.

## Superficie de Código Existente (para el implementer)

- **Llama a:** el cliente único exportado por `src/lib/db.ts` (creado en el spec hermano) — firma: instancia `PrismaClient` exportada (export nombrado, p. ej. `db`/`prisma`). Usar los modelos generados (`db.empleador`, `db.empleada`, `db.configuracion`, `db.liquidacion`, ...).
- **Crea:** `src/features/config/data/empleada-repository.ts` (o ruta equivalente bajo `src/features/config/`, kebab-case) — funciones delgadas: crear empleador+empleada+configuración, buscar empleada por `empleadorId` (devuelve entidad o `undefined`), leer configuración de una empleada.
- **Crea:** `src/features/liquidacion/data/liquidacion-repository.ts` — funciones delgadas: crear liquidación, buscar por `(empleadaId, anio, mes)` (devuelve entidad o `undefined`), listar por empleada.
- **Crea:** helper de pruebas con patrón builder, p. ej. `src/lib/test/factories.ts` (o `src/test/factories.ts`) — builders para empleador/empleada/configuración y liquidación, con defaults (salario base 700000) y overrides parciales. Reutilizable por specs futuros (no duplicar en cada test).
- **Crea (soporte de pruebas):** un helper para levantar/limpiar la base SQLite de prueba (aplicar schema vía `prisma db push`/`migrate deploy` sobre una base desechable y truncar/eliminar en teardown). Documentar el mecanismo elegido en un comentario del helper.
- Fixtures disponibles: ninguno previo de negocio; este spec **crea** el factory que los specs posteriores reutilizarán. `src/lib/currency.ts` (`formatCOP`) existe pero no es relevante aquí.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
