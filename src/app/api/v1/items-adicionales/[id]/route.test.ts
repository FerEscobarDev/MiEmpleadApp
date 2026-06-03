import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import { PUT, DELETE } from "./route";
import { GET as LISTAR } from "../route";

// Tests de la frontera HTTP del item por id (Epic 3.2): actualizar y eliminar.
// La ruta dinámica [id] recibe { params } como segundo argumento (App Router).

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/items-adicionales/x", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/v1/items-adicionales/x", {
    method: "DELETE",
  });
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function listarRequest(): Request {
  return new Request("http://localhost/api/v1/items-adicionales", { method: "GET" });
}

async function crearItem(): Promise<string> {
  const { empleada } = await buildEmpleadaAggregate();
  const item = await db.itemAdicional.create({
    data: {
      empleadaId: empleada.id,
      nombre: "Original",
      valorUnitario: 10000,
      color: "#000000",
      activo: true,
    },
  });
  return item.id;
}

describe("API /api/v1/items-adicionales/{id} (PUT, DELETE)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-5: PUT con body válido sobre item existente responde 200 y persiste", async () => {
    const id = await crearItem();
    const res = await PUT(
      putRequest({
        nombre: "Actualizado",
        valorUnitario: 25000,
        color: "#ABCDEF",
        activo: true,
      }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.nombre).toBe("Actualizado");
    expect(body.valorUnitario).toBe(25000);
    expect(body.color).toBe("#ABCDEF");

    const listado = await (await LISTAR(listarRequest())).json();
    expect(listado).toHaveLength(1);
    expect(listado[0].nombre).toBe("Actualizado");
    expect(listado[0].valorUnitario).toBe(25000);
  });

  it("AC-6: PUT con id inexistente responde 404 ITEM_NO_ENCONTRADO", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest({ nombre: "X", valorUnitario: 1000 }),
      ctx("noexiste"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("ITEM_NO_ENCONTRADO");
    expect(typeof body.message).toBe("string");
  });

  it("AC-7: DELETE sobre item existente responde 204 y desaparece del listado", async () => {
    const id = await crearItem();
    const res = await DELETE(deleteRequest(), ctx(id));
    expect(res.status).toBe(204);

    const listado = await (await LISTAR(listarRequest())).json();
    expect(listado).toEqual([]);
  });

  it("AC-8: DELETE con id inexistente responde 404 ITEM_NO_ENCONTRADO", async () => {
    await buildEmpleadaAggregate();
    const res = await DELETE(deleteRequest(), ctx("noexiste"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("ITEM_NO_ENCONTRADO");
  });

  it("AC-9 (RN-09): eliminar un item usado en una liquidación NO altera el snapshot LiquidacionItem", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const item = await db.itemAdicional.create({
      data: {
        empleadaId: empleada.id,
        nombre: "Noche",
        valorUnitario: 20000,
        color: "#111111",
        activo: true,
      },
    });
    const liquidacion = await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 6, estado: "CERRADA" },
    });
    const snapshot = await db.liquidacionItem.create({
      data: {
        liquidacionId: liquidacion.id,
        itemId: item.id,
        nombre: "Noche",
        valorUnitario: 20000,
        cantidad: 3,
      },
    });

    const res = await DELETE(deleteRequest(), ctx(item.id));
    expect(res.status).toBe(204);

    const persisted = await db.liquidacionItem.findUnique({ where: { id: snapshot.id } });
    expect(persisted).not.toBeNull();
    expect(persisted?.nombre).toBe("Noche");
    expect(persisted?.valorUnitario).toBe(20000);
    expect(persisted?.cantidad).toBe(3);
    // El snapshot sobrevive; el vínculo itemId queda en null (onDelete: SetNull).
    expect(persisted?.itemId).toBeNull();
  });

  it("AC-14: PUT con JSON malformado responde 422 VALIDACION (no 500)", async () => {
    const id = await crearItem();
    const res = await PUT(putRequest("{ no es json"), ctx(id));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
  });

  it("EC-3: PUT que cambia activo a false se refleja en el listado", async () => {
    const id = await crearItem();
    const res = await PUT(
      putRequest({ nombre: "Original", valorUnitario: 10000, activo: false }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const listado = await (await LISTAR(listarRequest())).json();
    expect(listado[0].activo).toBe(false);
  });
});
