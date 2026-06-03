# ADR-001: Stack inicial — PWA full-stack con Next.js, Postgres y Prisma

> Architecture Decision Record inicial del proyecto MiEmpleadApp.

## Status

`Accepted` — la decisión de **base de datos y despliegue** (PostgreSQL gestionado + Vercel) fue **superseded por ADR-002** (SQLite + VPS Docker/Dokploy). El resto del stack (Next.js full-stack, Prisma, Auth.js, Tailwind, shadcn/ui, Vitest, arquitectura modular por feature) **sigue vigente**.

## Context

MiEmpleadApp debe permitir que un **empleador** configure y registre el control de salario, días trabajados, pagos adicionales, menús de cocina y tareas diarias de una empleada doméstica en Colombia, y que la **empleada** consulte esa información (solo lectura). Los datos deben ser **compartidos** entre ambos roles desde sus propios dispositivos, lo que descarta un almacenamiento puramente local. Se busca una experiencia tipo app instalable en el teléfono (PWA) con una sola base de código sencilla de desarrollar y desplegar para un proyecto de tamaño pequeño/mediano.

## Decision

Usaremos **Next.js (App Router, TypeScript)** como aplicación **full-stack** (frontend + backend vía Route Handlers y Server Actions), con **PostgreSQL** gestionado y **Prisma** como ORM, **Auth.js (NextAuth)** para autenticación y roles, **Tailwind CSS + shadcn/ui** para la interfaz, y **Vitest + React Testing Library** para pruebas unitarias y de integración. Arquitectura: monolito modular organizado **por feature**, con la lógica de negocio (cálculo de pago, conteo de días L–S, festivos) aislada en una capa de dominio de funciones puras. Despliegue previsto en **Vercel** con Postgres administrado (Neon/Supabase).

## Alternatives Considered

- **Almacenamiento solo local (localStorage/IndexedDB):** descartado porque empleada y empleador no compartirían los mismos datos entre dispositivos.
- **Backend separado (NestJS) + Next.js solo frontend:** descartado por complejidad y doble despliegue innecesarios para el tamaño del proyecto.
- **Supabase como BaaS completo (DB + Auth integrados):** opción válida, pero se prefirió Prisma + Auth.js por mayor control del modelo de datos y portabilidad del backend.
- **App móvil nativa (Flutter/React Native):** descartada por mayor costo de build y publicación frente a una PWA instalable suficiente para el caso de uso.

## Consequences

### Positivas
- Una sola base de código y un solo despliegue (Vercel) → fricción mínima.
- Tipado end-to-end (TypeScript + Prisma) reduce errores en cálculos sensibles de salario.
- Datos compartidos por roles con autenticación estándar (Auth.js).
- Dominio de cálculo aislado y testeable con TDD (funciones puras).

### Negativas / Trade-offs aceptados
- Dependencia del ecosistema Next.js/Vercel y de un proveedor de Postgres gestionado.
- La lógica de negocio y la presentación conviven en un mismo proyecto: requiere disciplina para no filtrar lógica de dominio a la UI (ver `conventions.md` §4).
- PWA: sin presencia en tiendas de aplicaciones.

### Implicaciones operativas
- Skills/agentes afectados: el `code-reviewer` debe verificar que (a) no haya lógica de negocio en componentes/handlers, (b) los cálculos monetarios usen el formateo COP centralizado, (c) los festivos provengan de una librería con Ley Emiliani, y (d) las escrituras respeten el rol `empleador`.
- ¿Requiere actualizar `stack.yml`? No (se generó con esta decisión).
- ¿Requiere actualizar `conventions.md`? No (se generó con esta decisión).

## Date

`2026-06-02`
