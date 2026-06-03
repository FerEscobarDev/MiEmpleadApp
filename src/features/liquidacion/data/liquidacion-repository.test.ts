import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import {
  crearLiquidacion,
  buscarLiquidacionPorMes,
  listarLiquidacionesDeEmpleada,
} from "./liquidacion-repository";

// Tests del repositorio de liquidación (data-access-modules). RN-10.
describe("liquidacion-repository", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-3 / RN-10: crea y encuentra por (empleadaId, anio, mes); tripleta sin liquidación → undefined", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await crearLiquidacion({ empleadaId: empleada.id, anio: 2026, mes: 6 });

    const encontrada = await buscarLiquidacionPorMes(empleada.id, 2026, 6);
    expect(encontrada?.anio).toBe(2026);
    expect(encontrada?.mes).toBe(6);

    const ausente = await buscarLiquidacionPorMes(empleada.id, 2026, 7);
    expect(ausente).toBeUndefined();
  });

  it("AC-4 / RN-10: dos liquidaciones con igual tripleta fallan; con mes distinto, ambas se crean", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await crearLiquidacion({ empleadaId: empleada.id, anio: 2026, mes: 6 });
    await expect(
      crearLiquidacion({ empleadaId: empleada.id, anio: 2026, mes: 6 }),
    ).rejects.toThrow();

    await crearLiquidacion({ empleadaId: empleada.id, anio: 2026, mes: 8 });
    const lista = await listarLiquidacionesDeEmpleada(empleada.id);
    expect(lista.length).toBe(2);
  });

  it("EC-3: buscar liquidación de un mes sin liquidación devuelve undefined", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const result = await buscarLiquidacionPorMes(empleada.id, 2020, 1);
    expect(result).toBeUndefined();
  });
});
