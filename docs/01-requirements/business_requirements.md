# Requerimientos de Negocio — MiEmpleadApp

> Fase 1 (Discovery) de Specture. Este documento captura el problema de negocio, sin tecnología. Es la fuente de verdad para la Fase 2 (Arquitectura).
> Fecha: 2026-06-02

## Propósito

MiEmpleadApp resuelve el control mensual del pago de una **empleada doméstica informal en Colombia**, junto con la organización de su trabajo diario. El **empleador** configura las reglas (salario, días laborales, conceptos de pago adicional), registra las novedades del mes (inasistencias, noches de acompañamiento, montos puntuales, notas) y obtiene el **total a pagar** calculado automáticamente. La **empleada** consulta su información (pago, calendario, menú de cocina y tareas del día) y puede marcar sus tareas como completadas.

El objetivo es reemplazar el cálculo manual propenso a errores (días proporcionales, festivos que no se descuentan, meses parciales) y dar transparencia compartida entre empleador y empleada sobre el pago y las labores.

## Actores

| Actor | Tipo | Descripción | Consumidor externo |
|-------|------|-------------|--------------------|
| **Empleador** | Humano | Dueño de la cuenta. Configura todo, registra novedades, liquida meses, define menú y tareas. Único con permisos de escritura. | No |
| **Empleada** | Humano | Accede mediante un **código/enlace** compartido por el empleador (sin registro propio). Es de **solo lectura**, con dos excepciones: puede **marcar tareas como hechas** y **ver las novedades del mes** (inasistencias, noches, items). **No** puede ver las **notas** del mes (privadas del empleador). | No |
| **Servicio de festivos (Ley Emiliani)** | Dependencia interna | Fuente de los días festivos colombianos para el cálculo. No es un consumidor del sistema; es un insumo de datos. | No |

> Una sola empleada por empleador. La app no expone ninguna interfaz a sistemas de terceros.

## Historias de Usuario

Cada historia indica su **Exposición**: `UI` (la consume un usuario por la interfaz), `API-externa` (consumidor no-humano externo) o `Interna`. En este proyecto **todas son `UI`** (no hay consumidores externos).

### Acceso y roles
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-01 | Iniciar sesión como empleador | Empleador | UI |
| HU-02 | Generar/compartir un código de acceso para la empleada y poder revocarlo | Empleador | UI |
| HU-03 | Acceder como empleada mediante el código (solo lectura) | Empleada | UI |

### Configuración
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-04 | Registrar/editar datos de la empleada: nombre, fecha de nacimiento, fecha de inicio de contrato y fecha de fin (opcional) | Empleador | UI |
| HU-05 | Configurar el salario mensual base (default $700.000 COP) | Empleador | UI |
| HU-06 | Configurar qué días de la semana son laborales | Empleador | UI |
| HU-07 | Crear/editar/eliminar items de pago adicional con valor unitario (ej. "Noche acompañamiento $20.000", "Hora extra diurna $5.000") | Empleador | UI |

### Liquidación mensual
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-08 | Seleccionar el mes/año a liquidar | Empleador | UI |
| HU-09 | Registrar inasistencias seleccionando fechas del calendario del mes | Empleador | UI |
| HU-10 | Registrar cantidades de items adicionales (cantidad × valor) y montos puntuales sueltos (ej. "Bono $50.000") | Empleador | UI |
| HU-11 | Registrar notas opcionales del mes (privadas del empleador) | Empleador | UI |
| HU-12 | Ir alimentando las novedades a lo largo del mes (borrador editable) | Empleador | UI |
| HU-13 | Aplicar/cerrar la liquidación del mes (bloquea edición) | Empleador | UI |
| HU-14 | Reabrir una liquidación cerrada para corregir y volver a cerrarla | Empleador | UI |

