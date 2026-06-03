import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";

// Tests de la frontera HTTP del histórico de cumplimiento (Epic 6.2, spec
// tareas-dia-cumplimiento-api). obtenerHistoricoTareas (GET, SOLO empleador, RN-13):
// devuelve los CumplimientoTarea de la empleada en un rango [desde, hasta] inclusive.

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { GET } from "./route";

function getRequest(desde?: string, hasta?: string, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  const params = new URLSearchParams();
  if (desde !== undefined) params.set("desde", desde);
  if (hasta !== undefined) params.set("hasta", hasta);
  const qs = params.toString();
  return new Request(
    `http://localhost/api/v1/tareas/historico${qs ? `?${qs}` : ""}`,
    { method: "GET", headers },
  );
}

async function tokenEmpleadaValido(email: string): Promise<string> {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
  const { token } = await generarEnlace(email, "http://localhost");
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
  return token;
}

async function seedCumplimiento(
  empleadaId: string,
  descripcion: string,
  fechaIso: string,
  hecha: boolean,
  orden = 0,
): Promise<void> {
  const tarea = await db.rutinaTarea.create({
    data: { empleadaId, diaSemana: "LUNES", descripcion, orden },
  });
  await db.cumplimientoTarea.create({
    data: {
      rutinaTareaId: tarea.id,
      fecha: new Date(`${fechaIso}T00:00:00.000Z`),
      hecha,
    },
  });
}

describe("API /api/v1/tareas/historico — obtenerHistoricoTareas", () => {
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

  it("AC-11: devuelve los cumplimientos en [desde, hasta] inclusive, fuera del rango excluidos", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeHist@example.com" });
    await seedCumplimiento(empleada.id, "Antes", "2026-05-31", true);
    await seedCumplimiento(empleada.id, "Inicio", "2026-06-01", true);
    await seedCumplimiento(empleada.id, "Fin", "2026-06-30", false);
    await seedCumplimiento(empleada.id, "Despues", "2026-07-01", true);
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeHist@example.com" });

    const res = await GET(getRequest("2026-06-01", "2026-06-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    const descripciones = body.map((c: { descripcion: string }) => c.descripcion);
    expect(descripciones).toContain("Inicio");
    expect(descripciones).toContain("Fin");
    expect(body[0]).toEqual(
      expect.objectContaining({
        fecha: expect.any(String),
        rutinaTareaId: expect.any(String),
        descripcion: expect.any(String),
        hecha: expect.any(Boolean),
      }),
    );
  });

  it("AC-12 (RN-13): GET con token de empleada responde 403 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate({ email: "jefeHist2@example.com" });
    const token = await tokenEmpleadaValido("jefeHist2@example.com");
    const res = await GET(getRequest("2026-06-01", "2026-06-30", token));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-13: desde/hasta malformada responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate({ email: "jefeHist3@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeHist3@example.com" });
    const r1 = await GET(getRequest("hoy", "2026-06-30"));
    expect(r1.status).toBe(422);
    expect((await r1.json()).code).toBe("VALIDACION");
    const r2 = await GET(getRequest("2026-06-01", "2026-99-99"));
    expect(r2.status).toBe(422);
  });

  it("AC-13b: desde/hasta ausente responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate({ email: "jefeHist4@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeHist4@example.com" });
    const res = await GET(getRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-13c: desde > hasta responde 422 VALIDACION", async () => {
    await buildEmpleadaAggregate({ email: "jefeHist5@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeHist5@example.com" });
    const res = await GET(getRequest("2026-06-30", "2026-06-01"));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-5: desde == hasta (un día) responde 200 con los de esa fecha", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefeHist6@example.com" });
    await seedCumplimiento(empleada.id, "EseDia", "2026-06-15", true);
    await seedCumplimiento(empleada.id, "Otro", "2026-06-16", true);
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "jefeHist6@example.com" });

    const res = await GET(getRequest("2026-06-15", "2026-06-15"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].descripcion).toBe("EseDia");
  });

  it("EC-6: cumplimientos de otra empleada no aparecen (aislamiento)", async () => {
    const a = await buildEmpleadaAggregate({ email: "aisladoA@example.com" });
    const b = await buildEmpleadaAggregate({ email: "aisladoB@example.com" });
    await seedCumplimiento(a.empleada.id, "DeA", "2026-06-10", true);
    await seedCumplimiento(b.empleada.id, "DeB", "2026-06-10", true);
    obtenerSesionEmpleadorMock.mockResolvedValue({ email: "aisladoA@example.com" });

    const body = await (await GET(getRequest("2026-06-01", "2026-06-30"))).json();
    expect(body).toHaveLength(1);
    expect(body[0].descripcion).toBe("DeA");
  });

  it("AC-9 análogo: sin identidad válida responde 401 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate({ email: "aislado401@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);
    const res = await GET(getRequest("2026-06-01", "2026-06-30", "token-invalido"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });
});
