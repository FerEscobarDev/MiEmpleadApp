import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";

// Tests de la capa de autorización por rol (Epic 4.2, spec autorizacion-por-rol).
// Resuelve el rol del llamador desde la sesión del empleador (costura mockeada) o
// desde el token de empleada (header X-Acceso-Token, validado contra DB real).
// Helpers puros: esEmpleador, puedeEscribir, stripNotas (RN-12).

const obtenerSesionEmpleadorMock = vi.fn();

vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import {
  resolverRol,
  esEmpleador,
  puedeEscribir,
  stripNotas,
} from "./authorize";

function reqConToken(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/cualquiera", {
    method: "GET",
    headers,
  });
}

describe("authorize — capa de autorización por rol", () => {
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

  it("AC-1: con sesión de empleador resuelve { rol: EMPLEADOR, empleadaId }", async () => {
    const { empleador, empleada } = await buildEmpleadaAggregate({
      email: "jefeA@example.com",
    });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: empleador.email });

    const rol = await resolverRol(reqConToken(undefined));
    expect(rol).not.toBeNull();
    expect(rol!.rol).toBe("EMPLEADOR");
    expect(rol!.empleadaId).toBe(empleada.id);
  });

  it("AC-2: sin sesión y con token válido resuelve { rol: EMPLEADA, empleadaId }", async () => {
    const { empleador, empleada } = await buildEmpleadaAggregate({
      email: "jefeB@example.com",
    });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: empleador.email });
    const { token } = await generarEnlace(empleador.email, "http://localhost");

    // Ahora sin sesión: solo el token.
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const rol = await resolverRol(reqConToken(token));
    expect(rol).not.toBeNull();
    expect(rol!.rol).toBe("EMPLEADA");
    expect(rol!.empleadaId).toBe(empleada.id);
  });

  it("AC-3: sin sesión y con token inválido resuelve null", async () => {
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const rol = await resolverRol(reqConToken("token-que-no-existe"));
    expect(rol).toBeNull();
  });

  it("AC-4: puedeEscribir true para EMPLEADOR, false para EMPLEADA", () => {
    expect(puedeEscribir({ rol: "EMPLEADOR", empleadaId: "x" })).toBe(true);
    expect(puedeEscribir({ rol: "EMPLEADA", empleadaId: "x" })).toBe(false);
    expect(esEmpleador({ rol: "EMPLEADOR", empleadaId: "x" })).toBe(true);
    expect(esEmpleador({ rol: "EMPLEADA", empleadaId: "x" })).toBe(false);
  });

  it("AC-5: stripNotas elimina notas para EMPLEADA y las conserva para EMPLEADOR", () => {
    const obj = { anio: 2026, mes: 6, notas: "privado", total: 100 };

    const paraEmpleada = stripNotas(obj, "EMPLEADA");
    expect("notas" in paraEmpleada).toBe(false);
    expect(paraEmpleada.total).toBe(100);

    const paraEmpleador = stripNotas(obj, "EMPLEADOR");
    expect(paraEmpleador.notas).toBe("privado");
  });

  it("EC-2: stripNotas sobre objeto sin notas no falla", () => {
    const obj = { anio: 2026, total: 100 };
    expect(stripNotas(obj, "EMPLEADA")).toEqual({ anio: 2026, total: 100 });
    expect(stripNotas(obj, "EMPLEADOR")).toEqual({ anio: 2026, total: 100 });
  });

  it("EC-3: stripNotas no muta el objeto original", () => {
    const obj = { notas: "privado", total: 100 };
    const copia = stripNotas(obj, "EMPLEADA");
    expect(obj.notas).toBe("privado");
    expect(copia).not.toBe(obj);
  });
});
