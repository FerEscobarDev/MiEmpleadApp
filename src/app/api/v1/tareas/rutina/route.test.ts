import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP de la rutina de tareas (Epic 6.2, spec tareas-rutina-api).
// obtenerRutinaTareas (GET, ambos roles) y actualizarRutinaTareas (PUT, empleador,
// reemplazo total con validación de DiaSemana, descripcion, orden y horarios HH:mm).
// Base SQLite real desechable, sin mocks del dominio (conventions.md §7). El token
// de empleada se ejercita mockeando la lectura de sesión (patrón menu/route.test).

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { GET, PUT } from "./route";

interface RutinaInput {
  diaSemana: string;
  descripcion: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  orden: number;
}

function getRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/tareas/rutina", {
    method: "GET",
    headers,
  });
}

function putRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/tareas/rutina", {
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

function tarea(over: Partial<RutinaInput> = {}): RutinaInput {
  return {
    diaSemana: over.diaSemana ?? "LUNES",
    descripcion: over.descripcion ?? "Preparar desayuno",
    horaInicio: over.horaInicio,
    horaFin: over.horaFin,
    orden: over.orden ?? 0,
  };
}

describe("API /api/v1/tareas/rutina — obtenerRutinaTareas / actualizarRutinaTareas", () => {
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

  it("AC-1: GET con tareas sembradas devuelve 200 con el shape RutinaTarea ordenado por (diaSemana, orden)", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await db.rutinaTarea.createMany({
      data: [
        { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Segunda", orden: 1 },
        { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Primera", horaInicio: "08:00", horaFin: "09:30", orden: 0 },
        { empleadaId: empleada.id, diaSemana: "MARTES", descripcion: "Martes", orden: 0 },
      ],
    });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
    // LUNES orden 0 primero
    expect(body[0].diaSemana).toBe("LUNES");
    expect(body[0].descripcion).toBe("Primera");
    expect(body[0].orden).toBe(0);
    expect(body[0].horaInicio).toBe("08:00");
    expect(body[0].horaFin).toBe("09:30");
    expect(typeof body[0].id).toBe("string");
    expect(body[1].descripcion).toBe("Segunda");
    expect(body[2].diaSemana).toBe("MARTES");
  });

  it("AC-2: GET sin tareas devuelve 200 con []", async () => {
    await buildEmpleadaAggregate();
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("AC-3: GET con token de empleada válido responde 200 (lectura permitida)", async () => {
    await buildEmpleadaAggregate({ email: "jefeRut@example.com" });
    const token = await tokenEmpleadaValido("jefeRut@example.com");
    const res = await GET(getRequest(token));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("AC-4: PUT con arreglo válido responde 200, persiste y GET lo refleja", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest([
        tarea({ diaSemana: "LUNES", descripcion: "Con horario", horaInicio: "08:00", horaFin: "09:30", orden: 0 }),
        tarea({ diaSemana: "LUNES", descripcion: "Sin horario", orden: 1 }),
      ]),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);

    expect(await db.rutinaTarea.count()).toBe(2);

    const after = await (await GET(getRequest())).json();
    expect(after).toHaveLength(2);
    expect(after[0].descripcion).toBe("Con horario");
    expect(after[0].horaInicio).toBe("08:00");
    expect(after[1].descripcion).toBe("Sin horario");
  });

  it("AC-5: un segundo PUT reemplaza por completo la rutina previa", async () => {
    await buildEmpleadaAggregate();
    await PUT(
      putRequest([
        tarea({ diaSemana: "LUNES", orden: 0 }),
        tarea({ diaSemana: "MARTES", orden: 0 }),
        tarea({ diaSemana: "MIERCOLES", orden: 0 }),
      ]),
    );
    const res = await PUT(putRequest([tarea({ diaSemana: "VIERNES", descripcion: "Única", orden: 0 })]));
    expect(res.status).toBe(200);
    expect(await db.rutinaTarea.count()).toBe(1);
    const only = await db.rutinaTarea.findFirst();
    expect(only!.diaSemana).toBe("VIERNES");
    expect(only!.descripcion).toBe("Única");
  });

  it("AC-6: PUT con diaSemana fuera del enum responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest([tarea({ diaSemana: "LUNADES" })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-7: PUT con horaInicio de formato inválido responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    for (const mala of ["8:00", "25:00", "abc", "08:60"]) {
      const res = await PUT(putRequest([tarea({ horaInicio: mala, horaFin: "10:00" })]));
      expect(res.status).toBe(422);
      expect((await res.json()).code).toBe("VALIDACION");
    }
  });

  it("AC-8: PUT con horaInicio > horaFin responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest([tarea({ horaInicio: "10:00", horaFin: "09:00" })]),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-9 (RN-13): PUT con token de empleada responde 403 y no modifica", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeRutW@example.com" });
    await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Original", orden: 0 },
    });
    const token = await tokenEmpleadaValido("jefeRutW@example.com");

    const res = await PUT(
      putRequest([tarea({ descripcion: "Hackeado" })], token),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");

    expect(await db.rutinaTarea.count()).toBe(1);
    const only = await db.rutinaTarea.findFirst();
    expect(only!.descripcion).toBe("Original");
  });

  it("AC-10: PUT idempotente — dos PUT idénticos dejan el mismo conjunto", async () => {
    await buildEmpleadaAggregate();
    const payload = [
      tarea({ diaSemana: "LUNES", descripcion: "A", orden: 0 }),
      tarea({ diaSemana: "LUNES", descripcion: "B", orden: 1 }),
    ];
    await PUT(putRequest(payload));
    await PUT(putRequest(payload));
    expect(await db.rutinaTarea.count()).toBe(2);
    const tareas = await db.rutinaTarea.findMany({ orderBy: { orden: "asc" } });
    expect(tareas.map((t) => t.descripcion)).toEqual(["A", "B"]);
  });

  it("EC-1: PUT con body que no es array responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest({ no: "array" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-2: PUT con arreglo vacío responde 200 y borra la rutina", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "X", orden: 0 },
    });
    const res = await PUT(putRequest([]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(await db.rutinaTarea.count()).toBe(0);
  });

  it("EC-3: PUT con descripcion vacía/blanca responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest([tarea({ descripcion: "   " })]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-4: PUT con orden no entero responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest([{ diaSemana: "LUNES", descripcion: "X", orden: 1.5 }]));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-5: PUT con JSON malformado responde 422 VALIDACION (no 500)", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(putRequest("{ roto"));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-6: PUT con token de empleada inválido responde 403 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate();
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const res = await PUT(putRequest([tarea()], "token-invalido"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("EC-7: PUT con tarea que tiene solo horaInicio (sin horaFin) responde 200", async () => {
    await buildEmpleadaAggregate();
    const res = await PUT(
      putRequest([tarea({ horaInicio: "08:00", horaFin: null })]),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].horaInicio).toBe("08:00");
  });

  it("EC-8: horarios omitidos se exponen como null/omitidos sin romper el shape", async () => {
    await buildEmpleadaAggregate();
    await PUT(putRequest([tarea({ diaSemana: "MARTES", descripcion: "Sin horas", orden: 0 })]));
    const body = await (await GET(getRequest())).json();
    expect(body[0].descripcion).toBe("Sin horas");
    expect(body[0].horaInicio ?? null).toBeNull();
    expect(body[0].horaFin ?? null).toBeNull();
  });
});
