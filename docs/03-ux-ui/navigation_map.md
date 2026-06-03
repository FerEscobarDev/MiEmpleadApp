# Mapa de Navegación: MiEmpleadApp

> Cada pantalla con su path, autenticación, propósito, elementos clave, historias que cubre y **operaciones del contrato** que consume (`operationId` de `docs/02-architecture/api-contract.md` — sin inventar URLs ni shapes). PWA **mobile-first**.

## Dos experiencias por rol

- **Empleador** — sesión autenticada (Auth.js). App completa con navegación: **Inicio · Configuración · Liquidar · Historial · Menú · Tareas**.
- **Empleada** — acceso por **enlace** (token), **solo lectura** + marcar tareas. Vista de consulta con pestañas: **Pago · Menú · Tareas**.

---

## Zona Empleador

### `/login` — Iniciar sesión
- **Auth requerida:** No.
- **Propósito:** que el empleador inicie sesión.
- **Elementos clave:** logo, campo email, campo contraseña, botón "Entrar", mensajes de error.
- **Historias de usuario:** HU-01.
- **Operaciones que consume:** `iniciarSesionEmpleador`, `obtenerSesion`.

### `/` — Inicio (Dashboard del empleador)
- **Auth requerida:** Sí (empleador).
- **Propósito:** vista de arranque con el estado del mes en curso y accesos rápidos.
- **Elementos clave:** saludo, tarjeta del mes actual (estado borrador/cerrada + total provisional), accesos a Liquidar/Menú/Tareas, **banner de cumpleaños** de la empleada cuando aplique.
- **Historias de usuario:** HU-15 (resumen), HU-27 (cumpleaños).
- **Operaciones que consume:** `obtenerSesion`, `obtenerEmpleada`, `obtenerLiquidacion`.

### `/configuracion` — Configuración
- **Auth requerida:** Sí (empleador).
- **Propósito:** definir todos los parámetros: ficha de la empleada, salario, días laborales, items de pago adicional y el enlace de acceso.
- **Elementos clave:** formulario de ficha (nombre, fecha de nacimiento, inicio y fin de contrato); campo de salario (moneda COP); selector de días laborales (toggles L–D); lista editable de items adicionales (nombre, valor, color); tarjeta del **enlace de acceso** con botones copiar/regenerar/revocar.
- **Historias de usuario:** HU-02, HU-04, HU-05, HU-06, HU-07.
- **Operaciones que consume:** `obtenerEmpleada`, `actualizarEmpleada`, `obtenerConfiguracion`, `actualizarConfiguracion`, `listarItemsAdicionales`, `crearItemAdicional`, `actualizarItemAdicional`, `eliminarItemAdicional`, `generarEnlaceAcceso`, `revocarEnlaceAcceso`.

### `/liquidar` — Liquidar mes
- **Auth requerida:** Sí (empleador).
- **Propósito:** seleccionar un mes, registrar novedades sobre el calendario y obtener el total a pagar; cerrar o reabrir la liquidación.
- **Elementos clave:** selector de mes/año; **calendario visual coloreado** (trabajado, inasistencia, festivo, no laboral, fuera de contrato, item adicional) con leyenda; panel de novedades (cantidades de items, montos puntuales, notas privadas); **panel de desglose** destacado (días L–S, festivos en día laboral, días trabajados, subtotales, total); botones "Cerrar liquidación" y "Reabrir" (con confirmación); badge de estado borrador/cerrada (bloquea edición).
- **Historias de usuario:** HU-08, HU-09, HU-10, HU-11, HU-12, HU-13, HU-14, HU-15, HU-16.
- **Operaciones que consume:** `obtenerLiquidacion`, `actualizarLiquidacion`, `listarItemsAdicionales`, `cerrarLiquidacion`, `reabrirLiquidacion`.

### `/historial` — Historial
- **Auth requerida:** Sí (empleador).
- **Propósito:** ver todos los meses liquidados.
- **Elementos clave:** lista/tabla de meses (mes-año, estado, total) ordenada por fecha, con enlace al detalle; estado vacío cuando no hay meses.
- **Historias de usuario:** HU-17.
- **Operaciones que consume:** `listarLiquidaciones`.

