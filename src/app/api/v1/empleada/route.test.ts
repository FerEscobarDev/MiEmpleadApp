import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import { GET, PUT } from "./route";

// Tests de la frontera HTTP de la ficha de la empleada (Epic 3.1, spec empleada-api).
// Invocan los Route Handlers directamente con un Request construido a mano, contra
// la base SQLite real desechable (sin mocks, conventions.md §7). La empleada se
// resuelve por la costura getCurrentEmpleadaId(); como es single-tenant, basta una
// sola empleada en la base.

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/empleada", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getRequest(): Request {
  return new Request("http://localhost/api/v1/empleada", { method: "GET" });
}

describe("API /api/v1/empleada", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-1: GET devuelve 200 con la ficha conformando el DTO Empleada", async () => {
    await buildEmpleadaAggregate({
      nombre: "María",
      fechaNacimiento: new Date("1990-05-10"),
      fechaInicioContrato: new Date("2026-01-01"),
      fechaFinContrato: null,
    });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre).toBe("María");
    expect(body.fechaNacimiento).toBe("1990-05-10");
    expect(body.fechaInicioContrato).toBe("2026-01-01");
    expect(body.fechaFinContrato).toBeNull();
  });

  it("AC-2: GET sin ficha responde 404 con envelope EMPLEADA_NO_ENCONTRADA", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("EMPLEADA_NO_ENCONTRADA");
    expect(typeof body.message).toBe("string");
  });

  it("AC-3: PUT con body válido responde 200 y persiste (round-trip GET)", async () => {
    await buildEmpleadaAggregate({ nombre: "Original" });

    const res = await PUT(
      putRequest({
        nombre: "Actualizada",
        fechaNacimiento: "1985-03-15",
        fechaInicioContrato: "2025-06-01",
        fechaFinContrato: null,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre).toBe("Actualizada");
    expect(body.fechaNacimiento).toBe("1985-03-15");
    expect(body.fechaInicioContrato).toBe("2025-06-01");

    const after = await (await GET(getRequest())).json();
    expect(after.nombre).toBe("Actualizada");
    expect(after.fechaNacimiento).toBe("1985-03-15");
    expect(after.fechaInicioContrato).toBe("2025-06-01");
  });

  it("AC-4: PUT con nombre vacío responde 422 con envelope VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({
        nombre: "",
        fechaNacimiento: "1990-01-01",
        fechaInicioContrato: "2026-01-01",
        fechaFinContrato: null,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
    expect(body.details).toBeDefined();
  });

  it("AC-5: PUT con fecha malformada responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({
        nombre: "X",
        fechaNacimiento: "10-05-1990",
        fechaInicioContrato: "2026-01-01",
        fechaFinContrato: null,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("AC-6: PUT con fechaFinContrato provista persiste y la conserva en round-trip", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({
        nombre: "Con Fin",
        fechaNacimiento: "1990-01-01",
        fechaInicioContrato: "2026-01-01",
        fechaFinContrato: "2026-12-31",
      }),
    );
    expect(res.status).toBe(200);
    const after = await (await GET(getRequest())).json();
    expect(after.fechaFinContrato).toBe("2026-12-31");
  });

  it("EC-1: PUT con JSON malformado responde 422 VALIDACION (no 500)", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest("{ esto no es json"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("EC-2: PUT con fechaFinContrato ausente la persiste como null", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({
        nombre: "Sin Fin",
        fechaNacimiento: "1990-01-01",
        fechaInicioContrato: "2026-01-01",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fechaFinContrato).toBeNull();
  });

  it("EC-3: PUT idempotente — dos PUT con el mismo body dan el mismo resultado", async () => {
    await buildEmpleadaAggregate();
    const payload = {
      nombre: "Idempotente",
      fechaNacimiento: "1990-01-01",
      fechaInicioContrato: "2026-01-01",
      fechaFinContrato: null,
    };
    const first = await (await PUT(putRequest(payload))).json();
    const second = await (await PUT(putRequest(payload))).json();
    expect(second).toEqual(first);

    // No se creó una segunda empleada.
    const count = await db.empleada.count();
    expect(count).toBe(1);
  });
});
