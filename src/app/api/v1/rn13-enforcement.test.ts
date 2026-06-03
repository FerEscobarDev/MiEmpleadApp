import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de aplicación de RN-13 en los handlers de ESCRITURA de configuración
// (Epic 4.2, spec autorizacion-por-rol). Una petición autenticada SOLO como
// empleada (header X-Acceso-Token) NO puede escribir ⇒ 403 NO_AUTORIZADO. Sin
// token de empleada, el flujo existente (sesión/fallback) se preserva (AC-9).

const obtenerSesionEmpleadorMock = vi.fn();

vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { PUT as PUT_CONFIG } from "./configuracion/route";
import { PUT as PUT_EMPLEADA } from "./empleada/route";
import { POST as POST_ITEM } from "./items-adicionales/route";
import {
  PUT as PUT_ITEM,
  DELETE as DELETE_ITEM,
} from "./items-adicionales/[id]/route";

function escrituraRequest(
  path: string,
  method: string,
  body: unknown,
  token?: string,
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request(`http://localhost/api/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Genera un token de empleada válido para una cuenta recién creada.
async function tokenEmpleadaValido(email: string): Promise<string> {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
  const { token } = await generarEnlace(email, "http://localhost");
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
  return token;
}

describe("RN-13 — escrituras de configuración rechazan a la empleada", () => {
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

  it("AC-6: PUT /configuracion con token de empleada responde 403 y no modifica", async () => {
    await buildEmpleadaAggregate({ email: "jefeC@example.com", salarioBase: 700000 });
    const token = await tokenEmpleadaValido("jefeC@example.com");

    const res = await PUT_CONFIG(
      escrituraRequest(
        "configuracion",
        "PUT",
        { salarioBase: 999999, diasLaborales: ["LUNES"] },
        token,
      ),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");

    const config = await db.configuracion.findFirst();
    expect(config!.salarioBase).toBe(700000);
  });

  it("AC-7: PUT /empleada con token de empleada responde 403 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate({ email: "jefeD@example.com" });
    const token = await tokenEmpleadaValido("jefeD@example.com");

    const res = await PUT_EMPLEADA(
      escrituraRequest(
        "empleada",
        "PUT",
        {
          nombre: "Hacker",
          fechaNacimiento: "1990-01-01",
          fechaInicioContrato: "2026-01-01",
        },
        token,
      ),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-8: POST/PUT/DELETE items-adicionales con token de empleada responden 403", async () => {
    await buildEmpleadaAggregate({ email: "jefeE@example.com" });
    const token = await tokenEmpleadaValido("jefeE@example.com");

    const post = await POST_ITEM(
      escrituraRequest(
        "items-adicionales",
        "POST",
        { nombre: "Noche", valorUnitario: 20000 },
        token,
      ),
    );
    expect(post.status).toBe(403);
    expect((await post.json()).code).toBe("NO_AUTORIZADO");

    const put = await PUT_ITEM(
      escrituraRequest(
        "items-adicionales/abc",
        "PUT",
        { nombre: "Noche", valorUnitario: 20000 },
        token,
      ),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(put.status).toBe(403);

    const del = await DELETE_ITEM(
      escrituraRequest("items-adicionales/abc", "DELETE", undefined, token),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(del.status).toBe(403);
  });

  it("EC-1: PUT /configuracion con token INVÁLIDO responde 403 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate({ email: "jefeF@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);

    const res = await PUT_CONFIG(
      escrituraRequest(
        "configuracion",
        "PUT",
        { salarioBase: 800000, diasLaborales: ["LUNES"] },
        "token-invalido",
      ),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-9: PUT /configuracion SIN token sigue respondiendo 200 (backward-compat)", async () => {
    await buildEmpleadaAggregate({ email: "jefeG@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);

    const res = await PUT_CONFIG(
      escrituraRequest("configuracion", "PUT", {
        salarioBase: 850000,
        diasLaborales: ["LUNES", "MARTES"],
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).salarioBase).toBe(850000);
  });
});
