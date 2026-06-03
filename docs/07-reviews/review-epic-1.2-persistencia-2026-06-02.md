# Code Review — Epic 1.2 (Persistencia y Prisma)

**Fecha:** 2026-06-02
**Rango revisado:** `d6cd71b` (RED) .. `c30164a` (GREEN) + fix de formato
**Specs:** `epic-1.2-persistencia/prisma-schema-and-client`, `epic-1.2-persistencia/data-access-modules`
**Estado:** **APPROVED**

## Dimensión 1 — Corrección y adherencia al spec

- Las 6 AC de `prisma-schema-and-client` (AC-1..AC-6) y las 6 AC de `data-access-modules` (AC-1..AC-6) están cubiertas por tests que pasan (26/26 en la suite completa).
- RN-10 (unicidad mes/año) impuesta por índice único compuesto `Liquidacion(empleadaId, anio, mes)` y verificada a nivel de schema (AC-3) y de repositorio (AC-4).
- RN-09 (congelamiento): campos congelables presentes (`salarioBaseCongelado`, `diasLaboralesCongelado`, `totalCongelado`, snapshot `LiquidacionItem.nombre/valorUnitario`). EC-2 verifica que el snapshot sobrevive al borrado del item (`onDelete: SetNull`, `itemId` opcional).
- Las 13 entidades de §4 modeladas con cardinalidades correctas (1-1 empleador/empleada, config, menú; 1-N items, liquidaciones, etc.) y cascadas de composición (EC-1).
- Round-trip JSON de `diasLaborales`/`comidas` verificado (AC-4 / AC-6).

## Dimensión 2 — Convenciones y arquitectura

- Boundary §6: **solo** `src/lib/db.ts` instancia `PrismaClient` (verificado por grep). Repositorios y factory consumen el singleton.
- Repositorios delgados, sin lógica de negocio (conventions.md §4). Cálculo/congelamiento quedan para Milestones 2/5 según spec.
- Sin `null` en firmas públicas: las búsquedas devuelven `T | undefined` (conventions.md §6).
- Naming kebab-case, identificadores en inglés, comentarios en español, 2 espacios, comillas dobles, punto y coma (conventions.md §1/§5/§8).
- Montos como `Int` (RN-16); enums (`estado`, `diaSemana`, `periodicidad`) como `String` con default; ids `cuid`; campos estructurados como `Json` (architecture.md §4 Nota SQLite).
- Provider `sqlite`; WAL habilitado en el cliente (ADR-002); expectativa de volumen persistente documentada en `.env.example` (despliegue → Epic 9.1).

## Dimensión 3 — Seguridad y robustez

- El PRAGMA WAL falla de forma silenciosa y no tumba el arranque (bases `:memory:`/entornos sin WAL).
- Sin secretos commiteados: `.env` ignorado; `.env.example` documenta la conexión. Archivos `*.db` ignorados.
- Base de pruebas aislada en un archivo temporal del SO, recreada y limpiada por el global setup de Vitest; sin mocks de la DB (conventions.md §7).

## Dimensión 4 — Honestidad TDD

- TDD Honesty Gate: `git diff d6cd71b..c30164a -- 'src/**/*.test.ts' 'src/**/*.test.tsx'` → **vacío**. Ningún test fue modificado, borrado, saltado ni renombrado entre RED y GREEN. RED y GREEN en commits separados; el implementer no tocó tests.

## Gates automáticos

- `tsc --noEmit`: limpio (0 errores).
- `next lint` (ESLint): sin warnings ni errores.
- `prettier --check`: archivos de producción conformes (los 3 archivos de test quedan con el formato del commit RED — sellados).
- Suite Vitest: 26/26 pasan.

**Veredicto: APPROVED.**
