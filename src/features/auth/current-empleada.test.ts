import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";

// Tests de la costura de identidad getCurrentEmpleadaId() cableada a la sesión
// (Epic 4.1, spec auth-sesion-y-costura). La costura de lectura de sesión se
// mockea; el resto usa DB real. Con sesión ⇒ empleada DEL empleador de la sesión;
// sin sesión ⇒ fallback single-tenant (backward-compat con los tests de config).

const obtenerSesionEmpleadorMock = vi.fn();

vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { getCurrentEmpleadaId, EmpleadaNoResueltaError } from "./current-empleada";

describe("current-empleada — getCurrentEmpleadaId con sesión", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
    obtenerSesionEmpleadorMock.mockReset();
  });

  it("AC-8: con sesión resuelve la empleada DEL empleador de la sesión (no la primera)", async () => {
    // Dos cuentas en la base: la sesión apunta a la segunda.
    await buildEmpleadaAggregate({ email: "primero@example.com" });
    const segundo = await buildEmpleadaAggregate({ email: "segundo@example.com" });

    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "segundo@example.com" });

    const empleadaId = await getCurrentEmpleadaId();
    expect(empleadaId).toBe(segundo.empleada.id);
  });

  it("AC-9: sin sesión usa el fallback single-tenant (única empleada)", async () => {
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const unica = await buildEmpleadaAggregate({ email: "unico@example.com" });

    const empleadaId = await getCurrentEmpleadaId();
    expect(empleadaId).toBe(unica.empleada.id);
  });

  it("AC-9: sin sesión y sin empleadas lanza EmpleadaNoResueltaError", async () => {
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    await expect(getCurrentEmpleadaId()).rejects.toBeInstanceOf(
      EmpleadaNoResueltaError,
    );
  });

  it("EC-2: con sesión de empleador SIN empleada lanza EmpleadaNoResueltaError", async () => {
    // Empleador sin empleada asociada.
    const { db } = await import("@/lib/db");
    await db.empleador.create({
      data: { email: "sinempleada@example.com", passwordHash: "hash" },
    });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "sinempleada@example.com" });

    await expect(getCurrentEmpleadaId()).rejects.toBeInstanceOf(
      EmpleadaNoResueltaError,
    );
  });
});
