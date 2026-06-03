import { describe, it, expect } from "vitest";

// AC-1 (prisma-schema-and-client): src/lib/db.ts exporta un cliente Prisma
// único; importarlo dos veces devuelve la MISMA instancia (singleton).
describe("cliente Prisma único (src/lib/db.ts)", () => {
  it("AC-1: exporta una instancia de PrismaClient con los modelos de §4", async () => {
    const mod = await import("./db");
    expect(mod.db).toBeDefined();
    // Modelos de todas las entidades de §4 expuestos por el cliente.
    expect(typeof mod.db.empleador.create).toBe("function");
    expect(typeof mod.db.empleada.create).toBe("function");
    expect(typeof mod.db.configuracion.create).toBe("function");
    expect(typeof mod.db.enlaceAcceso.create).toBe("function");
    expect(typeof mod.db.itemAdicional.create).toBe("function");
    expect(typeof mod.db.liquidacion.create).toBe("function");
    expect(typeof mod.db.inasistencia.create).toBe("function");
    expect(typeof mod.db.liquidacionItem.create).toBe("function");
    expect(typeof mod.db.montoPuntual.create).toBe("function");
    expect(typeof mod.db.menuConfig.create).toBe("function");
    expect(typeof mod.db.menuEntrada.create).toBe("function");
    expect(typeof mod.db.rutinaTarea.create).toBe("function");
    expect(typeof mod.db.cumplimientoTarea.create).toBe("function");
  });

  it("AC-1: importar el módulo dos veces devuelve la misma instancia (singleton)", async () => {
    const a = await import("./db");
    const b = await import("./db");
    expect(a.db).toBe(b.db);
  });
});
