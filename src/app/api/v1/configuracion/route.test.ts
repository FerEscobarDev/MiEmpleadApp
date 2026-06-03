import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import { GET, PUT } from "./route";

// Tests de la frontera HTTP de la configuración (Epic 3.1, spec configuracion-api).
// Base SQLite real desechable, sin mocks (conventions.md §7). La empleada se resuelve
// por la costura getCurrentEmpleadaId() (single-tenant).

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/configuracion", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getRequest(): Request {
  return new Request("http://localhost/api/v1/configuracion", { method: "GET" });
}

// Crea una empleada SIN fila de configuración (para AC-2 / RN-18 default).
async function buildEmpleadaSinConfiguracion(): Promise<void> {
  await db.empleador.create({
    data: {
      email: `sinconfig-${Date.now()}@example.com`,
      passwordHash: "hash",
      empleada: {
        create: {
          nombre: "Sin Config",
          fechaNacimiento: new Date("1990-01-01"),
          fechaInicioContrato: new Date("2026-01-01"),
        },
      },
    },
  });
}

describe("API /api/v1/configuracion", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-1: GET devuelve 200 con la configuración conformando el DTO", async () => {
    await buildEmpleadaAggregate({
      salarioBase: 800000,
      diasLaborales: ["LUNES", "MARTES", "MIERCOLES"],
    });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.salarioBase).toBe(800000);
    expect(body.diasLaborales).toEqual(["LUNES", "MARTES", "MIERCOLES"]);
  });

  it("AC-2 (RN-18): GET sin configuración devuelve default salario 700000 y dias []", async () => {
    await buildEmpleadaSinConfiguracion();

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.salarioBase).toBe(700000);
    expect(body.diasLaborales).toEqual([]);

    // No se materializó una fila de configuración por leer el default.
    const count = await db.configuracion.count();
    expect(count).toBe(0);
  });

  it("AC-3: PUT con body válido responde 200 y persiste (round-trip GET)", async () => {
    await buildEmpleadaAggregate();

    const res = await PUT(
      putRequest({
        salarioBase: 950000,
        diasLaborales: ["LUNES", "VIERNES", "SABADO"],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.salarioBase).toBe(950000);
    expect(body.diasLaborales).toEqual(["LUNES", "VIERNES", "SABADO"]);

    const after = await (await GET(getRequest())).json();
    expect(after.salarioBase).toBe(950000);
    expect(after.diasLaborales).toEqual(["LUNES", "VIERNES", "SABADO"]);
  });

  it("AC-4: PUT con DiaSemana inválido responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({ salarioBase: 700000, diasLaborales: ["LUNES", "FUNES"] }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
    expect(body.details).toBeDefined();
  });

  it("AC-5: PUT con salarioBase negativo responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({ salarioBase: -100, diasLaborales: ["LUNES"] }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("AC-6: PUT con salarioBase no entero responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({ salarioBase: 700000.5, diasLaborales: ["LUNES"] }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("EC-1: PUT con JSON malformado responde 422 VALIDACION (no 500)", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest("{ roto"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("EC-2: PUT con diasLaborales vacío es válido (200) y persiste []", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest({ salarioBase: 700000, diasLaborales: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.diasLaborales).toEqual([]);
  });

  it("EC-3: PUT idempotente — dos PUT con el mismo body dan el mismo resultado", async () => {
    await buildEmpleadaAggregate();
    const payload = { salarioBase: 720000, diasLaborales: ["LUNES", "MARTES"] };
    const first = await (await PUT(putRequest(payload))).json();
    const second = await (await PUT(putRequest(payload))).json();
    expect(second).toEqual(first);

    const count = await db.configuracion.count();
    expect(count).toBe(1);
  });

  it("EC-4: PUT con salarioBase ausente responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest({ diasLaborales: ["LUNES"] }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });
});
