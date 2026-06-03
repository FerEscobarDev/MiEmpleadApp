import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { buscarEmpleadorPorEmail } from "./empleador-repository";

// Tests del repositorio de empleador de auth (Epic 4.1, spec
// auth-empleador-credenciales). Base SQLite real desechable, sin mocks
// (conventions.md §7). Único acceso a Prisma del feature auth (architecture.md §2.6/§6).

describe("empleador-repository — buscarEmpleadorPorEmail", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-5: devuelve el empleador cuando el email existe (id, email, passwordHash)", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe@example.com",
      passwordHash: "hash-almacenado",
    });

    const found = await buscarEmpleadorPorEmail("jefe@example.com");
    expect(found).toBeDefined();
    expect(found?.id).toBe(empleador.id);
    expect(found?.email).toBe("jefe@example.com");
    expect(found?.passwordHash).toBe("hash-almacenado");
  });

  it("AC-5: devuelve undefined cuando el email no existe", async () => {
    await buildEmpleadaAggregate({ email: "jefe@example.com" });
    const found = await buscarEmpleadorPorEmail("nadie@example.com");
    expect(found).toBeUndefined();
  });
});
