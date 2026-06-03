import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import {
  crearEmpleadorConEmpleada,
  buscarEmpleadaPorEmpleador,
  obtenerConfiguracionDeEmpleada,
} from "./empleada-repository";

// Tests del repositorio de empleada/configuración (data-access-modules).
// Base SQLite real desechable, sin mocks (conventions.md §7).
describe("empleada-repository", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-1: crea Empleador + Empleada + Configuracion y permite leer la empleada con su config", async () => {
    const { empleador, empleada } = await crearEmpleadorConEmpleada({
      email: "jefe@example.com",
      passwordHash: "hash",
      nombre: "María",
      fechaNacimiento: new Date("1990-05-10"),
      fechaInicioContrato: new Date("2026-01-01"),
      salarioBase: 700000,
      diasLaborales: ["LUNES", "MARTES"],
    });

    expect(empleador.id).toBeDefined();
    expect(empleada.nombre).toBe("María");

    const encontrada = await buscarEmpleadaPorEmpleador(empleador.id);
    expect(encontrada?.id).toBe(empleada.id);

    const config = await obtenerConfiguracionDeEmpleada(empleada.id);
    expect(config?.salarioBase).toBe(700000);
  });

  it("AC-2: buscar empleada de un empleadorId inexistente devuelve undefined (no null, no throw)", async () => {
    const result = await buscarEmpleadaPorEmpleador("noexiste");
    expect(result).toBeUndefined();
  });

  it("AC-6: round-trip JSON de diasLaborales vía repositorio", async () => {
    const { empleada } = await crearEmpleadorConEmpleada({
      email: "x@example.com",
      passwordHash: "h",
      nombre: "N",
      fechaNacimiento: new Date("1990-01-01"),
      fechaInicioContrato: new Date("2026-01-01"),
      salarioBase: 700000,
      diasLaborales: ["LUNES", "SABADO"],
    });
    const config = await obtenerConfiguracionDeEmpleada(empleada.id);
    expect(config?.diasLaborales).toEqual(["LUNES", "SABADO"]);
  });

  it("EC-1: crear configuración para una empleada que ya tiene una falla", async () => {
    const { empleada } = await crearEmpleadorConEmpleada({
      email: "y@example.com",
      passwordHash: "h",
      nombre: "N",
      fechaNacimiento: new Date("1990-01-01"),
      fechaInicioContrato: new Date("2026-01-01"),
      salarioBase: 700000,
      diasLaborales: [],
    });
    // Reintentar crear el agregado con el MISMO empleador/empleada no aplica;
    // el invariante se prueba a nivel de schema: una config por empleada.
    const { db } = await import("@/lib/db");
    await expect(
      db.configuracion.create({
        data: { empleadaId: empleada.id, salarioBase: 1, diasLaborales: [] },
      }),
    ).rejects.toThrow();
  });
});
