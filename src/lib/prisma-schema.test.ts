import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "./db";
import { setupTestDatabase, teardownTestDatabase, resetDatabase } from "./test/db-test-setup";

// Tests del schema Prisma (prisma-schema-and-client) contra una base SQLite
// real desechable. Cubre AC-2..AC-6 y EC-1..EC-4.
describe("schema Prisma (SQLite) — integración con base real", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-2: crea Empleador → Empleada (1-1) → Configuracion y los lee con relaciones", async () => {
    const empleador = await db.empleador.create({
      data: {
        email: "jefe@example.com",
        passwordHash: "hash",
        empleada: {
          create: {
            nombre: "María",
            fechaNacimiento: new Date("1990-05-10"),
            fechaInicioContrato: new Date("2026-01-01"),
            configuracion: {
              create: { salarioBase: 700000, diasLaborales: ["LUNES", "MARTES"] },
            },
          },
        },
      },
      include: { empleada: { include: { configuracion: true } } },
    });

    expect(empleador.empleada?.nombre).toBe("María");
    expect(empleador.empleada?.configuracion?.salarioBase).toBe(700000);
  });

  it("AC-3 / RN-10: rechaza dos Liquidacion con igual (empleadaId, anio, mes)", async () => {
    const empleada = await crearEmpleada();
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 6 },
    });

    await expect(
      db.liquidacion.create({
        data: { empleadaId: empleada.id, anio: 2026, mes: 6 },
      }),
    ).rejects.toThrow();

    // Cambiar el mes permite la segunda creación.
    const otra = await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 7 },
    });
    expect(otra.id).toBeDefined();
  });

  it("AC-4: round-trip JSON de diasLaborales y comidas sin pérdida", async () => {
    const empleada = await crearEmpleada({
      diasLaborales: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"],
    });
    const config = await db.configuracion.findUnique({
      where: { empleadaId: empleada.id },
    });
    expect(config?.diasLaborales).toEqual([
      "LUNES",
      "MARTES",
      "MIERCOLES",
      "JUEVES",
      "VIERNES",
      "SABADO",
    ]);

    await db.menuConfig.create({
      data: {
        empleadaId: empleada.id,
        comidas: ["DESAYUNO", "ALMUERZO", "ONCES"],
        periodicidad: "SEMANAL",
      },
    });
    const menu = await db.menuConfig.findUnique({ where: { empleadaId: empleada.id } });
    expect(menu?.comidas).toEqual(["DESAYUNO", "ALMUERZO", "ONCES"]);
  });

  it("AC-5: el cliente expone modelos para todas las entidades de §4", () => {
    const modelos = [
      db.empleador,
      db.empleada,
      db.configuracion,
      db.enlaceAcceso,
      db.itemAdicional,
      db.liquidacion,
      db.inasistencia,
      db.liquidacionItem,
      db.montoPuntual,
      db.menuConfig,
      db.menuEntrada,
      db.rutinaTarea,
      db.cumplimientoTarea,
    ];
    for (const m of modelos) {
      expect(typeof m.create).toBe("function");
    }
  });

  it("AC-6: estado es un String libre (enum-como-String, no enum nativo)", async () => {
    const empleada = await crearEmpleada();
    const liq = await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2025, mes: 1, estado: "CERRADA" },
    });
    expect(liq.estado).toBe("CERRADA");
    // Default BORRADOR cuando no se especifica.
    const liq2 = await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2025, mes: 2 },
    });
    expect(liq2.estado).toBe("BORRADOR");
  });

  it("EC-1: borrar una Liquidacion cascada a inasistencias/items/montos", async () => {
    const empleada = await crearEmpleada();
    const liq = await db.liquidacion.create({
      data: {
        empleadaId: empleada.id,
        anio: 2024,
        mes: 3,
        inasistencias: { create: { fecha: new Date("2024-03-04") } },
        montosPuntuales: { create: { descripcion: "Bono", monto: 50000 } },
        items: { create: { nombre: "Noche", valorUnitario: 20000, cantidad: 2 } },
      },
    });

    await db.liquidacion.delete({ where: { id: liq.id } });

    expect(await db.inasistencia.count({ where: { liquidacionId: liq.id } })).toBe(0);
    expect(await db.montoPuntual.count({ where: { liquidacionId: liq.id } })).toBe(0);
    expect(await db.liquidacionItem.count({ where: { liquidacionId: liq.id } })).toBe(0);
  });

  it("EC-2 / RN-09: borrar un ItemAdicional conserva el snapshot histórico", async () => {
    const empleada = await crearEmpleada();
    const item = await db.itemAdicional.create({
      data: {
        empleadaId: empleada.id,
        nombre: "Noche acompañamiento",
        valorUnitario: 20000,
        color: "#ff0000",
      },
    });
    const liq = await db.liquidacion.create({
      data: {
        empleadaId: empleada.id,
        anio: 2024,
        mes: 4,
        items: {
          create: { itemId: item.id, nombre: "Noche acompañamiento", valorUnitario: 20000, cantidad: 1 },
        },
      },
      include: { items: true },
    });

    await db.itemAdicional.delete({ where: { id: item.id } });

    const snapshot = await db.liquidacionItem.findUnique({ where: { id: liq.items[0].id } });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.nombre).toBe("Noche acompañamiento");
    expect(snapshot?.valorUnitario).toBe(20000);
    expect(snapshot?.itemId).toBeNull();
  });

  it("EC-3: una segunda Empleada para el mismo Empleador falla (1 empleada por empleador)", async () => {
    const empleador = await db.empleador.create({
      data: { email: "uno@example.com", passwordHash: "h" },
    });
    await db.empleada.create({
      data: {
        empleadorId: empleador.id,
        nombre: "A",
        fechaNacimiento: new Date("1990-01-01"),
        fechaInicioContrato: new Date("2026-01-01"),
      },
    });
    await expect(
      db.empleada.create({
        data: {
          empleadorId: empleador.id,
          nombre: "B",
          fechaNacimiento: new Date("1991-01-01"),
          fechaInicioContrato: new Date("2026-01-01"),
        },
      }),
    ).rejects.toThrow();
  });

  it("EC-4: una segunda Configuracion para la misma Empleada falla", async () => {
    const empleada = await crearEmpleada();
    await expect(
      db.configuracion.create({
        data: { empleadaId: empleada.id, salarioBase: 800000, diasLaborales: [] },
      }),
    ).rejects.toThrow();
  });
});

// Helper local mínimo del test: crea una empleada con su configuración.
async function crearEmpleada(opts?: { diasLaborales?: string[] }) {
  const empleador = await db.empleador.create({
    data: {
      email: `e-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "h",
      empleada: {
        create: {
          nombre: "Empleada",
          fechaNacimiento: new Date("1990-01-01"),
          fechaInicioContrato: new Date("2026-01-01"),
          configuracion: {
            create: { salarioBase: 700000, diasLaborales: opts?.diasLaborales ?? [] },
          },
        },
      },
    },
    include: { empleada: true },
  });
  return empleador.empleada!;
}
