# Contrato de API: MiEmpleadApp

> **Fuente de verdad machine-readable:** `docs/02-architecture/api-contract.openapi.yaml`.
> Este documento es la versión legible del mismo contrato. **Si discrepan, gana el `.openapi.yaml`.**
>
> Única fuente de verdad de la interfaz backend↔frontend. Los specs de backend *implementan* operaciones; el mapa de navegación y los specs de frontend *consumen* operaciones, siempre por `operationId`. Nadie reinventa URLs, métodos ni shapes fuera de aquí.

## 1. Convenciones globales

- **Base URL:** `/api/v1`.
- **Versionado:** prefijo de path `/v1`.
- **Autenticación:** dos esquemas. `sesionEmpleador` (cookie de sesión de Auth.js, rol empleador, lectura+escritura) y `accesoEmpleada` (header `X-Acceso-Token`, rol empleada, **solo lectura** + `marcarTarea`). Las operaciones de lectura aceptan cualquiera de los dos; las de escritura requieren `sesionEmpleador` (excepto `marcarTarea`).
- **Formato de fecha:** ISO-8601 `date` (`YYYY-MM-DD`); cálculos en zona **America/Bogotá**.
- **Moneda:** todos los montos son **enteros en COP** (sin decimales).
- **Envelope de error estándar:** `{ code: string, message: string, details?: object }` (único para todo el contrato). `code` es un código de negocio estable (ej. `LIQUIDACION_CERRADA`, `INASISTENCIA_INVALIDA`, `MES_FUERA_DE_CONTRATO`, `MES_DUPLICADO`, `ACCESO_INVALIDO`, `NO_AUTORIZADO`).
- **Códigos de estado usados:** 200, 201, 204, 401, 403, 404, 409, 422, 500.
- **Privacidad:** el campo `notas` de una liquidación **nunca** se incluye en respuestas al rol empleada (RN-12).

## 2. Esquemas compartidos (DTOs)

> Corresponden a `components/schemas/<Nombre>` en el OpenAPI. Identificadores en inglés/español según `conventions.md` §8 (dominio en español).

### Enums
- `DiaSemana`: `LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO`
- `EstadoLiquidacion`: `BORRADOR | CERRADA`
- `Periodicidad`: `SEMANAL | QUINCENAL | MENSUAL`
- `TipoDiaCalendario`: `TRABAJADO | INASISTENCIA | FESTIVO | NO_LABORAL | FUERA_CONTRATO`

### `Empleada`
| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `nombre` | string | sí | |
| `fechaNacimiento` | date | sí | Base del recordatorio de cumpleaños. |
| `fechaInicioContrato` | date | sí | |
| `fechaFinContrato` | date | no | `null` si el contrato sigue vigente. |

### `Configuracion`
| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `salarioBase` | integer | sí | COP entero. Default 700000. |
| `diasLaborales` | `DiaSemana[]` | sí | Días de la semana laborales. |

### `EnlaceAcceso`
| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `token` | string | sí | |
| `url` | string | sí | Enlace para compartir. |
| `activo` | boolean | sí | |

### `ItemAdicional` / `ItemAdicionalInput`
| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `id` | string | sí (solo salida) | |
| `nombre` | string | sí | |
| `valorUnitario` | integer | sí | COP entero. |
| `color` | string | no | Para el calendario. |
| `activo` | boolean | sí (salida) / no (input, default true) | |

### `Desglose`
| Campo | Tipo | Notas |
|-------|------|-------|
| `diasLaboralesMes` | integer | Denominador: días laborales del mes completo. |
| `festivosEnDiaLaboral` | integer | Festivos en día laboral, pagados, no descontados. |
| `diasTrabajados` | integer | Dentro de contrato, menos inasistencias. |
| `valorDia` | integer | `salarioBase ÷ diasLaboralesMes`. |
| `subtotalDias` | integer | `diasTrabajados × valorDia`. |
| `subtotalItems` | integer | Σ(cantidad × valor unitario). |
| `subtotalMontosPuntuales` | integer | Σ montos puntuales. |
| `total` | integer | Total a pagar. |

### `DiaCalendario`
| Campo | Tipo | Notas |
|-------|------|-------|
| `fecha` | date | |
| `tipo` | `TipoDiaCalendario` | Color del calendario. |
| `itemsAdicionales` | string[] | Ids de items asociados al día (opcional). |

