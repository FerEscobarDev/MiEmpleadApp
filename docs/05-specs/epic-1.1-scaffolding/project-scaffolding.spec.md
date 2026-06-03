# SPEC: Scaffolding del proyecto Next.js — id: epic-1.1-scaffolding/project-scaffolding

**Epic:** [Epic 1.1 — Scaffolding del proyecto](../../04-roadmap/ROADMAP.md#milestone-1-foundation)   **Módulo:** [§2.1 Capa de Presentación](../../02-architecture/architecture.md#21-capa-de-presentación-ui), base del proyecto.

## Objetivo
Inicializar el proyecto Next.js (App Router, TypeScript) con Tailwind CSS, ESLint + Prettier, Vitest + React Testing Library y la estructura de carpetas por feature definida en `conventions.md` §2, de modo que el proyecto compile, pase type-check, lint limpio y tenga la suite de Vitest operativa. Esta es la base sobre la que se construyen el resto de los epics.

## Fuera de Scope (NO testear, NO implementar)
- Prisma / base de datos / cliente `lib/db` (es Epic 1.2).
- Auth.js / autenticación (es Epic 4.1).
- Componentes shadcn/ui, Design System y ruta `/dev/design-system` (es Epic 7.1); aquí solo la línea base de Tailwind.
- El helper de moneda `lib/currency` (lo cubre el spec hermano `currency-helper`).
- Configuración de PWA / service worker (es Epic 9.1).
- Cliente tipado del contrato de API (es Epic 7.1).
- Dockerfile / despliegue (es Epic 9.1).
- Cualquier librería no declarada en `stack.yml`.

## Operaciones del Contrato de API
N/A — no toca boundary HTTP. El epic no implementa ni consume ninguna operación del contrato.

## Contrato (machine-readable)
> Spec de infraestructura/configuración: no expone una API de negocio. El "contrato" aquí es el conjunto de artefactos de proyecto que deben existir y las propiedades verificables del entorno.

| Aspecto | Detalle |
|---------|---------|
| Entradas | Comandos de inicialización del scaffolding (Next.js, npm) ejecutados por el implementer en el directorio raíz del proyecto. |
| Salidas (éxito) | Proyecto Next.js con: `package.json` con scripts `dev`, `build`, `start`, `lint`, `test`; App Router en `src/app/`; Tailwind configurado; ESLint + Prettier configurados y conciliados; Vitest + React Testing Library configurados con un entorno jsdom; estructura por feature creada. `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run test` terminan con éxito. |
| Salidas (error) | N/A — sin boundary de negocio. Un fallo de build/lint/type-check/test es un fallo de verificación, no un error de runtime de negocio. |
| Efectos secundarios | Creación de archivos de configuración y de la estructura de carpetas en el repositorio. No hay persistencia en base de datos. |
| Idempotencia | N/A. |

## Reglas de Negocio
- **BR-1:** Idioma del código — identificadores en inglés, texto visible en la UI en español (Colombia). Fuente: `conventions.md` §8.
- **BR-2:** Estructura por feature — cada dominio del negocio en su carpeta; utilidades transversales en `lib/`; co-localización de tests junto al código. Fuente: `conventions.md` §2.
- **BR-3:** Estilo de código — indentación 2 espacios, punto y coma obligatorios, longitud máxima de línea 100, tamaño máximo de archivo 300 líneas. Estas reglas se materializan en la configuración de Prettier/ESLint. Fuente: `conventions.md` §5, §2.
- **BR-4:** Stack fijo — Next.js (App Router, TypeScript), Tailwind, ESLint, Prettier, Vitest + React Testing Library, npm. No agregar librerías fuera de las declaradas en `stack.yml`. Fuente: `stack.yml`, ADR-001.

## Criterios de Aceptación (≥1 test por ID)
> Esta es una spec de scaffolding/configuración: sus criterios se verifican por la ejecución de comandos del proyecto (build/lint/type-check/test), NO por tests unitarios escritos a mano. El spec hermano `currency-helper` aporta la lógica con tests RED/GREEN.

- **AC-1:** El proyecto compila: `npm run build` termina con código de salida 0, sin errores.
- **AC-2:** El type-check pasa: `npx tsc --noEmit` termina con código 0, sin errores de tipos.
- **AC-3:** El lint está limpio: `npm run lint` termina con código 0, sin errores ni warnings de ESLint.
- **AC-4:** La suite de pruebas corre: `npm run test` ejecuta Vitest en modo run (no watch) y termina con código 0.
- **AC-5:** Existe la estructura por feature de `conventions.md` §2: `src/app/` (App Router), `src/lib/`, y las carpetas de features base (`config`, `liquidacion`, `menu`, `tareas`, `auth`) bajo `src/features/`. Las carpetas vacías se preservan en git (p. ej. con `.gitkeep`).
- **AC-6:** Vitest está configurado con entorno jsdom y React Testing Library disponible, de modo que un test que renderice un componente React pueda ejecutarse (el setup de RTL está cargado).
- **AC-7:** Prettier y ESLint están conciliados (sin reglas en conflicto): formatear con Prettier no produce errores de ESLint y viceversa.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** El directorio raíz no está vacío (contiene `.git`, `docs/`, `.specture/`, `CLAUDE.md`, `LICENSE`, archivos `.md`). → La inicialización debe integrarse en el directorio existente sin borrar ni sobrescribir esos archivos; en particular `CLAUDE.md`, `LICENSE`, `docs/`, `.specture/` y `.gitignore` existentes deben preservarse (mergear el `.gitignore` de Next.js con el existente en vez de reemplazarlo).
- **EC-2:** Vitest podría intentar ejecutar archivos de Next.js o de E2E. → La configuración de Vitest debe limitar el descubrimiento de tests a archivos `*.test.ts` / `*.test.tsx` dentro de `src/`.
- **EC-3:** El script `test` no debe quedar en modo watch (bloquearía la verificación de CI/orquestador). → Debe ejecutarse en modo `run` de una sola pasada.

## Superficie de Código Existente (para el implementer)
- Directorio raíz del proyecto: `C:\Proyectos\MiEmpleadApp` — ya contiene `.git/`, `.gitignore`, `.gitattributes`, `CLAUDE.md`, `LICENSE`, `docs/`, `.specture/`, `InformacionControlSalarioEmpleada.md`. NO borrar ninguno.
- Crea: `package.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*` (o configuración Tailwind v4 vía PostCSS), `postcss.config.*`, configuración de ESLint, configuración de Prettier, `vitest.config.ts`, archivo de setup de Vitest (carga `@testing-library/jest-dom`), `src/app/layout.tsx`, `src/app/page.tsx`, estilos globales con directivas de Tailwind, y la estructura `src/features/{config,liquidacion,menu,tareas,auth}/` + `src/lib/` con `.gitkeep` donde haga falta.
- Package manager: **npm**. Runtime: Node (entorno tiene Node 24; el proyecto declara Node 20 — compatible).
- Plataforma: Windows 11, PowerShell. Usar rutas y comandos compatibles con Windows.
- Fixtures disponibles: ninguno todavía.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
