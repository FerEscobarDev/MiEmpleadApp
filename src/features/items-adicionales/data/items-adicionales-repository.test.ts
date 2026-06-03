import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import {
  listarItems,
  crearItem,
  actualizarItem,
  eliminarItem,
  buscarItemPorId,
} from "./items-adicionales-repository";

// Tests del repositorio de items adicionales (data-access-modules, architecture.md
// §2.5). Base SQLite real desechable, sin mocks (conventions.md §7).
describe("items-adicionales-repository", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("crea y lista items de una empleada", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const creado = await crearItem(empleada.id, {
      nombre: "Noche",
      valorUnitario: 20000,
      color: "#112233",
      activo: true,
    });
    expect(creado.id).toBeDefined();

    const items = await listarItems(empleada.id);
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe("Noche");
  });

  it("buscar por id devuelve undefined (no null) cuando no existe", async () => {
    const result = await buscarItemPorId("noexiste");
    expect(result).toBeUndefined();
  });

  it("actualiza un item existente", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const creado = await crearItem(empleada.id, {
      nombre: "Original",
      valorUnitario: 1000,
      color: "",
      activo: true,
    });
    const actualizado = await actualizarItem(creado.id, {
      nombre: "Cambiado",
      valorUnitario: 2000,
      color: "#FFFFFF",
      activo: false,
    });
    expect(actualizado.nombre).toBe("Cambiado");
    expect(actualizado.valorUnitario).toBe(2000);
    expect(actualizado.activo).toBe(false);
  });

  it("elimina un item existente", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const creado = await crearItem(empleada.id, {
      nombre: "Borrar",
      valorUnitario: 1000,
      color: "",
      activo: true,
    });
    await eliminarItem(creado.id);
    const items = await listarItems(empleada.id);
    expect(items).toHaveLength(0);
  });
});