### Cálculo y visualización
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-15 | Ver el cálculo automático: total días L–S del mes, festivos en día laboral (no descontados), días efectivamente trabajados, subtotal por días, subtotal por items adicionales, total a pagar | Empleador y Empleada | UI |
| HU-16 | Ver un calendario visual del mes con colores: trabajados, inasistencias, festivos, días no laborales, items adicionales, días fuera de contrato | Empleador y Empleada | UI |

### Historial
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-17 | Ver el historial de todos los meses liquidados | Empleador y Empleada | UI |
| HU-18 | Ver el detalle de un mes del historial | Empleador y Empleada | UI |
| HU-19 | Eliminar una liquidación del historial con confirmación | Empleador | UI |

### Menú de cocina
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-20 | Configurar las comidas a incluir en el menú (ej. desayuno, almuerzo, cena/onces) | Empleador | UI |
| HU-21 | Definir el menú por comidas para cada día según una periodicidad (semanal, quincenal o mensual) como plantilla que se repite | Empleador | UI |
| HU-22 | Consultar el menú que se debe preparar cada día | Empleador y Empleada | UI |

### Tareas / labores diarias
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-23 | Definir una rutina de tareas por día de la semana (checklist) con horarios opcionales (ej. "Lunes 8:00–9:30 preparar desayuno") que se repite cada semana | Empleador | UI |
| HU-24 | Consultar el checklist de tareas del día | Empleador y Empleada | UI |
| HU-25 | Marcar tareas como completadas | Empleada | UI |
| HU-26 | Ver el histórico de cumplimiento de tareas por fecha | Empleador | UI |

### Otros
| ID | Historia | Actor | Exposición |
|----|----------|-------|-----------|
| HU-27 | Destacar/recordar el cumpleaños de la empleada (a partir de su fecha de nacimiento) | Empleador y Empleada | UI |

## Capacidades de Frontera

Todas las capacidades de este sistema son de tipo **`UI`** y son consumidas por el **empleador** (escritura + lectura) o la **empleada** (lectura + marcar tareas). **No existe ninguna capacidad `API-externa`**: el sistema no se integra con ni es consumido por terceros.

Consolidado (input directo de la Fase 2 para el contrato de API; cada item debe convertirse en ≥1 operación):

- **Autenticación del empleador** (HU-01) — consumidor: empleador.
- **Gestión del código de acceso de la empleada** (HU-02) — empleador.
- **Acceso de solo lectura por código** (HU-03) — empleada.
- **Configuración de la empleada** (HU-04) — empleador.
- **Configuración de salario base** (HU-05) — empleador.
- **Configuración de días laborales** (HU-06) — empleador.
- **Gestión de items de pago adicional** (HU-07) — empleador.
- **Gestión de la liquidación mensual** (HU-08 a HU-14): selección de mes, inasistencias, items/montos puntuales, notas, borrador, cierre, reapertura — empleador.
- **Lectura del cálculo y calendario del mes** (HU-15, HU-16) — empleador y empleada.
- **Historial de liquidaciones** (HU-17, HU-18) y **eliminación** (HU-19) — lectura para ambos; eliminación solo empleador.
- **Configuración y consulta del menú** (HU-20, HU-21 escritura empleador; HU-22 lectura ambos).
- **Configuración y consulta de tareas** (HU-23, HU-26 empleador; HU-24 lectura ambos; HU-25 marcado empleada).
- **Cumpleaños de la empleada** (HU-27) — lectura ambos.

## Reglas de Negocio