### `/historial/[anio]/[mes]` — Detalle de mes
- **Auth requerida:** Sí (empleador).
- **Propósito:** ver el detalle de un mes histórico y administrarlo.
- **Elementos clave:** desglose completo del mes, calendario en modo lectura, novedades; botón "Eliminar" (con **modal de confirmación**); botón "Reabrir" si está cerrada.
- **Historias de usuario:** HU-18, HU-19, HU-14.
- **Operaciones que consume:** `obtenerLiquidacion`, `eliminarLiquidacion`, `reabrirLiquidacion`.

### `/menu` — Menú de cocina
- **Auth requerida:** Sí (empleador).
- **Propósito:** configurar comidas y periodicidad, y definir la plantilla del menú.
- **Elementos clave:** selector de periodicidad (semanal/quincenal/mensual); editor de comidas a incluir; **tablero menú** (filas = días, columnas = comidas, por cada semana del ciclo) con campos de descripción; vista previa de "qué se prepara hoy".
- **Historias de usuario:** HU-20, HU-21, HU-22.
- **Operaciones que consume:** `obtenerMenu`, `actualizarConfiguracionMenu`, `actualizarMenu`.

### `/tareas` — Tareas / labores
- **Auth requerida:** Sí (empleador).
- **Propósito:** definir la rutina por día de la semana, ver el checklist del día y el histórico de cumplimiento.
- **Elementos clave:** editor de rutina por día (descripción, hora inicio/fin opcionales, orden, reordenable); **checklist del día** con casillas; vista de **histórico** por fecha (qué se completó).
- **Historias de usuario:** HU-23, HU-24, HU-25, HU-26.
- **Operaciones que consume:** `obtenerRutinaTareas`, `actualizarRutinaTareas`, `obtenerTareasDelDia`, `marcarTarea`, `obtenerHistoricoTareas`.

### (Global) Layout autenticado del empleador
- **Elementos clave:** barra de navegación inferior (mobile) / lateral (desktop) con las 6 secciones; menú de usuario con "Cerrar sesión".
- **Operaciones que consume:** `obtenerSesion`, `cerrarSesionEmpleador`.

---

## Zona Empleada (acceso por enlace, solo lectura)

### `/consulta/[token]` — Consulta de la empleada
- **Auth requerida:** No (sesión), pero requiere **token de acceso válido**. Solo lectura + marcar tareas. **Nunca muestra las notas del mes (RN-12).**
- **Propósito:** que la empleada consulte su pago, calendario, menú y tareas, y marque tareas como hechas.
- **Elementos clave:** validación del token al entrar (pantalla de error si es inválido/revocado); encabezado con nombre y avatar; **banner de cumpleaños**; pestañas:
  - **Pago** — calendario coloreado del mes + desglose y total (sin notas).
  - **Menú** — qué preparar hoy (y la semana), según la plantilla.
  - **Tareas** — checklist del día con casillas marcables.
- **Historias de usuario:** HU-03, HU-15, HU-16, HU-22, HU-24, HU-25, HU-27.
- **Operaciones que consume:** `validarAccesoEmpleada`, `obtenerEmpleada`, `obtenerLiquidacion`, `obtenerMenu`, `obtenerRutinaTareas`, `obtenerTareasDelDia`, `marcarTarea`.

---

## Flujos críticos

**Empleador — configurar y liquidar:**
```
[/login] → [/] Inicio → [/configuracion] (ficha + salario + días + items + enlace)
        → [/liquidar] (registrar novedades en el calendario) → [Cerrar liquidación]
        → [/historial] → [/historial/anio/mes] (detalle / eliminar / reabrir)
```

**Empleador — compartir acceso:**
```
[/configuracion] → [Generar enlace] → (comparte el enlace con la empleada)
```

**Empleada — consultar:**
```
(abre enlace) → [/consulta/token] valida token → Pestañas: [Pago] · [Menú] · [Tareas]
            → en Tareas: marcar tarea hecha
```

---

## Cobertura y gaps de contrato

- **Todas** las historias HU-01…HU-27 son alcanzables desde alguna pantalla.
- **Todas** las operaciones consumidas existen en `api-contract.md`. **No hay gaps de contrato**: ninguna pantalla necesita un dato que el contrato no exponga, y las 28 operaciones del contrato son consumidas por al menos una pantalla.
