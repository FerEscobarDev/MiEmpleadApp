# SPEC: Menú — Plantilla (tablero días×comidas por semana) — id: epic-8.5-menu/plantilla-menu

**Epic:** ROADMAP Milestone 8 / Epic 8.5 (Menú de cocina)   **Módulo:** architecture.md §Frontend `(employer)` / feature `menu`

## Objetivo

Construir la sección **plantilla** de `/menu`: un tablero editable (MenuBoard) con **una pestaña por semana del ciclo** (1/2/4 según la periodicidad configurada), filas = días L–D, columnas = las comidas configuradas, y celdas con la **descripción** editable de cada comida por día. Al guardar persiste con `actualizarMenu` el conjunto completo de entradas, enviando **solo entradas válidas** (semana dentro del rango de la periodicidad y `comida` dentro de las comidas configuradas) para que el backend (Epic 6.1) nunca devuelva 422. Incluye una vista/realce de **"qué se prepara hoy"** (día actual de la semana en zona Colombia).

## Fuera de Scope (NO testear, NO implementar)

- La edición de comidas y periodicidad y `actualizarConfiguracionMenu` (Spec `configuracion-menu`).
- La consulta de la empleada (`(employee)`).
- Validación 422 del backend (la aplica Epic 6.1); aquí se previene client-side ofreciendo solo combinaciones válidas.
- Cálculo de a qué semana del ciclo corresponde la fecha real del calendario (rotación quincenal/mensual sobre fechas reales): el realce "hoy" se limita al **día de la semana** actual sobre la semana visible; no se calcula el índice de ciclo a partir de la fecha. (El backend no expone ese mapeo en el contrato.)
- Pixel/estética (gate humano).

## Operaciones del Contrato de API

- **Consume** (frontend): `obtenerMenu` (GET `/menu` → `Menu`, ya cargado por el hook compartido), `actualizarMenu` (PUT `/menu/entradas`, body `MenuEntrada[]` → `MenuEntrada[]`). SOLO vía cliente tipado `@/lib/api/client`.

## Contrato (machine-readable — identificadores en inglés, conventions.md §8)

| Aspecto | Detalle |
|---------|---------|
| Entradas | Estado interno: `entradas: MenuEntrada[]` (`{ semana:int 0-based, diaSemana:DiaSemana, comida:string, descripcion:string }`), más `comidas` y `periodicidad` provenientes del hook compartido. `semana` válida ∈ `[0, semanasDePeriodicidad(periodicidad) - 1]`. |
| Salidas (éxito) | Al guardar: PUT `actualizarMenu` con body `MenuEntrada[]` ya **filtrado** (solo semanas válidas + comidas configuradas, descartando entradas con descripción vacía); respuesta `200 MenuEntrada[]` ⇒ toast éxito y estado refrescado con la respuesta. |
| Salidas (error) | Fallo de carga: cubierto por el hook (mensaje + toast). Fallo de guardado (no-ok, p.ej. 422/401) ⇒ toast error y se conservan las ediciones del usuario. |
| Efectos secundarios | Persistencia de la plantilla del menú vía backend. |
| Idempotencia | `actualizarMenu` idempotente (PUT, reemplazo total del set de entradas). |

## Reglas de Negocio

- **BR-1:** La plantilla es repetible por periodicidad: tantas semanas (pestañas) como `semanasDePeriodicidad(periodicidad)` (1/2/4). — fuente: business_requirements.md RN-14.
- **BR-2:** El menú se organiza **por comidas del día** configurables; las columnas del tablero son exactamente las comidas configuradas. — fuente: business_requirements.md RN-19/RN-14.
- **BR-3:** Solo el **empleador** edita (grupo `(employer)`, SessionGuard). — fuente: RN-13.
- **BR-4:** Las entradas enviadas deben respetar el rango de semanas de la periodicidad y usar solo comidas configuradas, para no provocar 422 (consistencia con Epic 6.1). Si una comida se quitó o la periodicidad se redujo, las entradas ahora inválidas se **descartan** antes de enviar.
- **BR-5:** Existe una vista/realce de "qué se prepara hoy": en la semana visible se resalta la fila del **día de la semana actual** (zona horaria America/Bogotá, RN-17). — fuente: business_requirements.md HU-22.

## Criterios de Aceptación (≥1 test por ID)

