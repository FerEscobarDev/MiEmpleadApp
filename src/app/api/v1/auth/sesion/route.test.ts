import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del handler GET /api/v1/auth/sesion (Epic 4.1, spec auth-sesion-y-costura).
// La costura de lectura de sesión se mockea para no depender de la maquinaria de
// cookies de Auth.js (decisión de cobertura del spec: se prueba la lógica, no el
// ciclo completo de cookies).

const obtenerSesionEmpleadorMock = vi.fn();

vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { GET } from "./route";

describe("API GET /api/v1/auth/sesion", () => {
  beforeEach(() => {
    obtenerSesionEmpleadorMock.mockReset();
  });

  it("AC-1: con sesión válida responde 200 { autenticado:true, email }", async () => {
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefe@example.com" });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ autenticado: true, email: "jefe@example.com" });
  });

  it("AC-2: sin sesión responde 200 { autenticado:false }", async () => {
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.autenticado).toBe(false);
  });
});
