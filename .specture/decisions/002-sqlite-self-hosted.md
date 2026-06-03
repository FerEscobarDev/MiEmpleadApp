# ADR-002: SQLite (vía Prisma) y despliegue auto-gestionado con Docker/Dokploy

> Supersede parcialmente al ADR-001 en lo referente a base de datos y despliegue.

## Status

`Supersedes ADR-001 (solo base de datos y despliegue)`

El resto del stack definido en ADR-001 (Next.js full-stack, Prisma, Auth.js, Tailwind + shadcn/ui, Vitest, monolito modular por feature, dominio puro) permanece **Accepted** y vigente.

## Context

ADR-001 había elegido PostgreSQL gestionado desplegado en **Vercel (serverless)** para garantizar datos compartidos entre empleador y empleada. Posteriormente se decidió que el despliegue **no** será en Vercel sino en un **VPS propio con Docker, orquestado por Dokploy**. Esto elimina la restricción que motivaba Postgres: en serverless el filesystem es efímero y no compartido, lo que impedía usar un archivo SQLite local; en un contenedor de larga vida con **volumen persistente**, ambos usuarios pegan contra el mismo servidor y un archivo SQLite es perfectamente válido y compartido.

El dominio es de muy baja concurrencia de escritura (un empleador escribe; una empleada consulta y marca tareas) y de volumen de datos mínimo (una sola empleada por cuenta), escenario ideal para SQLite.

## Decision

Usaremos **SQLite** como base de datos primaria, accedida mediante **Prisma**, con el archivo de base de datos en un **volumen persistente de Docker**. El despliegue será en un **VPS auto-gestionado con Docker y Dokploy**. Se habilitará el **modo WAL** de SQLite para mejorar la concurrencia lectura/escritura y los **backups** se harán por copia periódica del archivo `.db`. La aplicación correrá como **una sola instancia** (sin escalado horizontal con múltiples escritores).

## Alternatives Considered

- **Mantener PostgreSQL en un contenedor del VPS (Dokploy):** válido y más robusto en concurrencia/backups, pero añade un servicio extra y credenciales que el tamaño de la app no justifica (YAGNI).
- **SQLite en la nube vía Turso/libSQL:** necesario solo si el hosting fuera serverless; al ser VPS con disco persistente, no aporta valor frente a SQLite local.
- **SQLite local en Vercel:** descartado en ADR-001 por filesystem efímero; ya no aplica al cambiar el hosting.

## Consequences

### Positivas
- Un servicio menos que operar: no hay contenedor ni proceso de base de datos aparte.
- Setup y backups triviales (archivo único); arranque más simple en Dokploy.
- Prisma abstrae el motor: el modelo de datos y el código del proyecto son prácticamente idénticos a los de Postgres.
- Rendimiento excelente para el volumen y la concurrencia reales de la app.

### Negativas / Trade-offs aceptados
- **Una sola instancia escritora:** no se puede escalar horizontalmente con múltiples réplicas que escriban. Aceptable para esta app.
- Requiere **volumen persistente** correctamente montado en Docker/Dokploy; si se omite, los datos se pierden en cada redeploy.
- Concurrencia de escritura inferior a Postgres (mitigada con WAL; irrelevante aquí).
- Backups y migraciones son responsabilidad propia (no hay servicio gestionado).

### Implicaciones operativas
- Skills/agentes afectados: el `code-reviewer` y los specs deben asumir `provider = "sqlite"` en Prisma. El epic de despliegue debe garantizar volumen persistente + WAL + backup del archivo.
- ¿Requiere actualizar `stack.yml`? **Sí** (`database.primary: sqlite`, `devops.containerization: docker`, `devops.hosting: self-hosted`). Hecho.
- ¿Requiere actualizar `architecture.md`? **Sí** (§1 Stack de Referencia y §2.5 Persistencia). Hecho.
- ¿Requiere actualizar el ROADMAP? **Sí** (Epic 1.2 Persistencia y Epic 9.1 Despliegue). Hecho.
- ¿Requiere actualizar `conventions.md`? No (las convenciones referencian Prisma de forma agnóstica al motor).

## Date

`2026-06-02`