### `LiquidacionItem`
| Campo | Tipo | Notas |
|-------|------|-------|
| `itemId` | string | |
| `nombre` | string | Snapshot. |
| `valorUnitario` | integer | Congelado en la liquidación (RN-09). |
| `cantidad` | integer | |
| `subtotal` | integer | |

### `MontoPuntual`
| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `id` | string | no | |
| `descripcion` | string | sí | |
| `monto` | integer | sí | COP entero. |

### `Liquidacion`
| Campo | Tipo | Notas |
|-------|------|-------|
| `anio` / `mes` | integer | Clave del mes. |
| `estado` | `EstadoLiquidacion` | |
| `desglose` | `Desglose` | |
| `calendario` | `DiaCalendario[]` | |
| `inasistencias` | date[] | |
| `items` | `LiquidacionItem[]` | |
| `montosPuntuales` | `MontoPuntual[]` | |
| `notas` | string? | Privada del empleador; omitida para empleada (RN-12). |

### `ActualizarLiquidacionInput`
`{ inasistencias?: date[], items?: {itemId, cantidad}[], montosPuntuales?: {descripcion, monto}[], notas?: string }` — falla con 409 si la liquidación está `CERRADA` o si alguna inasistencia es inválida.

### `MenuConfig` / `MenuEntrada` / `Menu`
- `MenuConfig`: `{ comidas: string[], periodicidad: Periodicidad }`.
- `MenuEntrada`: `{ semana: int(0-based), diaSemana: DiaSemana, comida: string, descripcion: string }`.
- `Menu`: `{ configuracion: MenuConfig, entradas: MenuEntrada[] }`.

### `RutinaTarea` / `RutinaTareaInput` / `TareaDelDia` / `MarcarTareaInput` / `CumplimientoTarea`
- `RutinaTarea`: `{ id, diaSemana, descripcion, horaInicio?, horaFin?, orden }`.
- `TareaDelDia`: `{ rutinaTareaId, descripcion, horaInicio?, horaFin?, hecha }`.
- `MarcarTareaInput`: `{ fecha, rutinaTareaId, hecha }`.
- `CumplimientoTarea`: `{ fecha, rutinaTareaId, descripcion, hecha }`.

## 3. Operaciones

