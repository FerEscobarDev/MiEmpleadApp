import { describe, it, expect } from "vitest";
import { mapSesionADto } from "./session-dto";

// Tests de la traducción pura sesión de Auth.js → DTO del contrato obtenerSesion
// (Epic 4.1, spec auth-sesion-y-costura). Función pura, sin IO ni mocks.

describe("session-dto — mapSesionADto", () => {
  it("AC-3: sesión con user.email → { autenticado: true, email }", () => {
    const dto = mapSesionADto({ user: { email: "jefe@example.com" } });
    expect(dto).toEqual({ autenticado: true, email: "jefe@example.com" });
  });

  it("AC-3: sesión null → { autenticado: false }", () => {
    expect(mapSesionADto(null)).toEqual({ autenticado: false });
  });

  it("AC-3: sesión sin user → { autenticado: false }", () => {
    expect(mapSesionADto({})).toEqual({ autenticado: false });
  });

  it("EC-1: sesión con user sin email → autenticado true, email null", () => {
    const dto = mapSesionADto({ user: {} });
    expect(dto.autenticado).toBe(true);
    expect(dto.email ?? null).toBeNull();
  });
});
