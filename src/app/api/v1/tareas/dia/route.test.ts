import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP de las tareas del día (Epic 6.2, spec
// tareas-dia-cumplimiento-api). obtenerTareasDelDia (GET, ambos roles): proyecta la
// rutina del día de la semana de una fecha con su estado de cumplimiento por fecha
// exacta (default false). Base SQLite real desechable (conventions.md §7).

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { GET } from "./route";

// 2026-06-01 es LUNES (zona America/Bogotá / TZ-safe).
const LUNES = "2026-06-01";
const MARTES = "2026-06-02";

function getRequest(fecha?: string, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  const url =
    fecha === undefined
      ? "http://localhost/api/v1/tareas/dia"
      : `http://localhost/api/v1/tareas/dia?fecha=${encodeURIComponent(fecha)}`;
  return new Request(url, { method: "GET", headers });
}

async function tokenEmpleadaValido(email: string): Promise<string> {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
  const { token } = await generarEnlace(email, "http://localhost");
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
  return token;
}

describe("API /api/v1/tareas/dia — obtenerTareasDelDia", () => {
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

  it("AC-1: devuelve las tareas del día de la semana de la fecha, ordenadas por orden, sin las de otros días", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await db.rutinaTarea.createMany({
      data: [
        { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Segunda", orden: 1 },
        { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Primera", orden: 0 },
        { empleadaId: empleada.id, diaSemana: "MARTES", descripcion: "De martes", orden: 0 },
      ],
    });

    const res = await GET(getRequest(LUNES));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].descripcion).toBe("Primera");
    expect(body[1].descripcion).toBe("Segunda");
    expect(body[0]).toHaveProperty("rutinaTareaId");
    expect(body[0]).toHaveProperty("hecha");
  });

  it("AC-2: sin registro de cumplimiento, hecha es false por defecto", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    const body = await (await GET(getRequest(LUNES))).json();
    expect(body[0].hecha).toBe(false);
  });

  it("AC-3: cumplimiento por fecha exacta — true en su fecha, false en otra fecha del mismo día de semana", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    const tarea = await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    // 2026-06-08 también es LUNES; marcamos solo 2026-06-01.
    await db.cumplimientoTarea.create({
      data: { rutinaTareaId: tarea.id, fecha: new Date("2026-06-01T00:00:00.000Z"), hecha: true },
    });

    const enFecha = await (await GET(getRequest("2026-06-01"))).json();
    expect(enFecha[0].hecha).toBe(true);

    const otraFecha = await (await GET(getRequest("2026-06-08"))).json();
    expect(otraFecha[0].hecha).toBe(false);
  });

  it("AC-4: GET con token de empleada válido responde 200 (lectura permitida)", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeDia@example.com" });
    await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    const token = await tokenEmpleadaValido("jefeDia@example.com");
    const res = await GET(getRequest(LUNES, token));
    expect(res.status).toBe(200);
    expect((await res.json())).toHaveLength(1);
  });

  it("AC-5: fecha malformada responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    for (const mala of ["2026-13-40", "hoy", "2026-02-31"]) {
      const res = await GET(getRequest(mala));
      expect(res.status).toBe(422);
      expect((await res.json()).code).toBe("VALIDACION");
    }
  });

  it("AC-5b: fecha ausente responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate();
    const res = await GET(getRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-4: día sin tareas en la rutina responde 200 con []", async () => {
    const { empleada } = await buildEmpleadaAggregate();
    await db.rutinaTarea.create({
      data: { empleadaId: empleada.id, diaSemana: "LUNES", descripcion: "Tarea", orden: 0 },
    });
    const res = await GET(getRequest(MARTES));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