| operationId | Método | Path | Auth / Rol | Request | Éxito | Error | Idempotente |
|-------------|--------|------|------------|---------|-------|-------|-------------|
| `iniciarSesionEmpleador` | POST | `/auth/login` | Público | `{email,password}` | `204` | `401` | no |
| `cerrarSesionEmpleador` | POST | `/auth/logout` | Empleador | — | `204` | `401` | sí |
| `obtenerSesion` | GET | `/auth/sesion` | Empleador | — | `200` sesión | `401` | sí |
| `generarEnlaceAcceso` | POST | `/acceso/enlace` | Empleador | — | `200` `EnlaceAcceso` | `401` | no |
| `revocarEnlaceAcceso` | DELETE | `/acceso/enlace` | Empleador | — | `204` | `401` | sí |
| `validarAccesoEmpleada` | GET | `/acceso/validar` | Empleada (token) | — | `200` `ContextoEmpleada` | `401` | sí |
| `obtenerEmpleada` | GET | `/empleada` | Empleador o Empleada | — | `200` `Empleada` | `401·404` | sí |
| `actualizarEmpleada` | PUT | `/empleada` | Empleador | `Empleada` | `200` `Empleada` | `401·422` | sí |
| `obtenerConfiguracion` | GET | `/configuracion` | Empleador o Empleada | — | `200` `Configuracion` | `401` | sí |
| `actualizarConfiguracion` | PUT | `/configuracion` | Empleador | `Configuracion` | `200` `Configuracion` | `401·422` | sí |
| `listarItemsAdicionales` | GET | `/items-adicionales` | Empleador o Empleada | — | `200` `ItemAdicional[]` | `401` | sí |
| `crearItemAdicional` | POST | `/items-adicionales` | Empleador | `ItemAdicionalInput` | `201` `ItemAdicional` | `401·422` | no |
| `actualizarItemAdicional` | PUT | `/items-adicionales/{id}` | Empleador | `ItemAdicionalInput` | `200` `ItemAdicional` | `401·404·422` | sí |
| `eliminarItemAdicional` | DELETE | `/items-adicionales/{id}` | Empleador | — | `204` | `401·404` | sí |
| `listarLiquidaciones` | GET | `/liquidaciones` | Empleador o Empleada | — | `200` `LiquidacionResumen[]` | `401` | sí |
| `obtenerLiquidacion` | GET | `/liquidaciones/{anio}/{mes}` | Empleador o Empleada | — | `200` `Liquidacion` | `401·409` | sí |
| `actualizarLiquidacion` | PUT | `/liquidaciones/{anio}/{mes}` | Empleador | `ActualizarLiquidacionInput` | `200` `Liquidacion` | `401·409·422` | sí |
| `cerrarLiquidacion` | POST | `/liquidaciones/{anio}/{mes}/cierre` | Empleador | — | `200` `Liquidacion` | `401·409` | no |
| `reabrirLiquidacion` | POST | `/liquidaciones/{anio}/{mes}/reapertura` | Empleador | — | `200` `Liquidacion` | `401·409` | no |
| `eliminarLiquidacion` | DELETE | `/liquidaciones/{anio}/{mes}` | Empleador | — | `204` | `401·404` | sí |
| `obtenerMenu` | GET | `/menu` | Empleador o Empleada | — | `200` `Menu` | `401` | sí |
| `actualizarConfiguracionMenu` | PUT | `/menu/configuracion` | Empleador | `MenuConfig` | `200` `MenuConfig` | `401·422` | sí |
| `actualizarMenu` | PUT | `/menu/entradas` | Empleador | `MenuEntrada[]` | `200` `MenuEntrada[]` | `401·422` | sí |
| `obtenerRutinaTareas` | GET | `/tareas/rutina` | Empleador o Empleada | — | `200` `RutinaTarea[]` | `401` | sí |
| `actualizarRutinaTareas` | PUT | `/tareas/rutina` | Empleador | `RutinaTareaInput[]` | `200` `RutinaTarea[]` | `401·422` | sí |
| `obtenerTareasDelDia` | GET | `/tareas/dia?fecha=` | Empleador o Empleada | query `fecha` | `200` `TareaDelDia[]` | `401` | sí |
| `marcarTarea` | PUT | `/tareas/cumplimiento` | Empleador o Empleada | `MarcarTareaInput` | `200` `CumplimientoTarea` | `401·422` | sí |
| `obtenerHistoricoTareas` | GET | `/tareas/historico?desde=&hasta=` | Empleador | query `desde`,`hasta` | `200` `CumplimientoTarea[]` | `401` | sí |

### Detalle por operación (solo las que necesitan más que la fila)

#### `obtenerLiquidacion`
- **Propósito:** seleccionar un mes/año y obtener (o inicializar como borrador) su liquidación con el desglose y el calendario coloreado.
- **Errores de negocio:** `409 MES_FUERA_DE_CONTRATO` si el mes es completamente anterior al inicio o posterior al fin de contrato.
- **Notas de consumo frontend:** para el rol empleada, `notas` se omite.

#### `actualizarLiquidacion`
- **Propósito:** ir alimentando las novedades del borrador (inasistencias, cantidades de items, montos puntuales, notas) y recalcular en vivo.
- **Errores de negocio:** `409 LIQUIDACION_CERRADA` si está cerrada; `409 INASISTENCIA_INVALIDA` si una fecha es festivo, día no laboral o fuera de contrato (RN-05).
- **Efectos secundarios:** persiste novedades; recalcula el total. Mientras es borrador, usa la configuración vigente.

#### `cerrarLiquidacion`
- **Propósito:** aplicar el mes y **congelar** salario base, valores de items y días laborales (RN-09).
- **Errores de negocio:** `409` si ya está cerrada.

#### `marcarTarea`
- **Propósito:** la empleada (o el empleador) marca una tarea como hecha/pendiente en una fecha; se guarda histórico (RN-15).
- **Notas:** única operación de escritura permitida al rol empleada.

## 4. Trazabilidad

> Cada operación traza **hacia arriba** a la capacidad de frontera (`HU-...`) y **hacia abajo** a quién la implementa (epic backend) y la consume (pantalla). Cobertura bidireccional: toda capacidad `UI`/`API-externa` tiene ≥1 operación; toda operación traza a una capacidad. El epic backend se concreta en el ROADMAP (Fase 2, Parte C); las pantallas se concretan en el `navigation_map` (Fase 3).

