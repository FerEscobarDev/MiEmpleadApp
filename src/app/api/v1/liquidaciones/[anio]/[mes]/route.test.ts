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

// Tests de la frontera HTTP de obtenerLiquidacion (Epic 5.1, spec
// obtener-liquidacion-api). GET /api/v1/liquidaciones/{anio}/{mes}: obtiene o
// inicializa el borrador con desglose + calendario. Base SQLite real, sin mocks de
// dominio. Sesión/token al estilo de rn13-enforcement.

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

function getRequest(anio: number, mes: number, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request(`http://localhost/api/v1/liquidaciones/${anio}/${mes}`, {
    method: "GET",
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

describe("API GET /api/v1/liquidaciones/[anio]/[mes] (obtenerLiquidacion)", () => {
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

  it("AC-1: mes normal sin novedades devuelve 200 BORRADOR con desglose y calendario", async () => {
    comoEmpleador("a1@example.com");
    await buildEmpleadaAggregate({
      email: "a1@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe("BORRADOR");
    expect(body.desglose.total).toBe(body.desglose.subtotalDias);
    // Un elemento de calendario por día de marzo (31 días).
    expect(body.calendario).toHaveLength(31);
  });

  it("AC-2: el desglose coincide campo a campo con calcularDesglose", async () => {
    comoEmpleador("a2@example.com");
    await buildEmpleadaAggregate({
      email: "a2@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const { getHolidaysInMonth } = await import(
      "@/features/liquidacion/domain/festivos"
    );
    const esperado = calcularDesglose({
      year: 2026,
      month: 3,
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: "2026-01-01",
      fechaFinContrato: null,
      festivos: getHolidaysInMonth(2026, 3),
      inasistencias: [],
      items: [],
      montosPuntuales: [],
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    const body = await res.json();
    expect(body.desglose).toEqual(esperado);
  });

  it("AC-3 (RN-06): mes de inicio parcial marca días previos FUERA_CONTRATO", async () => {
    comoEmpleador("a3@example.com");
    await buildEmpleadaAggregate({
      email: "a3@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-03-16"),
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    const body = await res.json();
    expect(res.status).toBe(200);
    const dia1 = body.calendario.find((d: { fecha: string }) => d.fecha === "2026-03-02");
    expect(dia1.tipo).toBe("FUERA_CONTRATO");
    // El denominador es el mes completo; los días trabajados solo desde el 16.
    const esperado = calcularDesglose({
      year: 2026,
      month: 3,
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: "2026-03-16",
      fechaFinContrato: null,
      festivos: [],
      inasistencias: [],
      items: [],
      montosPuntuales: [],
    });
    expect(body.desglose.diasTrabajados).toBe(esperado.diasTrabajados);
    expect(body.desglose.diasLaboralesMes).toBe(esperado.diasLaboralesMes);
  });

  it("AC-4 (RN-07): mes de fin parcial marca días posteriores FUERA_CONTRATO", async () => {
    comoEmpleador("a4@example.com");
    await buildEmpleadaAggregate({
      email: "a4@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
      fechaFinContrato: new Date("2026-03-15"),
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    const body = await res.json();
    const dia20 = body.calendario.find(
      (d: { fecha: string }) => d.fecha === "2026-03-20",
    );
    expect(dia20.tipo).toBe("FUERA_CONTRATO");
  });

  it("AC-5 (RN-10): obtener un mes sin liquidación crea exactamente una fila", async () => {
    comoEmpleador("a5@example.com");
    await buildEmpleadaAggregate({
      email: "a5@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });
    expect(await db.liquidacion.count()).toBe(0);

    await GET(getRequest(2026, 3), ctx(2026, 3));
    expect(await db.liquidacion.count()).toBe(1);
  });

  it("AC-6 (RN-10): obtener el mismo mes dos veces deja una sola fila", async () => {
    comoEmpleador("a6@example.com");
    await buildEmpleadaAggregate({
      email: "a6@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await GET(getRequest(2026, 3), ctx(2026, 3));
    await GET(getRequest(2026, 3), ctx(2026, 3));
    expect(await db.liquidacion.count()).toBe(1);
  });

  it("AC-7: una liquidación con novedades devuelve inasistencias, items y montos", async () => {
    comoEmpleador("a7@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "a7@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await db.liquidacion.create({
      data: {
        empleadaId: empleada.id,
        anio: 2026,
        mes: 3,
        estado: "BORRADOR",
        inasistencias: { create: [{ fecha: new Date("2026-03-03T00:00:00.000Z") }] },
        items: { create: [{ nombre: "Noche", valorUnitario: 20000, cantidad: 3 }] },
        montosPuntuales: { create: [{ descripcion: "Bono", monto: 50000 }] },
      },
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    const body = await res.json();
    expect(body.inasistencias).toContain("2026-03-03");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].subtotal).toBe(60000);
    expect(body.montosPuntuales[0].monto).toBe(50000);
    expect(body.desglose.subtotalItems).toBe(60000);
    expect(body.desglose.subtotalMontosPuntuales).toBe(50000);
  });

  it("AC-8: mes anterior al inicio de contrato responde 409 MES_FUERA_DE_CONTRATO sin crear fila", async () => {
    comoEmpleador("a8@example.com");
    await buildEmpleadaAggregate({
      email: "a8@example.com",
      fechaInicioContrato: new Date("2026-06-01"),
    });

    const res = await GET(getRequest(2026, 1), ctx(2026, 1));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("MES_FUERA_DE_CONTRATO");
    expect(await db.liquidacion.count()).toBe(0);
  });

  it("AC-9 (RN-12): la empleada NO ve las notas", async () => {
    const { empleada } = await buildEmpleadaAggregate({
      email: "a9@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await db.liquidacion.create({
      data: {
        empleadaId: empleada.id,
        anio: 2026,
        mes: 3,
        estado: "BORRADOR",
        notas: "Secreto del empleador",
      },
    });
    const token = await tokenEmpleada("a9@example.com");

    const res = await GET(getRequest(2026, 3, token), ctx(2026, 3));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("notas");
  });

  it("AC-10 (RN-12): el empleador SÍ ve las notas", async () => {
    comoEmpleador("a10@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "a10@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await db.liquidacion.create({
      data: {
        empleadaId: empleada.id,
        anio: 2026,
        mes: 3,
        estado: "BORRADOR",
        notas: "Secreto del empleador",
      },
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    const body = await res.json();
    expect(body.notas).toBe("Secreto del empleador");
  });

  it("AC-11: mes fuera de 1..12 responde 422 VALIDACION", async () => {
    comoEmpleador("a11@example.com");
    await buildEmpleadaAggregate({ email: "a11@example.com" });

    const res = await GET(getRequest(2026, 13), ctx(2026, 13));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-12: sin sesión y token inválido responde 401 NO_AUTORIZADO", async () => {
    await buildEmpleadaAggregate({ email: "a12@example.com" });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);

    const res = await GET(getRequest(2026, 3, "token-malo"), ctx(2026, 3));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("EC-1: inicio y fin en el mismo mes es liquidable (200, no 409)", async () => {
    comoEmpleador("e1@example.com");
    await buildEmpleadaAggregate({
      email: "e1@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-03-05"),
      fechaFinContrato: new Date("2026-03-20"),
    });

    const res = await GET(getRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(200);
  });

  it("EC-3 (RN-03): festivo en día laboral aparece FESTIVO y no se descuenta", async () => {
    comoEmpleador("e3@example.com");
    await buildEmpleadaAggregate({
      email: "e3@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    // 2026-01-01 (Año Nuevo) es festivo; jueves, día laboral.
    const res = await GET(getRequest(2026, 1), ctx(2026, 1));
    const body = await res.json();
    const diaFestivo = body.calendario.find(
      (d: { fecha: string }) => d.fecha === "2026-01-01",
    );
    expect(diaFestivo.tipo).toBe("FESTIVO");
    expect(body.desglose.festivosEnDiaLaboral).toBeGreaterThanOrEqual(1);
  });
});
