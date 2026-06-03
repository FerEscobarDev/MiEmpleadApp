import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import { calcularDesglose } from "@/features/liquidacion/domain/calculo";
import type { DiaSemana } from "@/features/liquidacion/domain/dias-laborales";

// Tests de la frontera HTTP del historial de liquidaciones (Epic 5.1, spec
// listar-liquidaciones-api). Operación listarLiquidaciones: GET /api/v1/liquidaciones.
// Base SQLite real desechable, sin mocks de dominio (conventions.md §7). La sesión
// del empleador y el token de la empleada se simulan al estilo de rn13-enforcement.

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { GET } from "./route";

const DIAS_LMS: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function getRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request("http://localhost/api/v1/liquidaciones", {
    method: "GET",
    headers,
  });
}

// Autentica como empleador para el email dado (sin token de empleada).
function comoEmpleador(email: string): void {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
}

// Genera un token de empleada válido y deja la sesión de empleador en null.
async function tokenEmpleada(email: string): Promise<string> {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
  const { token } = await generarEnlace(email, "http://localhost");
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
  return token;
}

describe("API GET /api/v1/liquidaciones (listarLiquidaciones)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
    obtenerSesionEmpleadorMock.mockReset();
  });

  it("AC-1: sin liquidaciones responde 200 con []", async () => {
    comoEmpleador("jefe1@example.com");
    await buildEmpleadaAggregate({ email: "jefe1@example.com" });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("AC-2: con liquidaciones responde 200 con un LiquidacionResumen por cada una", async () => {
    comoEmpleador("jefe2@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "jefe2@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
    });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 3, estado: "BORRADOR" },
    });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 4, estado: "BORRADOR" },
    });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    for (const item of body) {
      expect(item).toHaveProperty("anio");
      expect(item).toHaveProperty("mes");
      expect(item).toHaveProperty("estado");
      expect(item).toHaveProperty("total");
      expect(typeof item.total).toBe("number");
    }
  });

  it("AC-3 (RN-08): el total refleja el desglose calculado en vivo con novedades", async () => {
    comoEmpleador("jefe3@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "jefe3@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    // Liquidación de marzo 2026 con una inasistencia válida (lunes 2026-03-02) y
    // un item (2 × 20000) y un monto puntual (50000).
    await db.liquidacion.create({
      data: {
        empleadaId: empleada.id,
        anio: 2026,
        mes: 3,
        estado: "BORRADOR",
        inasistencias: { create: [{ fecha: new Date("2026-03-02T00:00:00.000Z") }] },
        items: {
          create: [{ nombre: "Noche", valorUnitario: 20000, cantidad: 2 }],
        },
        montosPuntuales: { create: [{ descripcion: "Bono", monto: 50000 }] },
      },
    });

    const esperado = calcularDesglose({
      year: 2026,
      month: 3,
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: "2026-01-01",
      fechaFinContrato: null,
      festivos: [],
      inasistencias: ["2026-03-02"],
      items: [{ valorUnitario: 20000, cantidad: 2 }],
      montosPuntuales: [{ monto: 50000 }],
    });

    const res = await GET(getRequest());
    const body = await res.json();
    const marzo = body.find((l: { mes: number }) => l.mes === 3);
    expect(marzo).toBeDefined();
    expect(marzo.total).toBe(esperado.total);
  });

  it("AC-4: el listado viene ordenado por (anio, mes) descendente", async () => {
    comoEmpleador("jefe4@example.com");
    const { empleada } = await buildEmpleadaAggregate({ email: "jefe4@example.com" });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2025, mes: 11, estado: "BORRADOR" },
    });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 2, estado: "BORRADOR" },
    });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 1, estado: "BORRADOR" },
    });

    const res = await GET(getRequest());
    const body = await res.json();
    const claves = body.map((l: { anio: number; mes: number }) => `${l.anio}-${l.mes}`);
    expect(claves).toEqual(["2026-2", "2026-1", "2025-11"]);
  });

  it("AC-5: petición autenticada como empleador responde 200", async () => {
    comoEmpleador("jefe5@example.com");
    await buildEmpleadaAggregate({ email: "jefe5@example.com" });

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
  });

  it("AC-6: petición como empleada (token válido) responde 200 con el historial", async () => {
    const { empleada } = await buildEmpleadaAggregate({ email: "jefe6@example.com" });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 5, estado: "BORRADOR" },
    });
    const token = await tokenEmpleada("jefe6@example.com");

    const res = await GET(getRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].mes).toBe(5);
  });

  it("AC-7: sin sesión y con token inválido responde 401 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate({ email: "jefe7@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);

    const res = await GET(getRequest("token-invalido"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("NO_AUTORIZADO");
  });

  it("EC-1: una liquidación sin novedades reporta total = subtotal por días (no undefined)", async () => {
    comoEmpleador("jefe8@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "jefe8@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 3, estado: "BORRADOR" },
    });

    const esperado = calcularDesglose({
      year: 2026,
      month: 3,
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: "2026-01-01",
      fechaFinContrato: null,
      festivos: [],
      inasistencias: [],
      items: [],
      montosPuntuales: [],
    });

    const res = await GET(getRequest());
    const body = await res.json();
    expect(body[0].total).toBe(esperado.total);
    expect(body[0].total).toBeGreaterThan(0);
  });

  it("EC-2: el listado solo contiene liquidaciones de la empleada actual", async () => {
    comoEmpleador("jefe9@example.com");
    const propia = await buildEmpleadaAggregate({ email: "jefe9@example.com" });
    const ajena = await buildEmpleadaAggregate({ email: "otro@example.com" });
    await db.liquidacion.create({
      data: { empleadaId: propia.empleada.id, anio: 2026, mes: 6, estado: "BORRADOR" },
    });
    await db.liquidacion.create({
      data: { empleadaId: ajena.empleada.id, anio: 2026, mes: 7, estado: "BORRADOR" },
    });

    const res = await GET(getRequest());
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].mes).toBe(6);
  });
});
