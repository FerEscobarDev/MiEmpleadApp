import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP del enlace de acceso (Epic 4.2, spec acceso-enlace-api).
// Base SQLite real desechable, sin mocks de DB (conventions.md §7). La sesión del
// empleador se mockea mediante la costura session-reader. generar/revocar requieren
// sesión de empleador; validar usa el header X-Acceso-Token.

const obtenerSesionEmpleadorMock = vi.fn();

vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { POST, DELETE } from "./route";
import { GET as VALIDAR } from "../validar/route";

function enlaceRequest(method: "POST" | "DELETE"): Request {
  return new Request("http://localhost/api/v1/acceso/enlace", { method });
}

function validarRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/acceso/validar", {
    method: "GET",
    headers,
  });
}

function conSesion(email: string): void {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
}

function sinSesion(): void {
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
}

describe("API /api/v1/acceso/enlace + /acceso/validar", () => {
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

  it("AC-1: generar con sesión responde 200 con {token,url,activo:true}", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe1@example.com",
    });
    conSesion(empleador.email);

    const res = await POST(enlaceRequest("POST"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.activo).toBe(true);
    expect(body.url).toContain(`/consulta/${body.token}`);
    expect(body.url.endsWith(`/consulta/${body.token}`)).toBe(true);
  });

  it("AC-2: validar con el token devuelto responde 200 {nombre,valido:true}", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe2@example.com",
      nombre: "Maria Lopez",
    });
    conSesion(empleador.email);

    const gen = await (await POST(enlaceRequest("POST"))).json();

    const res = await VALIDAR(validarRequest(gen.token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre).toBe("Maria Lopez");
    expect(body.valido).toBe(true);
  });

  it("AC-3: regenerar produce token distinto; el antiguo deja de validar", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe3@example.com",
    });
    conSesion(empleador.email);

    const primero = await (await POST(enlaceRequest("POST"))).json();
    const segundo = await (await POST(enlaceRequest("POST"))).json();

    expect(segundo.token).not.toBe(primero.token);

    const viejo = await VALIDAR(validarRequest(primero.token));
    expect(viejo.status).toBe(401);
    expect((await viejo.json()).code).toBe("ACCESO_INVALIDO");

    const nuevo = await VALIDAR(validarRequest(segundo.token));
    expect(nuevo.status).toBe(200);
  });

  it("AC-4: revocar con sesión responde 204 y el token deja de validar", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe4@example.com",
    });
    conSesion(empleador.email);

    const gen = await (await POST(enlaceRequest("POST"))).json();

    const rev = await DELETE(enlaceRequest("DELETE"));
    expect(rev.status).toBe(204);

    const val = await VALIDAR(validarRequest(gen.token));
    expect(val.status).toBe(401);
    expect((await val.json()).code).toBe("ACCESO_INVALIDO");
  });

  it("AC-5: generar SIN sesión responde 401 NO_AUTORIZADO", async () => {
    sinSesion();
    const res = await POST(enlaceRequest("POST"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("NO_AUTORIZADO");
  });

  it("AC-6: revocar SIN sesión responde 401 NO_AUTORIZADO", async () => {
    sinSesion();
    const res = await DELETE(enlaceRequest("DELETE"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("NO_AUTORIZADO");
  });

  it("AC-7: validar sin header X-Acceso-Token responde 401 ACCESO_INVALIDO", async () => {
    const res = await VALIDAR(validarRequest(undefined));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("ACCESO_INVALIDO");
  });

  it("AC-8: validar con un token nunca generado responde 401 ACCESO_INVALIDO", async () => {
    const res = await VALIDAR(validarRequest("token-inexistente-xyz"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("ACCESO_INVALIDO");
  });

  it("EC-1: revocar sin enlace previo responde 204 (idempotente)", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe5@example.com",
    });
    conSesion(empleador.email);

    const res = await DELETE(enlaceRequest("DELETE"));
    expect(res.status).toBe(204);
  });

  it("EC-2: el token se almacena hasheado, no en claro", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe6@example.com",
    });
    conSesion(empleador.email);

    const gen = await (await POST(enlaceRequest("POST"))).json();

    const fila = await db.enlaceAcceso.findFirst();
    expect(fila).not.toBeNull();
    expect(fila!.token).not.toBe(gen.token);
  });

  it("EC-3: dos generaciones mantienen una sola fila EnlaceAcceso", async () => {
    const { empleador } = await buildEmpleadaAggregate({
      email: "jefe7@example.com",
    });
    conSesion(empleador.email);

    await POST(enlaceRequest("POST"));
    await POST(enlaceRequest("POST"));

    const count = await db.enlaceAcceso.count();
    expect(count).toBe(1);
  });
});
