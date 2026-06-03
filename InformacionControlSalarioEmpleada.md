Calculadora mensual de pago para una empleada doméstica informal en Colombia.

## Reglas de negocio

- Salario mensual base pactado: configurable (default $700.000 COP)
- Horario: lunes a sábado: configurable
- Inicio de contrato: configurable 
- Pago adicional conceptos configurables por x numero de veces al mes: configurable 
- El valor por día = salario mensual ÷ total de días a laborar en el mes
- Los festivos colombianos que caen en L-S se cuentan como días pagados (incluidos en el salario mensual): configurable
- Los días de inasistencia se descuentan del pago
- El mes puede ser parcial si es el mes de inicio del contrato

## Festivos Colombia
Incluye los día festivos colombianos con librería para ello que consideren la ley emiliani. Calcula correctamente cuáles caen en L-S para no descontarlos.

## Funcionalidades

1. **Configuración** (persistida en storage):
   - Nombre de la empleada
   - Fecha nacimiento
   - Fecha de inicio del contrato
   - Salario mensual base
   - Crear items de valores adicionales del mes: ejemplo: Noches acompañamiento mascotas: 20000 COP, Hora extra diurna: 5000 COP etc
2. **Liquidación mensual**: el usuario selecciona el mes/año a liquidar y puede registrar:
   - Días de inasistencia (con selector de fechas del calendario del mes)
   - Noches de acompañamiento (cantidad)
   - Notas opcionales del mes
   - Puede ir alimentando las novedades del mes para que tanto la empleada como el empleador pueda verlos y al final del mes poder aplicar la liquidación del total a pagar

3. **Cálculo automático** que muestre:
   - Total de días L-S del mes
   - Días festivos en L-S (no se descuentan)
   - Días efectivamente trabajados
   - Subtotal por días trabajados
   - Subtotal por x items adicionales configurados durante el mes, ejemplo: 2 noches de acompañamiento mascotas y 10 horas extras diurnas
   - Total a pagar

4. **Historial** de todos los meses liquidados, persistido en storage, con opción de ver el detalle de cada mes.

5. **Calendario visual** del mes seleccionado donde se distingan con colores:
   - Días trabajados (verde)
   - Inasistencias (naranja/rojo)
   - Festivos (azul/morado)
   - Domingos (gris)
   - Items adicionales color configurado
   - Días antes del inicio del contrato (gris claro)

6. **Menú cocina** se debe poder establecer un menú semanal, quincenal o mensual según lo establesca el usuario para que la empleada consulte y sepa que debe preparar cada día

7. **Distribución de tareas diarias** Se debe poder definir un itinerario de labores que debe realizar cada día tipo check list y de manera opcional establecer horarios ejemplo Lunes: de 8am a 9:30 am preparar desayuno, 9:30 am a 10:30 am tender la ropa, 10:30 a 11 am limpiar telarañas, de 11am a 01pm preparar almuerzo 

8. **Roles** Debe existir rol de empleada y de empleador el empleador es el único que configura todo la empleada solo consulta

## Storage
- A definir en el proyecto

## UI
- Diseño limpio, profesional, en español
- Secciones: Configuración | Liquidar mes | Historial | Menu | Labores del día
- Formateo de números como moneda colombiana: Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
- Totales destacados visualmente
- Botón para eliminar una liquidación del historial (con confirmación)