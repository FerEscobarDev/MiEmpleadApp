import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import type { DiaSemana } from "@/features/liquidacion/domain/dias-laborales";

// Tests de la frontera HTTP de eliminarLiquidacion (Epic 5.2, spec
// eliminar-liquidacion-api). DELETE /api/v1/liquidaciones/{anio}/{mes}: elimina la
// liquidación del mes (y sus novedades en cascada). 204 si existe, 404 si no. Solo
// el empleador (RN-13); la confirmación es de la UI (RN-19). Base SQLite real.

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { DELETE } from "./route";

const DIAS_LMS: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function delRequest(anio: number, mes: number, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request(`http://localhost/api/v1/liquidaciones/${anio}/${mes}`, {
    method: "DELETE",
    headers,
  });
}

function ctx(anio: number | string, mes: number | string) {
  return { params: Promise.resolve({ anio: String(anio), mes: String(mes) }) };
}

function comoEmpleador(email: string): void {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
}

async function tokenEmpleada(email: string): Promise<string> {
  obtenerSesionEmpleadorMock.mockResolvedValue({ email });
  const { token } = await generarEnlace(email, "http://localhost");
  obtenerSesionEmpleadorMock.mockResolvedValue(null);
  return token;
}

async function sembrarLiquidacion(
  empleadaId: string,
  anio: number,
  mes: number,
  estado = "BORRADOR",
): Promise<string> {
  const row = await db.liquidacion.create({
    data: {
      empleadaId,
      anio,
      mes,
      estado,
      inasistencias: { create: [{ fecha: new Date("2026-03-03T00:00:00.000Z") }] },
      items: { create: [{ nombre: "Noche", valorUnitario: 20000, cantidad: 2 }] },
      montosPuntuales: { create: [{ descripcion: "Bono", monto: 50000 }] },
    },
  });
  return row.id;
}

describe("API DELETE /api/v1/liquidaciones/[anio]/[mes] (eliminarLiquidacion)", () => {
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

  it("AC-1: eliminar un mes existente responde 204 y borra la fila", async () => {
    comoEmpleador("d1@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "d1@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await sembrarLiquidacion(empleada.id, 2026, 3);

    const res = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(204);
    expect(await db.liquidacion.count({ where: { anio: 2026, mes: 3 } })).toBe(0);
  });

  it("AC-3: eliminar borra en cascada inasistencias, items y montos", async () => {
    comoEmpleador("d3@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "d3@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await sembrarLiquidacion(empleada.id, 2026, 3);
    expect(await db.inasistencia.count()).toBe(1);
    expect(await db.liquidacionItem.count()).toBe(1);
    expect(await db.montoPuntual.count()).toBe(1);

    const res = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(204);
    expect(await db.inasistencia.count()).toBe(0);
    expect(await db.liquidacionItem.count()).toBe(0);
    expect(await db.montoPuntual.count()).toBe(0);
  });

  it("AC-4 (BR-3): eliminar un mes sin liquidación responde 404 LIQUIDACION_NO_ENCONTRADA", async () => {
    comoEmpleador("d4@example.com");
    await buildEmpleadaAggregate({
      email: "d4@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("LIQUIDACION_NO_ENCONTRADA");
  });

  it("AC-5 (BR-1): una liquidación CERRADA también se elimina (204)", async () => {
    comoEmpleador("d5@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "d5@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await sembrarLiquidacion(empleada.id, 2026, 3, "CERRADA");

    const res = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(204);
    expect(await db.liquidacion.count()).toBe(0);
  });

  it("AC-6 (rol): token de empleada responde 403 y NO borra", async () => {
    const { empleada } = await buildEmpleadaAggregate({
      email: "d6@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await sembrarLiquidacion(empleada.id, 2026, 3);
    const token = await tokenEmpleada("d6@example.com");

    const res = await DELETE(delRequest(2026, 3, token), ctx(2026, 3));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
    expect(await db.liquidacion.count()).toBe(1);
  });

  it("AC-7 (auth): sin identidad válida responde 401", async () => {
    await buildEmpleadaAggregate({
      email: "d7@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);

    const res = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-8 (validación): mes fuera de 1..12 responde 422 VALIDACION", async () => {
    comoEmpleador("d8@example.com");
    await buildEmpleadaAggregate({ email: "d8@example.com" });

    const res = await DELETE(delRequest(2026, 13), ctx(2026, 13));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-1: doble DELETE → 204 luego 404", async () => {
    comoEmpleador("e1@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "e1@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await sembrarLiquidacion(empleada.id, 2026, 3);

    const primera = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(primera.status).toBe(204);
    const segunda = await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(segunda.status).toBe(404);
  });

  it("EC-2: eliminar un mes no afecta a otros meses de la empleada", async () => {
    comoEmpleador("e2@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "e2@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await sembrarLiquidacion(empleada.id, 2026, 3);
    await sembrarLiquidacion(empleada.id, 2026, 4);

    await DELETE(delRequest(2026, 3), ctx(2026, 3));
    expect(await db.liquidacion.count({ where: { anio: 2026, mes: 4 } })).toBe(1);
    expect(await db.liquidacion.count({ where: { anio: 2026, mes: 3 } })).toBe(0);
  });
});