- **AC-1:** Tras cargar el menú (obtenerMenu), renderiza el tablero con columnas = comidas configuradas y filas = días L–D, mostrando las descripciones existentes en sus celdas.
- **AC-2:** El número de pestañas de semana coincide con la periodicidad: 1 pestaña (SEMANAL), 2 (QUINCENAL), 4 (MENSUAL).
- **AC-3:** Cambiar de pestaña de semana muestra las entradas de esa semana (las celdas reflejan la `semana` seleccionada).
- **AC-4:** Editar la descripción de una celda (día × comida) y guardar llama a `actualizarMenu` (PUT `/menu/entradas`) con un `MenuEntrada[]` que incluye una entrada con la `semana`, `diaSemana`, `comida` y la nueva `descripcion` editada.
- **AC-5:** El body enviado a `actualizarMenu` contiene **solo** entradas con `semana` dentro del rango de la periodicidad y `comida` dentro de las comidas configuradas (no se envían semanas/comidas inválidas).
- **AC-6:** Si una comida ya no está configurada o la periodicidad se redujo, las entradas correspondientes a esa comida/semana se descartan del body de guardado (no llegan al backend).
- **AC-7:** Tras `200` de `actualizarMenu` muestra toast de éxito.
- **AC-8:** Fallo de guardado (no-ok) muestra toast de error y conserva las ediciones del usuario en pantalla.
- **AC-9 (hoy):** El tablero resalta la fila del día de la semana actual (marcado accesible, p.ej. `aria-current`) en la semana visible.
- **AC-10 (a11y):** El tablero expone semántica de tabla con encabezados de columna (las comidas) y las celdas editables tienen nombre accesible (`aria-label` que identifique día + comida); las pestañas de semana son accesibles por teclado y tienen nombre.
- **AC-11 (vacío):** Si no hay comidas configuradas, el tablero no se renderiza como tabla editable sino un estado guía que invita a configurar comidas primero (no permite editar columnas inexistentes).

## Edge Cases

- **EC-1:** Celda dejada en blanco ⇒ esa entrada no se incluye en el body (no se persisten descripciones vacías); si antes existía y se borra, simplemente deja de enviarse (PUT reemplaza el set).
- **EC-2:** Periodicidad QUINCENAL con entradas solo en semana 0 ⇒ la pestaña de semana 1 se muestra vacía y editable; guardar no falla.
- **EC-3:** Periodicidad reducida de MENSUAL (4) a SEMANAL (1) con entradas en semanas 1–3 ⇒ esas entradas se descartan; el body solo lleva semana 0.
- **EC-4:** Comida renombrada en la configuración ⇒ las entradas de la comida anterior (cuyo nombre ya no está configurado) se descartan; las columnas reflejan los nombres nuevos.

## Superficie de Código Existente (para el implementer)

- Hook compartido (creado en Spec `configuracion-menu`): `useMenu` en `src/app/(employer)/menu/use-menu.ts` — expone el menú cargado, `comidas`, `periodicidad`, `entradas`, `semanasDePeriodicidad`, y acciones; extiende aquí con la edición de celdas y el guardado de entradas (`actualizarMenu`) si no se incluyó. El implementer puede ubicar la lógica de plantilla en el hook o en la sección, manteniendo I/O solo por el cliente tipado.
- Cliente tipado: `apiClient.GET("/menu")`, `apiClient.PUT("/menu/entradas", { body })` (body `MenuEntrada[]`). Retorna `{ data, error, response }`.
- Componente DS de dominio: `MenuBoard` en `src/components/domain/MenuBoard.tsx` — firma actual: `MenuBoard({ comidas: string[], entradas: MenuEntrada[], semana?: number, diaHoy?: DiaSemana, className? })`. Es **presentacional de solo lectura** (celdas no editables). El implementer puede: (a) extender MenuBoard para soportar edición opcional vía props (`editable?`, `onCellChange?(dia, comida, valor)`, manteniendo retrocompat con el showcase `src/app/dev/design-system/sections.tsx`), o (b) componer un tablero editable en la sección reutilizando `Table` (`@/components/ui/Table`). Cualquiera respeta el DS. `DiaSemana` y `MenuEntrada` se exportan desde MenuBoard.tsx y coinciden con el schema.
- Pestañas de semana: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (`@/components/ui/Tabs`, Radix) — accesibles por teclado; en tests jsdom los `TabsTrigger` responden a `.click()`/`fireEvent.click`.
- Día de hoy: derivar `diaHoy: DiaSemana` del día de la semana actual; permitir inyectar la fecha/día como parámetro para testabilidad (no usar `Date.now()` oculto e intesteable — conventions.md §3/§7: fechas como parámetro). Mapear `getDay()` (0=Domingo) a `DiaSemana`.
- `Input` (`@/components/ui/Input`) o `Textarea` (`@/components/ui/Textarea`) para celdas editables, con `aria-label`.
- Crea: `src/app/(employer)/menu/plantilla-menu-section.tsx` (`"use client"`).
- Patrón de test: `src/app/(employer)/historial/historial-section.test.tsx` (mock `fetch` + `sonner`). Reusar.

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en inglés (conventions.md §8).*
