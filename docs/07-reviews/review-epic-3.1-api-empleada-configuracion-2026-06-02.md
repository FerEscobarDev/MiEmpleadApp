# Code Review — Epic 3.1: API Empleada y Configuración

**Fecha:** 2026-06-02
**Rango revisado:** `4d7cd2f` (RED) .. `1e6b7d1` (GREEN) + fix de review.
**Specs:** `empleada-api`, `configuracion-api`.
**Estado:** **APPROVED**

## Dimensión 1 — Conformidad con el spec y el contrato
- Las 4 operaciones implementadas coinciden EXACTAMENTE con el contrato:
  `obtenerEmpleada` (GET `/api/v1/empleada`), `actualizarEmpleada` (PUT `/api/v1/empleada`),
  `obtenerConfiguracion` (GET `/api/v1/configuracion`), `actualizarConfiguracion` (PUT `/api/v1/configuracion`).
- DTOs `Empleada` y `Configuracion` con los campos del contrato; enum `DiaSemana` validado.
- Envelope de error único `{ code, message, details? }`; validación → `422`; ficha ausente → `404`.
- RN-18: GET de configuración sin fila devuelve `salarioBase 700000`, `diasLaborales []`, sin materializar.
- Todos los AC/EC de ambos specs cubiertos por tests verdes (19 tests).

## Dimensión 2 — Arquitectura y boundaries (§6)
- Los Route Handlers no contienen lógica de negocio ni acceden a Prisma directamente:
  delegan en servicios de aplicación → repositorio.
- **Hallazgo (resuelto en el loop):** la costura `getCurrentEmpleadaId()` accedía a `db`
  directamente (`db.empleada.findFirst`), violando §6 ("solo la capa de persistencia toca la
  base"). Corregido: se añadió `buscarPrimeraEmpleadaId()` al repositorio y la costura lo consume.
- Costura de auth claramente marcada con `TODO(Epic 4.2)`; sin chequeo de rol falso (RN-13 diferido).

## Dimensión 3 — Convenciones
- Archivos kebab-case, funciones camelCase, identificadores en inglés/español (§8), 2 espacios,
  semicolons, líneas < 100, archivos < 300. Logging de errores de frontera con `console.error` (§6).
- Zod como única librería de validación de frontera (§5.4); no se añadieron otras dependencias.

## Dimensión 4 — Honestidad TDD
- `git diff 4d7cd2f..HEAD -- src/**/*.test.{ts,tsx}` vacío: los tests sellados en RED no se tocaron.
- RED y GREEN en commits separados.

## Verificación
- `vitest run` (suite completa): verde. `tsc --noEmit`: sin errores. `next lint`: sin warnings/errores.
