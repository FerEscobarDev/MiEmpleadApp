# MiEmpleadApp

PWA full-stack para llevar el control del salario, días trabajados, pagos adicionales, menús de cocina y tareas diarias de una empleada doméstica en Colombia, con roles de **empleador** (configura todo) y **empleada** (consulta).

This project uses **Specture** as its AI-assisted development methodology.

The project-specific configuration lives in `.specture/`:
- `stack.yml` — technical stack (single source of truth): Next.js (App Router, TypeScript) full-stack + SQLite + Prisma + Auth.js + Tailwind + shadcn/ui + Vitest, desplegado en VPS con Docker/Dokploy.
- `conventions.md` — naming, patterns, code style, reglas de negocio (moneda COP, festivos Ley Emiliani, roles).
- `decisions/` — Architecture Decision Records (ver `001-initial-stack.md`).

To work with Specture on this project, invoke `/specture:start`
(plugin) or ask to "continuar con el roadmap" / "iniciar el proyecto".
Specture routing is opt-in — it does not run automatically.
