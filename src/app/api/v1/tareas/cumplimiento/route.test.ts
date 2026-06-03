import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP del marcado de cumplimiento (Epic 6.2, spec
// tareas-dia-cumplimiento-api). marcarTarea (PUT, AMBOS roles — única escritura de
// la empleada, RN-13): upsert por (rutinaTareaId, fecha); 404 si la tarea no
// pertenece a la empleada; 401 si no hay identidad; 422 entrada inválida.

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { PUT } from "./route";

const FECHA = "2026-06-01";

function putRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/tareas/cumplimiento", {
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

describe("API /api/v1/tareas/cumplimiento — marcarTarea", () => {
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

  it("AC-6: PUT válido responde 200 con CumplimientoTarea y persiste", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeAc6@example.com" });
    const tarea = await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Desayuno", orden: 0 },
    });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeAc6@example.com" });

    const res = await PUT(
      putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      fecha: FECHA,
      rutinaTareaId: tarea.id,
      descripcion: "Desayuno",
      hecha: true,
    });
    expect(await db.cumplimientoTarea.count()).toBe(1);
  });

  it("AC-7 (RN-13): tanto el empleador (sesión) como la empleada (token) pueden marcar", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeMarca@example.com" });
    const tarea = await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });

    // Empleador: con sesión, sin token.
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeMarca@example.com" });
    const resEmpleador = await PUT(
      putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: true }),
    );
    expect(resEmpleador.status).toBe(200);

    // Empleada: token válido, sin sesión.
    const token = await tokenEmpleadaValido("jefeMarca@example.com");
    const resEmpleada = await PUT(
      putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: false }, token),
    );
    expect(resEmpleada.status).toBe(200);
    expect((await resEmpleada.json()).hecha).toBe(false);
  });

  it("AC-8 (BR-3): marcar una tarea que no pertenece a la empleada responde 404", async () => {
    // Empleada del contexto (sin sesión → fallback a la primera empleada creada).
    await buildEmpleadaAggregate({ email: "duenoA@example.com" });
    // Otra empleada con su propia tarea.
    const otra = await buildEmpleadaAggregate({ email: "duenoB@example.com" });
    const tareaAjena = await db.rutinaTarea.create({
      data: { empleadaId: otra.empleada.id, diaSemana: "LUNES", descripcion: "Ajena", orden: 0 },
    });

    // Contexto: empleador A (su sesión).
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "duenoA@example.com" });
    const res = await PUT(
      putRequest({ fecha: FECHA, rutinaTareaId: tareaAjena.id, hecha: true }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NO_ENCONTRADO");
    expect(await db.cumplimientoTarea.count()).toBe(0);
  });

  it("AC-8b: marcar un rutinaTareaId inexistente responde 404", async () => {
    await buildEmpleadaAggregate({ email: "duenoX@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "duenoX@example.com" });
    const res = await PUT(
      putRequest({ fecha: FECHA, rutinaTareaId: "no-existe", hecha: true }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NO_ENCONTRADO");
  });

  it("AC-9 (BR-5): sin identidad válida responde 401 NO_AUTORIZADO", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const tarea = await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    // Sin sesión y con token inválido.
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const res = await PUT(
      putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: true }, "token-invalido"),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-10: upsert idempotente y alternable — un solo registro por (tarea, fecha)", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeUpsert@example.com" });
    const tarea = await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeUpsert@example.com" });

    await PUT(putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: true }));
    await PUT(putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: true }));
    expect(await db.cumplimientoTarea.count()).toBe(1);

    const res = await PUT(putRequest({ fecha: FECHA, rutinaTareaId: tarea.id, hecha: false }));
    expect((await res.json()).hecha).toBe(false);
    expect(await db.cumplimientoTarea.count()).toBe(1);
    const only = await db.cumplimientoTarea.findFirst();
    expect(only!.hecha).toBe(false);
  });

  it("EC-1: fecha malformada responde 422 VALIDACION", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeEc1@example.com" });
    const tarea = await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeEc1@example.com" });
    const res = await PUT(
      putRequest({ fecha: "2026-99-99", rutinaTareaId: tarea.id, hecha: true }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-2: hecha no booleano / rutinaTareaId ausente responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate({ email: "jefeEc2@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeEc2@example.com" });

    const r1 = await PUT(putRequest({ fecha: FECHA, rutinaTareaId: "x", hecha: "si" }));
    expect(r1.status).toBe(422);
    expect((await r1.json()).code).toBe("VALIDACION");

    const r2 = await PUT(putRequest({ fecha: FECHA, hecha: true }));
    expect(r2.status).toBe(422);
    expect((await r2.json()).code).toBe("VALIDACION");
  });

  it("EC-3: JSON malformado responde 422 VALIDACION (no 500)", async () => {
    await buildEmpleadaAggregate({ email: "jefeEc3@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeEc3@example.com" });
    const res = await PUT(putRequest("{ roto"));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });
});