| operationId | Capacidad / HU origen | Exposición | Implementa (epic back) | Consume (pantalla) | Estado |
|-------------|----------------------|------------|------------------------|--------------------|--------|
| `iniciarSesionEmpleador` | HU-01 | UI | Epic 4.1 | `/login` | ☐ |
| `cerrarSesionEmpleador` | HU-01 | UI | Epic 4.1 | layout empleador | ☐ |
| `obtenerSesion` | HU-01 | UI | Epic 4.1 | layout empleador | ☐ |
| `generarEnlaceAcceso` | HU-02 | UI | Epic 4.2 | `/configuracion` | ☐ |
| `revocarEnlaceAcceso` | HU-02 | UI | Epic 4.2 | `/configuracion` | ☐ |
| `validarAccesoEmpleada` | HU-03 | UI | Epic 4.2 | `/consulta/[token]` | ☐ |
| `obtenerEmpleada` | HU-04, HU-27 | UI | Epic 3.1 | `/configuracion`, consulta | ☐ |
| `actualizarEmpleada` | HU-04 | UI | Epic 3.1 | `/configuracion` | ☐ |
| `obtenerConfiguracion` | HU-05, HU-06 | UI | Epic 3.1 | `/configuracion`, liquidación | ☐ |
| `actualizarConfiguracion` | HU-05, HU-06 | UI | Epic 3.1 | `/configuracion` | ☐ |
| `listarItemsAdicionales` | HU-07 | UI | Epic 3.2 | `/configuracion`, liquidación | ☐ |
| `crearItemAdicional` | HU-07 | UI | Epic 3.2 | `/configuracion` | ☐ |
| `actualizarItemAdicional` | HU-07 | UI | Epic 3.2 | `/configuracion` | ☐ |
| `eliminarItemAdicional` | HU-07 | UI | Epic 3.2 | `/configuracion` | ☐ |
| `listarLiquidaciones` | HU-17 | UI | Epic 5.1 | `/historial` | ☐ |
| `obtenerLiquidacion` | HU-08, HU-15, HU-16, HU-18 | UI | Epic 5.1 | `/liquidar`, `/historial/[mes]` | ☐ |
| `actualizarLiquidacion` | HU-09, HU-10, HU-11, HU-12 | UI | Epic 5.1 | `/liquidar` | ☐ |
| `cerrarLiquidacion` | HU-13 | UI | Epic 5.2 | `/liquidar` | ☐ |
| `reabrirLiquidacion` | HU-14 | UI | Epic 5.2 | `/liquidar`, `/historial/[mes]` | ☐ |
| `eliminarLiquidacion` | HU-19 | UI | Epic 5.2 | `/historial` | ☐ |
| `obtenerMenu` | HU-22 | UI | Epic 6.1 | `/menu`, consulta | ☐ |
| `actualizarConfiguracionMenu` | HU-20 | UI | Epic 6.1 | `/menu` | ☐ |
| `actualizarMenu` | HU-21 | UI | Epic 6.1 | `/menu` | ☐ |
| `obtenerRutinaTareas` | HU-23 | UI | Epic 6.2 | `/tareas`, consulta | ☐ |
| `actualizarRutinaTareas` | HU-23 | UI | Epic 6.2 | `/tareas` | ☐ |
| `obtenerTareasDelDia` | HU-24 | UI | Epic 6.2 | `/tareas/dia`, consulta | ☐ |
| `marcarTarea` | HU-25 | UI | Epic 6.2 | `/tareas/dia` (empleada) | ☐ |
| `obtenerHistoricoTareas` | HU-26 | UI | Epic 6.2 | `/tareas/historico` | ☐ |

> No hay capacidades `API-externa`: el sistema no expone interfaz a terceros. Todas las operaciones trazan a una capacidad `UI` y ninguna capacidad de frontera queda sin operación.

## 5. Reglas de evolución del contrato

- **Aditivo es seguro:** agregar una operación nueva o un campo opcional no rompe consumidores.
- **Breaking changes requieren ADR:** renombrar/eliminar un `operationId`, cambiar método/path, quitar un campo o cambiar su tipo. Registrar en `.specture/decisions/` y notificar a los epics afectados (back y front).
- **El cliente tipado del frontend se regenera desde el `.openapi.yaml`** tras cualquier cambio — nunca se editan URLs a mano.

---

*Mantener sincronizado con `api-contract.openapi.yaml`. Prosa de negocio en español; identificadores de operación según `conventions.md` §8.*