- **RN-01 — Valor del día:** `valor por día = salario mensual base ÷ total de días laborales del mes completo`. El denominador es el número de días laborales (según RN-02) del mes calendario completo, **incluyendo** los festivos que caigan en día laboral.
- **RN-02 — Días laborales:** son los días de la semana que el empleador configuró como laborales (RN configurable, ej. lunes a sábado). Los días no laborales (ej. domingos) no cuentan ni se pagan.
- **RN-03 — Festivos:** los festivos colombianos (calculados con la **Ley Emiliani**) que caen en un día laboral se cuentan como **días pagados** (ya incluidos en el salario mensual) y **NO se descuentan**. Un festivo que cae en día no laboral es irrelevante para el cálculo.
- **RN-04 — Inasistencias:** cada inasistencia descuenta **un valor-día completo** (no hay medio día). `subtotal días = (días laborales del periodo de contrato en el mes − inasistencias) × valor por día`.
- **RN-05 — Validez de la inasistencia:** una inasistencia solo puede registrarse en un día que sea **laboral, no festivo y dentro del periodo de contrato**. No se permite registrar inasistencias en festivos, días no laborales ni fuera de contrato.
- **RN-06 — Mes de inicio (parcial):** en el mes en que inicia el contrato, solo se pagan los días laborales **desde la fecha de inicio** en adelante; los días previos no se pagan (se muestran en gris claro). El **denominador sigue siendo el mes completo** (cálculo proporcional, RN-01).
- **RN-07 — Mes de fin (parcial):** si se fija fecha de fin de contrato, solo se pagan los días laborales **hasta la fecha de fin**; los días posteriores no se pagan (gris claro). El denominador sigue siendo el mes completo.
- **RN-08 — Total a pagar:** `total = subtotal días trabajados + Σ(cantidad × valor unitario de cada item adicional) + Σ(montos puntuales)`.
- **RN-09 — Congelamiento del histórico:** al **cerrar** una liquidación, quedan **congelados** todos los valores usados en ese mes (salario base, valores unitarios de items, configuración de días laborales). Cambios posteriores en la configuración **no alteran** meses ya cerrados; solo afectan meses futuros. Una liquidación en **borrador** (no cerrada) se calcula en vivo con la configuración actual.
- **RN-10 — Unicidad:** existe **una sola liquidación por combinación mes + año**. Si ya existe, se edita la existente; no se duplica.
- **RN-11 — Ciclo de la liquidación:** una liquidación está en **borrador** (editable, se alimenta durante el mes) o **cerrada/aplicada** (bloqueada para edición). El empleador puede **reabrir** una cerrada para corregir y volver a cerrarla.
- **RN-12 — Privacidad de notas:** las notas del mes son **privadas del empleador**; la empleada nunca las ve.
- **RN-13 — Permisos por rol:** solo el **empleador** puede configurar, registrar novedades, liquidar, definir menú y tareas. La **empleada** es de **solo lectura**, excepto **marcar tareas como completadas**.
- **RN-14 — Plantilla de menú:** el menú se define como una **plantilla que se repite** según la periodicidad elegida: semanal (1 semana que se repite), quincenal (2 semanas que alternan) o mensual (4 semanas que rotan). El menú se organiza **por comidas del día** (comidas configurables, RN-20).
- **RN-15 — Rutina de tareas:** las tareas se definen como una **rutina por día de la semana** que se repite cada semana, con **horarios opcionales** por tarea. El marcado de "completada" se guarda como **histórico por fecha** y es visible para el empleador.
- **RN-16 — Moneda:** todos los montos se manejan y muestran en **pesos colombianos (COP) sin decimales**.
- **RN-17 — Zona horaria:** el conteo de días, fechas de contrato y festivos se calculan en la zona horaria de **Colombia (America/Bogotá)**.
- **RN-18 — Default de salario:** el salario base por defecto es **$700.000 COP**, configurable por el empleador.
- **RN-19 — Comidas del menú:** las comidas que componen el menú diario (ej. desayuno, almuerzo, cena/onces) son **configurables** por el empleador.
- **RN-20 — Cumpleaños:** a partir de la fecha de nacimiento de la empleada, la app destaca/recuerda su cumpleaños.

## Casos Límite

