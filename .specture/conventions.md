# Convenciones del Proyecto — MiEmpleadApp

> Este archivo describe las convenciones específicas que el equipo (humano + IA) debe seguir en este proyecto. Es leído por todos los skills y agentes de Specture antes de generar código, specs o reviews. Cuando una convención aquí entra en conflicto con una regla genérica del framework, **gana esta convención**.

## 1. Naming

- **Variables y funciones:** camelCase
- **Clases / tipos / componentes React:** PascalCase
- **Constantes globales:** UPPER_SNAKE_CASE
- **Archivos:** kebab-case.ts para módulos, lógica y rutas (`salary-calculator.ts`); PascalCase.tsx para componentes React (`MonthCalendar.tsx`)
- **Tests:** `*.test.ts` / `*.test.tsx`
- **Carpetas:** kebab-case

## 2. Organización de Archivos

- **Estructura por:** feature (cada dominio del negocio en su carpeta: `config`, `liquidacion`, `menu`, `tareas`, `auth`)
- **Co-localización:** tests junto al código que prueban (`salary-calculator.ts` + `salary-calculator.test.ts`)
- **Tamaño máximo de archivo (líneas):** 300
- **Ejemplos de jerarquía esperada:**
  ```
  src/
    app/                      # Next.js App Router (rutas, layouts, route handlers)
      (employer)/             # rutas solo para el rol empleador
      (employee)/             # rutas de consulta para el rol empleada
      api/                    # Route Handlers (REST)
    features/
      liquidacion/
        domain/               # lógica pura (cálculo de pago, días, festivos)
        components/           # UI específica del feature
        actions.ts            # Server Actions
        liquidacion.test.ts
      config/
      menu/
      tareas/
    components/ui/            # componentes shadcn/ui compartidos
    lib/                      # utilidades transversales (formato moneda, db client)
    prisma/                   # schema y migraciones
  ```

## 3. Patrones Permitidos (Allow-list)

- Pure functions en la capa de dominio (`features/*/domain`) — sin acceso a DB ni a `Date.now()` implícito; las fechas se reciben como parámetro.
- Server Actions / Route Handlers como única frontera de escritura/lectura hacia la DB.
- Acceso a datos centralizado vía cliente Prisma único (`lib/db.ts`).
- Validación de entradas con Zod en la frontera (actions/handlers).
- Result/return explícito para errores esperables del negocio (ej. mes ya liquidado); excepciones solo para fallos inesperados.

## 4. Patrones Prohibidos (Deny-list)

- Lógica de negocio (cálculo de salario, festivos, descuentos) dentro de componentes React o de route handlers.
- Acceso directo a Prisma desde componentes de cliente (`"use client"`).
- Cálculos monetarios con `number` flotante para acumulados sensibles sin redondeo controlado a pesos (COP no usa decimales en la UI).
- Hardcodear festivos colombianos a mano: usar una librería que aplique la Ley Emiliani.
- Singletons mutables y estado global compartido fuera de los mecanismos de React/Server.

## 5. Estilo de Código

- **Indentación:** 2 espacios
- **Comillas:** dobles en TSX/JSX, según ESLint/Prettier en TS
- **Punto y coma:** obligatorios
- **Longitud máxima de línea:** 100
- **Comentarios:** solo para "por qué", no para "qué hace"

## 6. Manejo de Errores

- **Estrategia primaria:** retorno explícito de resultados para errores de negocio esperables; `throw` solo para errores inesperados / de infraestructura.
- **Logging obligatorio en:** errores de frontera (route handlers, actions) e integraciones externas (DB, auth).
- **Política con `null`/`undefined`:** evitar `null` en tipos públicos; usar tipos opcionales explícitos y narrowing.

## 7. Testing

- **Política TDD:** Recomendada (test-first para la lógica de dominio crítica: cálculo de pago, conteo de días L-S, festivos. Test-after tolerado para UI trivial).
- **Niveles requeridos:** unit (dominio) + integration (componentes con React Testing Library, actions con DB de prueba).
- **Mocks:** permitidos solo para integraciones externas (auth, fecha actual). El dominio se prueba con datos puros, sin mocks.
- **Setup/teardown:** builders/factories para datos de prueba (empleada, configuración, mes).

## 8. Idioma del Código

- **Identificadores (variables, clases, funciones):** inglés
- **Comentarios:** español
- **Mensajes de commit:** conventional commits, descripción en español
- **Documentación pública (READMEs, ADRs):** español
- **Texto visible en la UI:** español (Colombia)

## 9. Reglas Específicas del Equipo / Cliente

- **Moneda:** formatear siempre con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`. Centralizar en `lib/currency.ts`.
- **Festivos:** usar librería de festivos colombianos que considere la Ley Emiliani; calcular cuáles caen en L–S para NO descontarlos del salario.
- **Roles:** el rol `empleador` configura y edita todo; el rol `empleada` solo consulta (lectura). Esta regla se valida en cada frontera de escritura.
- **Cálculo base:** valor por día = salario mensual ÷ total de días a laborar en el mes; los días de inasistencia se descuentan; el mes de inicio de contrato puede ser parcial.
- **Zona horaria:** trabajar fechas en zona horaria de Colombia (America/Bogota) para el conteo de días y festivos.

## 10. Specture / Claude Code Integration

> Toggles opt-in para las capacidades nativas de Claude Code que Specture integra.

- **hooks.enabled**: false
- **context7.enabled**: false
- **build.max_parallel_epics**: 3
