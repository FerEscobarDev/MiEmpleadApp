import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP del menú — entradas de la plantilla (actualizarMenu).
// Epic 6.1, spec menu-entradas-api. Reemplazo total de entradas con validación de
// rango de semana por periodicidad (RN-14) y comida ∈ comidas configuradas (RN-19).

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { PUT } from "./route";

interface EntradaInput {
  semana: number;
  diaSemana: string;
  comida: string;
  descripcion: string;
}

function putRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/menu/entradas", {
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

// Siembra una MenuConfig con comidas/periodicidad dadas para la empleada.
async function seedConfig(
  empleadaId: string,
  comidas: string[],
  periodicidad: string,
): Promise<void> {
  await db.menuConfig.create({
    data: { empleadaId, comidas, periodicidad },
  });
}

function entrada(over: Partial<EntradaInput> = {}): EntradaInput {
  return {
    semana: over.semana ?? 0,
    diaSemana: over.diaSemana ?? "LUNES",
    comida: over.comida ?? "Desayuno",
    descripcion: over.descripcion ?? "Algo rico",
  };
}

describe("API /api/v1/menu/entradas — actualizarMenu", () => {
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

  it("AC-1: PUT con arreglo válido responde 200 y persiste las entradas", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno", "Almuerzo"], "SEMANAL");

    const res = await PUT(
      putRequest([
        entrada({ diaSemana: "LUNES", comida: "Desayuno", descripcion: "Huevos" }),
        entrada({ diaSemana: "MARTES", comida: "Almuerzo", descripcion: "Sopa" }),
      ]),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      semana: 0,
      diaSemana: "LUNES",
      comida: "Desayuno",
      descripcion: "Huevos",
    });

    expect(await db.menuEntrada.count()).toBe(2);
  });

  it("AC-2: un segundo PUT reemplaza por completo las entradas previas", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno", "Almuerzo"], "SEMANAL");

    await PUT(
      putRequest([
        entrada({ diaSemana: "LUNES" }),
        entrada({ diaSemana: "MARTES" }),
        entrada({ diaSemana: "MIERCOLES" }),
      ]),
    );
    const res = await PUT(putRequest([entrada({ diaSemana: "VIERNES" })]));
    expect(res.status).toBe(200);
    expect(await db.menuEntrada.count()).toBe(1);
    const only = await db.menuEntrada.findFirst();
    expect(only!.diaSemana).toBe("VIERNES");
  });

  it("AC-3: diaSemana inválido responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    const res = await PUT(putRequest([entrada({ diaSemana: "LUNADES" })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-4 (BR-2): SEMANAL con semana 1 responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    const res = await PUT(putRequest([entrada({ semana: 1 })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-5 (BR-2): QUINCENAL acepta semana 1 y rechaza semana 2", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "QUINCENAL");

    const ok = await PUT(putRequest([entrada({ semana: 1 })]));
    expect(ok.status).toBe(200);

    const bad = await PUT(putRequest([entrada({ semana: 2 })]));
    expect(bad.status).toBe(422);
    expect((await bad.json()).code).toBe("VALIDACION");
  });

  it("AC-6 (BR-2): MENSUAL acepta semana 3 y rechaza semana 4", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "MENSUAL");

    const ok = await PUT(putRequest([entrada({ semana: 3 })]));
    expect(ok.status).toBe(200);

    const bad = await PUT(putRequest([entrada({ semana: 4 })]));
    expect(bad.status).toBe(422);
    expect((await bad.json()).code).toBe("VALIDACION");
  });

  it("AC-7 (BR-3): comida no configurada responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno", "Almuerzo", "Cena"], "SEMANAL");
    const res = await PUT(putRequest([entrada({ comida: "Onces" })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-8 (BR-3): comida configurada responde 200", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno", "Almuerzo", "Cena"], "SEMANAL");
    const res = await PUT(putRequest([entrada({ comida: "Cena" })]));
    expect(res.status).toBe(200);
  });

  it("AC-9 (BR-2 default): sin MenuConfig rige SEMANAL", async () => {
    await buildEmpleadaAggregate();

    const ok = await PUT(
      putRequest([entrada({ semana: 0, comida: "Desayuno" })]),
    );
    expect(ok.status).toBe(200);

    const bad = await PUT(
      putRequest([entrada({ semana: 1, comida: "Desayuno" })]),
    );
    expect(bad.status).toBe(422);
    expect((await bad.json()).code).toBe("VALIDACION");
  });

  it("AC-10 (RN-13): PUT con token de empleada responde 403 y no modifica", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeEnt@example.com" });
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    await PUT(putRequest([entrada({ descripcion: "Original" })]));
    const token = await tokenEmpleadaValido("jefeEnt@example.com");

    const res = await PUT(
      putRequest([entrada({ descripcion: "Hackeado" })], token),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");

    expect(await db.menuEntrada.count()).toBe(1);
    const only = await db.menuEntrada.findFirst();
    expect(only!.descripcion).toBe("Original");
  });

  it("AC-11: PUT idempotente — dos PUT idénticos dejan el mismo conjunto", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno", "Almuerzo"], "SEMANAL");
    const payload = [
      entrada({ diaSemana: "LUNES", comida: "Desayuno" }),
      entrada({ diaSemana: "LUNES", comida: "Almuerzo" }),
    ];
    await PUT(putRequest(payload));
    await PUT(putRequest(payload));
    expect(await db.menuEntrada.count()).toBe(2);
  });

  it("EC-1: body que no es array responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    const res = await PUT(putRequest({ no: "array" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-2: arreglo vacío responde 200 y borra las entradas previas", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    await PUT(putRequest([entrada()]));
    const res = await PUT(putRequest([]));
    expect(res.status).toBe(200);
    expect(await db.menuEntrada.count()).toBe(0);
  });

  it("EC-3: semana negativa responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    const res = await PUT(putRequest([entrada({ semana: -1 })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-4: comida vacía responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    const res = await PUT(putRequest([entrada({ comida: "" })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-5: JSON malformado responde 422 VALIDACION (no 500)", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    const res = await PUT(putRequest("{ roto"));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-6: token de empleada inválido responde 403 NO_AUTORIZADO", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await seedConfig(empleada.id, ["Desayuno"], "SEMANAL");
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const res = await PUT(
      putRequest([entrada()], "token-invalido"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });
});
