# ROADMAP: MiEmpleadApp

## Visión General

MiEmpleadApp es una PWA full-stack para controlar el pago mensual de **una empleada doméstica informal en Colombia**, junto con la organización de su trabajo diario. El **empleador** configura las reglas (salario, días laborales, conceptos de pago adicional), registra novedades del mes (inasistencias, noches, montos puntuales, notas) y obtiene el **total a pagar** calculado automáticamente; la **empleada** consulta su pago, calendario, menú y tareas por un enlace de solo lectura, y puede marcar sus tareas como hechas.

El núcleo del sistema es el **cálculo proporcional del pago** (valor-día sobre el mes completo, festivos colombianos —Ley Emiliani— pagados y no descontados, meses parciales de inicio/fin, inasistencias) implementado como lógica de dominio pura y testeable. Stack: Next.js full-stack + SQLite/Prisma + Auth.js + Tailwind/shadcn + Vitest, desplegado en VPS con Docker/Dokploy.

## Contexto Técnico

- **Configuración del stack:** [`.specture/stack.yml`](../../.specture/stack.yml) *(fuente de verdad)*
- **Convenciones del proyecto:** [`.specture/conventions.md`](../../.specture/conventions.md)
- **Decisiones registradas (ADRs):** [`.specture/decisions/`](../../.specture/decisions/)
- **Requerimientos de negocio:** [`docs/01-requirements/business_requirements.md`](../01-requirements/business_requirements.md)
- **Arquitectura:** [`docs/02-architecture/architecture.md`](../02-architecture/architecture.md)
- **Contrato de API:** [`docs/02-architecture/api-contract.md`](../02-architecture/api-contract.md) (+ `.openapi.yaml`)
- **UX/UI** *(Fase 3)*: [`docs/03-ux-ui/`](../03-ux-ui/)

---

## Convención de Estados

| Símbolo | Estado | Significado |
|---------|--------|-------------|
| `[ ]` | Pendiente | El epic aún no se ha tocado. |
| `[/]` | En Progreso | Hay un spec activo o un epic-agent trabajando en él. |
| `[x]` | Completado | Todos los specs del epic implementados, revisados (`code-reviewer` APPROVED) y verificados (tests pasan, lint limpio). |

---

## Hitos (Milestones) y Epics

> Ordenados por dependencia. Sintaxis parseable de `Dependencias`: `Ninguna` | `Epic X.Y` | `Milestone N completo`, unibles por comas.

### Milestone 1: Foundation
*Objetivo:* tener el proyecto Next.js operativo con persistencia lista, infraestructura de lint/format/test y el cliente Prisma único.