- **Inasistencia inválida:** intentar registrar una inasistencia en festivo, día no laboral o fuera de contrato → la app lo impide (RN-05).
- **Mes con todas las inasistencias:** si la empleada faltó todos los días laborales, el subtotal por días es 0; el total puede ser solo items adicionales (o 0).
- **Mes fuera del contrato:** un mes anterior al inicio o posterior al fin de contrato no es liquidable (no hay días pagables).
- **Inicio y fin en el mismo mes:** contrato muy corto → se pagan solo los días laborales entre inicio y fin, proporcional al mes completo.
- **Cambio de configuración tras cerrar meses:** cambiar salario, valor de un item o días laborales no recalcula meses ya cerrados (RN-09); sí afecta borradores y meses futuros.
- **Re-liquidar un mes existente:** se edita la liquidación existente, nunca se crea una segunda para el mismo mes/año (RN-10).
- **Festivo en día no laboral:** no afecta el cálculo (RN-03).
- **Eliminar una liquidación:** requiere confirmación explícita (HU-19); si estaba cerrada, igualmente se puede eliminar.
- **Código de acceso revocado/ inválido:** la empleada pierde el acceso de consulta.
- **Reapertura y nuevo cierre:** al reabrir una liquidación, vuelve a borrador y puede recalcularse; al cerrarla de nuevo se vuelven a congelar los valores vigentes.
- **Día festivo registrado como item adicional:** los items adicionales (ej. noche de acompañamiento) son independientes del calendario de días laborales y se suman aunque ocurran en festivo o domingo.

## Restricciones No Funcionales (de Negocio)

- **Idioma:** español (Colombia) en toda la interfaz.
- **Moneda:** COP sin decimales, formato `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.
- **Zona horaria:** America/Bogotá para todos los cálculos de fechas.
- **Festivos:** según la legislación colombiana vigente y la Ley Emiliani.
- **Consulta sin conexión (deseable):** la empleada debería poder consultar la última información vista de menú y tareas **aunque no tenga conexión** en el momento.
- **Privacidad:** las notas del mes son privadas del empleador; la app gestiona una sola empleada por empleador.
- **Acceso de la empleada sin fricción:** mediante código/enlace, sin obligar a un registro formal.

## Fuera de Alcance

- **Prestaciones sociales de ley:** cesantías, prima, vacaciones, intereses — NO se calculan.
- **Seguridad social:** aportes a salud, pensión y ARL — NO se calculan ni gestionan.
- **Movimiento de dinero:** la app NO realiza pagos ni transferencias ni se integra con bancos; solo calcula y muestra el total a pagar.
- **Reportes legales / tributarios:** no genera declaraciones ni reportes de impuestos.
- **Gestión de múltiples empleadas por empleador:** una sola empleada por cuenta (puede revisarse a futuro).
- **Integraciones con terceros / API pública:** el sistema no expone ni consume APIs externas.

## Glosario

- **Empleador:** persona que contrata y configura la app; único con permisos de escritura.
- **Empleada:** persona contratada; consulta la app por código y marca tareas.
- **Día laboral:** día de la semana configurado como trabajable (ej. lunes a sábado).
- **Valor-día:** salario mensual ÷ total de días laborales del mes completo.
- **Inasistencia:** día laboral no trabajado, que descuenta un valor-día.
- **Festivo (Ley Emiliani):** día feriado colombiano; si cae en día laboral, se paga y no se descuenta. La Ley Emiliani traslada ciertos festivos al lunes siguiente.
- **Liquidación:** cálculo del pago de un mes específico, con sus novedades.
- **Mes parcial:** mes de inicio o de fin de contrato, donde solo parte de los días laborales se pagan.
- **Item de pago adicional:** concepto con valor unitario (ej. noche de acompañamiento) que se cobra por cantidad.
- **Monto puntual:** pago suelto de una sola vez sin valor unitario (ej. bono).
- **Novedades del mes:** inasistencias, cantidades de items, montos puntuales y notas que alimentan la liquidación.
- **Borrador / Cerrada:** estados de una liquidación (editable / bloqueada y congelada).
- **Plantilla de menú:** definición repetible del menú por comidas según periodicidad.
- **Rutina de tareas:** checklist de labores por día de la semana, con horarios opcionales.
- **Código de acceso:** credencial simple que el empleador comparte para que la empleada consulte en modo lectura.
