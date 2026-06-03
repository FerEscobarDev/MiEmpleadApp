import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP del menú — lectura (obtenerMenu) y configuración
// (actualizarConfiguracionMenu). Epic 6.1, spec menu-configuracion-api. Base
// SQLite real desechable, sin mocks del dominio (conventions.md §7). El token de
// empleada se ejercita mockeando la lectura de sesión (igual que rn13-enforcement).

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { GET } from "./route";
import { PUT as PUT_CONFIG } from "./configuracion/route";

function getRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/menu", { method: "GET", headers });
}

function putConfigRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/menu/configuracion", {
    method: "PUT",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function tokenEmpleadaValido(email: string): Promise<string> {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
  const { token } = await generarEnlace(email, "http://localhost");
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
  return token;
}

describe("API /api/v1/menu — lectura y configuración", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
    obtenerSesionEmpleadorMock.mockReset();
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
  });

  it("AC-1: GET sin configuración devuelve el default y no materializa fila", async () => {
    await buildEmpleadaAggregate();

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configuracion.comidas).toEqual(["Desayuno", "Almuerzo", "Cena"]);
    expect(body.configuracion.periodicidad).toBe("SEMANAL");
    expect(body.entradas).toEqual([]);

    const count = await db.menuConfig.count();
    expect(count).toBe(0);
  });

  it("AC-2: tras configurar, GET devuelve esa configuración y entradas vacías", async () => {
    await buildEmpleadaAggregate();

    const put = await PUT_CONFIG(
      putConfigRequest({ comidas: ["Desayuno", "Cena"], periodicidad: "QUINCENAL" }),
    );
    expect(put.status).toBe(200);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configuracion.comidas).toEqual(["Desayuno", "Cena"]);
    expect(body.configuracion.periodicidad).toBe("QUINCENAL");
    expect(body.entradas).toEqual([]);
  });

  it("AC-3: GET devuelve config y entradas sembradas con el shape del contrato", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const menuConfig = await db.menuConfig.create({
      data: {
        empleadaId: empleada.id,
        comidas: ["Desayuno", "Almuerzo"],
        periodicidad: "SEMANAL",
      },
    });
    await db.menuEntrada.create({
      data: {
        menuConfigId: menuConfig.id,
        semana: 0,
        diaSemana: "LUNES",
        comida: "Desayuno",
        descripcion: "Huevos pericos",
      },
    });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configuracion.comidas).toEqual(["Desayuno", "Almuerzo"]);
    expect(body.entradas).toHaveLength(1);
    expect(body.entradas[0]).toEqual({
      semana: 0,
      diaSemana: "LUNES",
      comida: "Desayuno",
      descripcion: "Huevos pericos",
    });
  });

  it("AC-4: PUT configuración válida responde 200 y persiste (round-trip)", async () => {
    await buildEmpleadaAggregate();

    const res = await PUT_CONFIG(
      putConfigRequest({
        comidas: ["Desayuno", "Almuerzo", "Onces"],
        periodicidad: "MENSUAL",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comidas).toEqual(["Desayuno", "Almuerzo", "Onces"]);
    expect(body.periodicidad).toBe("MENSUAL");

    const after = await (await GET(getRequest())).json();
    expect(after.configuracion.comidas).toEqual(["Desayuno", "Almuerzo", "Onces"]);
    expect(after.configuracion.periodicidad).toBe("MENSUAL");
  });

  it("AC-5: PUT con periodicidad inválida responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT_CONFIG(
      putConfigRequest({ comidas: ["Desayuno"], periodicidad: "DIARIA" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
    expect(body.details).toBeDefined();
  });

  it("AC-6: PUT con comidas vacío responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT_CONFIG(
      putConfigRequest({ comidas: [], periodicidad: "SEMANAL" }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-7: PUT con una comida vacía/blanca responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT_CONFIG(
      putConfigRequest({ comidas: ["Desayuno", ""], periodicidad: "SEMANAL" }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-8 (RN-13): PUT con token de empleada responde 403 y no modifica", async () => {
    await buildEmpleadaAggregate({ email: "jefeMenu@example.com" });
    // Configuración inicial por el empleador (sin token).
    await PUT_CONFIG(
      putConfigRequest({ comidas: ["Desayuno"], periodicidad: "SEMANAL" }),
    );
    const token = await tokenEmpleadaValido("jefeMenu@example.com");

    const res = await PUT_CONFIG(
      putConfigRequest(
        { comidas: ["Hackeado"], periodicidad: "MENSUAL" },
        token,
      ),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");

    const config = await db.menuConfig.findFirst();
    expect(config!.comidas).toEqual(["Desayuno"]);
  });

  it("AC-9: GET con token de empleada responde 200 (lectura permitida)", async () => {
    await buildEmpleadaAggregate({ email: "jefeMenuR@example.com" });
    const token = await tokenEmpleadaValido("jefeMenuR@example.com");

    const res = await GET(getRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configuracion).toBeDefined();
    expect(body.entradas).toBeDefined();
  });

  it("AC-10: PUT configuración es idempotente (una sola fila)", async () => {
    await buildEmpleadaAggregate();
    const payload = { comidas: ["Desayuno", "Cena"], periodicidad: "QUINCENAL" };
    const first = await (await PUT_CONFIG(putConfigRequest(payload))).json();
    const second = await (await PUT_CONFIG(putConfigRequest(payload))).json();
    expect(second).toEqual(first);
    expect(await db.menuConfig.count()).toBe(1);
  });

  it("EC-1: PUT con JSON malformado responde 422 VALIDACION (no 500)", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT_CONFIG(putConfigRequest("{ roto"));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-2: PUT con comidas ausente responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT_CONFIG(putConfigRequest({ periodicidad: "SEMANAL" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-3: PUT con token de empleada inválido responde 403 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate();
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const res = await PUT_CONFIG(
      putConfigRequest(
        { comidas: ["Desayuno"], periodicidad: "SEMANAL" },
        "token-invalido",
      ),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("EC-4: PUT sin token sigue respondiendo 200 (backward-compat)", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT_CONFIG(
      putConfigRequest({ comidas: ["Desayuno"], periodicidad: "SEMANAL" }),
    );
    expect(res.status).toBe(200);
  });

  it("EC-5: actualizar la configuración no borra las entradas previas", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const menuConfig = await db.menuConfig.create({
      data: {
        empleadaId: empleada.id,
        comidas: ["Desayuno"],
        periodicidad: "SEMANAL",
      },
    });
    await db.menuEntrada.create({
      data: {
        menuConfigId: menuConfig.id,
        semana: 0,
        diaSemana: "MARTES",
        comida: "Desayuno",
        descripcion: "Arepa",
      },
    });

    const res = await PUT_CONFIG(
      putConfigRequest({ comidas: ["Desayuno", "Cena"], periodicidad: "SEMANAL" }),
    );
    expect(res.status).toBe(200);

    expect(await db.menuEntrada.count()).toBe(1);
  });
});
