import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, resetDatabase } from "./db-test-setup";
import { buildEmpleadaAggregate } from "./factories";

// Tests del factory builder de pruebas (data-access-modules, AC-5/EC-2).
describe("factories — builder de datos de prueba", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-5: construye un agregado persistido con defaults (salario 700000) y aplica overrides", async () => {
    const { db } = await import("@/lib/db");

    const porDefecto = await buildEmpleadaAggregate();
    const config = await db.configuracion.findUnique({
      where: { empleadaId: porDefecto.empleada.id },
    });
    expect(config?.salarioBase).toBe(700000); // RN-18

    const conOverrides = await buildEmpleadaAggregate({
      nombre: "Juana",
      salarioBase: 1200000,
    });
    expect(conOverrides.empleada.nombre).toBe("Juana");
    const config2 = await db.configuracion.findUnique({
      where: { empleadaId: conOverrides.empleada.id },
    });
    expect(config2?.salarioBase).toBe(1200000);
  });

  it("EC-2: dos invocaciones crean agregados distintos sin colisión de unicidad", async () => {
    const a = await buildEmpleadaAggregate();
    const b = await buildEmpleadaAggregate();
    expect(a.empleador.id).not.toBe(b.empleador.id);
    expect(a.empleada.id).not.toBe(b.empleada.id);
  });
});
