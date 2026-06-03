import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import { GET, POST } from "./route";

// Tests de la frontera HTTP del catálogo de items de pago adicional (Epic 3.2).
// Invocan los Route Handlers directamente con un Request construido a mano, contra
// la base SQLite real desechable (sin mocks, conventions.md §7). La empleada se
// resuelve por la costura getCurrentEmpleadaId(); como es single-tenant, basta una
// sola empleada en la base.

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/items-adicionales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getRequest(): Request {
  return new Request("http://localhost/api/v1/items-adicionales", { method: "GET" });
}

describe("API /api/v1/items-adicionales (GET, POST)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-1: GET sin items responde 200 con arreglo vacío", async () => {
    await buildEmpleadaAggregate();
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("AC-2: GET con items responde 200 con los items conformando el DTO ItemAdicional", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await db.itemAdicional.create({
      data: {
        empleadaId: empleada.id,
        nombre: "Noche acompañamiento",
        valorUnitario: 20000,
        color: "#112233",
        activo: true,
      },
    });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    const item = body[0];
    expect(typeof item.id).toBe("string");
    expect(item.nombre).toBe("Noche acompañamiento");
    expect(item.valorUnitario).toBe(20000);
    expect(item.color).toBe("#112233");
    expect(item.activo).toBe(true);
  });

  it("AC-3: POST con body válido responde 201 con el item creado y queda persistido", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({
        nombre: "Hora extra diurna",
        valorUnitario: 5000,
        color: "#FF8800",
        activo: true,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
    expect(body.nombre).toBe("Hora extra diurna");
    expect(body.valorUnitario).toBe(5000);

    const listado = await (await GET(getRequest())).json();
    expect(listado).toHaveLength(1);
    expect(listado[0].id).toBe(body.id);
  });

  it("AC-4: POST sin activo crea el item con activo=true por default", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "Bono", valorUnitario: 1000 }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.activo).toBe(true);
  });

  it("AC-10: POST con nombre vacío responde 422 VALIDACION con details", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "", valorUnitario: 1000 }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
    expect(body.details).toBeDefined();
  });

  it("AC-11: POST con valorUnitario negativo responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "X", valorUnitario: -5 }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("AC-12: POST con valorUnitario no entero responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "X", valorUnitario: 12.5 }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("AC-13: POST con valorUnitario de tipo incorrecto (string) responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "X", valorUnitario: "1000" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("AC-14: POST con JSON malformado responde 422 VALIDACION (no 500)", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(postRequest("{ esto no es json"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("EC-1: POST sin color devuelve el item con color null", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "Sin color", valorUnitario: 3000 }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.color).toBeNull();
  });

  it("EC-2: POST con color provisto lo persiste y lo devuelve tal cual", async () => {
    await buildEmpleadaAggregate();
    const res = await POST(
      postRequest({ nombre: "Con color", valorUnitario: 3000, color: "#00AAFF" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.color).toBe("#00AAFF");
  });
});