- [x] **Epic 1.1:** Scaffolding del proyecto
  - **Dependencias:** Ninguna
  - **Descripción:** Inicializar Next.js (App Router, TypeScript), Tailwind, ESLint + Prettier, Vitest + React Testing Library, estructura por feature y helper de moneda COP (`lib/currency`).
  - **Reglas de negocio clave:** [RN-16 (moneda COP)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.1 Presentación](../02-architecture/architecture.md#2-componentes-de-alto-nivel), base del proyecto.
  - **Operaciones del contrato:** ninguna (no toca boundary HTTP).
  - **Specs estimados:** 2

- [x] **Epic 1.2:** Persistencia y Prisma
  - **Dependencias:** Epic 1.1
  - **Descripción:** Definir el schema Prisma inicial (todas las entidades de §4) con provider `sqlite`, configurar la base SQLite (archivo en volumen, modo WAL), migraciones y el cliente único `lib/db`. Como SQLite no soporta enums nativos en Prisma, los enums (estado, día de semana, periodicidad, tipo de día) se modelan como `String` y se validan en la frontera con Zod. Módulos de acceso a datos base por feature.
  - **Reglas de negocio clave:** [RN-09 (congelamiento), RN-10 (unicidad mes/año), RN-17 (zona horaria)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.5 Persistencia](../02-architecture/architecture.md#25-capa-de-persistencia-prisma), [§4 Modelo de Datos](../02-architecture/architecture.md#4-modelo-de-datos-inicial).
  - **Operaciones del contrato:** ninguna.
  - **Specs estimados:** 2

### Milestone 2: Dominio de Cálculo (lógica pura)
*Objetivo:* tener el corazón del negocio —festivos y cálculo de liquidación— como funciones puras, completamente testeadas, sin IO ni HTTP.

- [x] **Epic 2.1:** Servicio de Festivos (Ley Emiliani)
  - **Dependencias:** Epic 1.1
  - **Descripción:** Integrar una librería de festivos colombianos que aplique la Ley Emiliani y exponer "fechas festivas de un mes/año" en zona America/Bogotá.
  - **Reglas de negocio clave:** [RN-03 (festivos no se descuentan), RN-17 (zona horaria)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.7 Servicio de Festivos](../02-architecture/architecture.md#27-servicio-de-festivos-ley-emiliani).
  - **Operaciones del contrato:** ninguna.
  - **Specs estimados:** 1

- [x] **Epic 2.2:** Dominio de cálculo de liquidación
  - **Dependencias:** Epic 2.1
  - **Descripción:** Funciones puras: conteo de días laborales del mes completo, periodo de contrato (inicio/fin parcial), valor-día, descuento de inasistencias, subtotales de items y montos puntuales, total, y construcción del modelo de días del calendario (tipo por día). Recibe fechas/config/festivos como parámetros.
  - **Reglas de negocio clave:** [RN-01, RN-02, RN-03, RN-04, RN-06, RN-07, RN-08](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.4 Dominio](../02-architecture/architecture.md#24-capa-de-dominio-lógica-pura).
  - **Operaciones del contrato:** ninguna (lo consumen los epics de API de liquidación).
  - **Specs estimados:** 3

### Milestone 3: Configuración (API)
*Objetivo:* backend de la ficha de la empleada, configuración y conceptos de pago adicional.

- [x] **Epic 3.1:** API Empleada y Configuración
  - **Dependencias:** Epic 1.2
  - **Descripción:** Ficha de la empleada (nombre, nacimiento, fechas de contrato) y configuración (salario base, días laborales). Validación Zod en la frontera.
  - **Reglas de negocio clave:** [RN-02, RN-18 (default salario), RN-13 (rol empleador), RN-20 (cumpleaños)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.2 Frontera](../02-architecture/architecture.md#22-capa-de-frontera-api--route-handlers), [§2.3 Aplicación](../02-architecture/architecture.md#23-capa-de-aplicación-servicios-por-feature), [§2.5 Persistencia](../02-architecture/architecture.md#25-capa-de-persistencia-prisma).
  - **Operaciones del contrato (implementa):** `obtenerEmpleada`, `actualizarEmpleada`, `obtenerConfiguracion`, `actualizarConfiguracion`.
  - **Specs estimados:** 2

- [x] **Epic 3.2:** API Items de pago adicional
  - **Dependencias:** Epic 1.2
  - **Descripción:** CRUD de items adicionales (nombre, valor unitario, color, activo).
  - **Reglas de negocio clave:** [RN-08, RN-09 (congelamiento al usarse)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.2–§2.5](../02-architecture/architecture.md#2-componentes-de-alto-nivel).
  - **Operaciones del contrato (implementa):** `listarItemsAdicionales`, `crearItemAdicional`, `actualizarItemAdicional`, `eliminarItemAdicional`.
  - **Specs estimados:** 1

### Milestone 4: Autenticación y Acceso
*Objetivo:* sesión del empleador y acceso de solo lectura de la empleada por enlace, con autorización por rol en la frontera.

- [x] **Epic 4.1:** Autenticación del empleador (Auth.js)
  - **Dependencias:** Epic 1.2
  - **Descripción:** Login/logout/sesión del empleador con Auth.js (email + contraseña).
  - **Reglas de negocio clave:** [RN-13 (solo empleador configura)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.6 Autenticación y Acceso](../02-architecture/architecture.md#26-autenticación-y-acceso-authjs--token-de-empleada).
  - **Operaciones del contrato (implementa):** `iniciarSesionEmpleador`, `cerrarSesionEmpleador`, `obtenerSesion`.
  - **Specs estimados:** 2

- [x] **Epic 4.2:** Acceso de la empleada por enlace
  - **Dependencias:** Epic 4.1, Epic 3.1
  - **Descripción:** Generar/revocar enlace de acceso (token) y validarlo; middleware de autorización por rol (empleada = solo lectura + `marcarTarea`; notas privadas ocultas).
  - **Reglas de negocio clave:** [RN-12 (notas privadas), RN-13 (rol empleada)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.6 Autenticación y Acceso](../02-architecture/architecture.md#26-autenticación-y-acceso-authjs--token-de-empleada), [§5.1](../02-architecture/architecture.md#51-autenticación-y-autorización).
  - **Operaciones del contrato (implementa):** `generarEnlaceAcceso`, `revocarEnlaceAcceso`, `validarAccesoEmpleada`.
  - **Specs estimados:** 2

### Milestone 5: Liquidación (API)
*Objetivo:* backend completo de la liquidación mensual: lectura/desglose/calendario, novedades del borrador y ciclo de vida (cierre/reapertura/eliminación) con congelamiento.

- [x] **Epic 5.1:** API Liquidación — lectura y novedades
  - **Dependencias:** Epic 2.2, Epic 3.1, Epic 3.2
  - **Descripción:** Historial, obtención/inicialización del borrador con desglose y calendario, y edición de novedades (inasistencias, items, montos puntuales, notas) con recálculo en vivo y validación de inasistencias.
  - **Reglas de negocio clave:** [RN-01–RN-08, RN-10, RN-12](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.2 Frontera](../02-architecture/architecture.md#22-capa-de-frontera-api--route-handlers), [§2.3 Aplicación](../02-architecture/architecture.md#23-capa-de-aplicación-servicios-por-feature), [§2.4 Dominio](../02-architecture/architecture.md#24-capa-de-dominio-lógica-pura).
  - **Operaciones del contrato (implementa):** `listarLiquidaciones`, `obtenerLiquidacion`, `actualizarLiquidacion`.
  - **Specs estimados:** 3

- [x] **Epic 5.2:** API Liquidación — ciclo de vida
  - **Dependencias:** Epic 5.1
  - **Descripción:** Cerrar (congelar salario, valores de items y días laborales), reabrir y eliminar liquidaciones.
  - **Reglas de negocio clave:** [RN-09 (congelamiento), RN-11 (borrador→cerrada→reabrible), RN-19 (eliminar con confirmación — UI)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.3 Aplicación](../02-architecture/architecture.md#23-capa-de-aplicación-servicios-por-feature), [§2.5 Persistencia](../02-architecture/architecture.md#25-capa-de-persistencia-prisma).
  - **Operaciones del contrato (implementa):** `cerrarLiquidacion`, `reabrirLiquidacion`, `eliminarLiquidacion`.
  - **Specs estimados:** 2

### Milestone 6: Menú y Tareas (API)
*Objetivo:* backend del menú de cocina (plantilla repetible) y de la rutina de tareas con marcado histórico.

- [x] **Epic 6.1:** API Menú de cocina
  - **Dependencias:** Epic 3.1
  - **Descripción:** Configuración de comidas y periodicidad, y entradas de la plantilla (por semana del ciclo, día y comida).
  - **Reglas de negocio clave:** [RN-14 (plantilla repetible), RN-19 (comidas configurables)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.2–§2.5](../02-architecture/architecture.md#2-componentes-de-alto-nivel).
  - **Operaciones del contrato (implementa):** `obtenerMenu`, `actualizarConfiguracionMenu`, `actualizarMenu`.
  - **Specs estimados:** 2

- [x] **Epic 6.2:** API Tareas diarias
  - **Dependencias:** Epic 3.1, Epic 4.2
  - **Descripción:** Rutina por día de semana (con horarios opcionales), checklist del día, marcado de cumplimiento (permitido a la empleada) e histórico por fecha.
  - **Reglas de negocio clave:** [RN-15 (rutina + histórico), RN-13 (empleada marca tareas)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.2–§2.6](../02-architecture/architecture.md#2-componentes-de-alto-nivel).
  - **Operaciones del contrato (implementa):** `obtenerRutinaTareas`, `actualizarRutinaTareas`, `obtenerTareasDelDia`, `marcarTarea`, `obtenerHistoricoTareas`.
  - **Specs estimados:** 2

### Milestone 7: Frontend Foundation
*Objetivo:* base de la UI: routing, layout, Design System como código y el cliente tipado del contrato. Incluye el **gate de aprobación del Design System** antes de construir cualquier página.

- [x] **Epic 7.1:** Frontend Foundation y Design System
  - **Dependencias:** Epic 1.1
  - **Descripción:** Routing/layout base, Design System como código (tokens + componentes base shadcn), ruta showcase `/dev/design-system` (aprobada por el usuario antes de las páginas), cliente tipado generado desde `api-contract.openapi.yaml`, y shell PWA.
  - **Reglas de negocio clave:** [Restricciones No Funcionales (idioma, moneda, PWA)](../01-requirements/business_requirements.md#restricciones-no-funcionales-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.1 Presentación](../02-architecture/architecture.md#21-capa-de-presentación-ui).
  - **Operaciones del contrato:** genera el cliente tipado de todas; no consume aún.
  - **Specs estimados:** 3

### Milestone 8: Frontend Features
*Objetivo:* las páginas, en orden, cada una después del backend que implementa las operaciones que consume. Precedidas por el gate de aprobación del Design System (Epic 7.1).

- [x] **Epic 8.1:** Login y layout del empleador
  - **Dependencias:** Epic 7.1, Epic 4.1
  - **Descripción:** Pantalla de login y shell autenticado del empleador (navegación: Configuración | Liquidar | Historial | Menú | Tareas).
  - **Reglas de negocio clave:** [RN-13](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `iniciarSesionEmpleador`, `obtenerSesion`, `cerrarSesionEmpleador`.
  - **Specs estimados:** 2

- [x] **Epic 8.2:** Configuración
  - **Dependencias:** Epic 7.1, Epic 3.1, Epic 3.2, Epic 4.2, Epic 8.1
  - **Descripción:** Ficha de la empleada, salario, días laborales, CRUD de items adicionales y generación/revocación del enlace de acceso.
  - **Reglas de negocio clave:** [RN-02, RN-07, RN-18, RN-20](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `obtenerEmpleada`, `actualizarEmpleada`, `obtenerConfiguracion`, `actualizarConfiguracion`, `listarItemsAdicionales`, `crearItemAdicional`, `actualizarItemAdicional`, `eliminarItemAdicional`, `generarEnlaceAcceso`, `revocarEnlaceAcceso`.
  - **Specs estimados:** 3

- [ ] **Epic 8.3:** Liquidar mes (calendario visual)
  - **Dependencias:** Epic 7.1, Epic 5.1, Epic 5.2, Epic 8.2
  - **Descripción:** Selección de mes, calendario coloreado, registro de novedades, desglose destacado del total, y acciones de cerrar/reabrir.
  - **Reglas de negocio clave:** [RN-01–RN-09, RN-11, RN-16](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `obtenerLiquidacion`, `actualizarLiquidacion`, `cerrarLiquidacion`, `reabrirLiquidacion`.
  - **Specs estimados:** 3

- [ ] **Epic 8.4:** Historial de liquidaciones
  - **Dependencias:** Epic 7.1, Epic 5.1, Epic 5.2
  - **Descripción:** Listado de meses liquidados, detalle de cada mes y eliminación con confirmación.
  - **Reglas de negocio clave:** [RN-19 (eliminar con confirmación), RN-09](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `listarLiquidaciones`, `obtenerLiquidacion`, `eliminarLiquidacion`, `reabrirLiquidacion`.
  - **Specs estimados:** 2

- [ ] **Epic 8.5:** Menú de cocina
  - **Dependencias:** Epic 7.1, Epic 6.1, Epic 8.2
  - **Descripción:** Configuración de comidas/periodicidad y edición de la plantilla del menú, con vista de consulta.
  - **Reglas de negocio clave:** [RN-14, RN-19 (comidas)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `obtenerMenu`, `actualizarConfiguracionMenu`, `actualizarMenu`.
  - **Specs estimados:** 2

- [ ] **Epic 8.6:** Tareas del día y rutina
  - **Dependencias:** Epic 7.1, Epic 6.2, Epic 8.2
  - **Descripción:** Editor de rutina por día de semana con horarios, checklist del día e histórico de cumplimiento.
  - **Reglas de negocio clave:** [RN-15](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `obtenerRutinaTareas`, `actualizarRutinaTareas`, `obtenerTareasDelDia`, `marcarTarea`, `obtenerHistoricoTareas`.
  - **Specs estimados:** 2

- [ ] **Epic 8.7:** Vista de consulta de la empleada
  - **Dependencias:** Epic 7.1, Epic 4.2, Epic 8.3, Epic 8.5, Epic 8.6
  - **Descripción:** Vista de solo lectura por enlace: pago/calendario del mes (sin notas), menú del día, checklist con marcado, y recordatorio de cumpleaños.
  - **Reglas de negocio clave:** [RN-12 (sin notas), RN-13 (lectura + marcar), RN-20 (cumpleaños)](../01-requirements/business_requirements.md#reglas-de-negocio)
  - **Operaciones del contrato (consume):** `validarAccesoEmpleada`, `obtenerEmpleada`, `obtenerLiquidacion`, `obtenerMenu`, `obtenerTareasDelDia`, `marcarTarea`.
  - **Specs estimados:** 3

### Milestone 9: Operación
*Objetivo:* pulido de consulta offline (PWA) y despliegue.

- [ ] **Epic 9.1:** Consulta offline (PWA) y despliegue
  - **Dependencias:** Epic 8.7
  - **Descripción:** Caché offline de menú y tareas para la empleada (Restricción No Funcional) y configuración de despliegue en VPS con Docker/Dokploy: instancia única, volumen persistente para el archivo SQLite (modo WAL) y backup periódico por copia del `.db`.
  - **Reglas de negocio clave:** [Consulta sin conexión (deseable)](../01-requirements/business_requirements.md#restricciones-no-funcionales-de-negocio)
  - **Componentes de arquitectura involucrados:** [§2.1 Presentación](../02-architecture/architecture.md#21-capa-de-presentación-ui), DevOps.
  - **Operaciones del contrato:** ninguna nueva.
  - **Specs estimados:** 2

---

## Reglas para Modificar este Archivo

1. **Solo el orquestador (`skills/build/SKILL.md`)** modifica los checkboxes durante construcción.
2. **Solo `skills/new-feature/SKILL.md`** agrega nuevos Milestones/Epics después de la planificación inicial.
3. **NUNCA borres un epic ya completado.** Si una funcionalidad cambia, márcala con un nuevo epic que la sustituya y deja el anterior como `[x]` con nota de superseded.
4. **Cuando agregues un epic nuevo**, declara explícitamente sus dependencias contra los epics existentes.
