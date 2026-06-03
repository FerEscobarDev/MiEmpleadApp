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

// Tests de la frontera HTTP de actualizarLiquidacion (Epic 5.1, spec
// actualizar-liquidacion-api). PUT /api/v1/liquidaciones/{anio}/{mes}: reemplaza
// novedades y recalcula en vivo. Solo el empleador escribe (RN-13); valida
// inasistencias (RN-05) y rechaza editar una liquidación CERRADA (RN-11). Base
// SQLite real, sin mocks de dominio.

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { PUT } from "./route";

const DIAS_LMS: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function putRequest(
  anio: number,
  mes: number,
  body: unknown,
  token?: string,
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request(`http://localhost/api/v1/liquidaciones/${anio}/${mes}`, {
    method: "PUT",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(anio: number, mes: number) {
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

describe("API PUT /api/v1/liquidaciones/[anio]/[mes] (actualizarLiquidacion)", () => {
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

  it("AC-1: persiste inasistencias válidas y baja diasTrabajados (RN-04)", async () => {
    comoEmpleador("u1@example.com");
    await buildEmpleadaAggregate({
      email: "u1@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    // 2026-03-03 es martes (día laboral, no festivo, en contrato).
    const res = await PUT(
      putRequest(2026, 3, { inasistencias: ["2026-03-03"] }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inasistencias).toContain("2026-03-03");
    const diaInasistencia = body.calendario.find(
      (d: { fecha: string }) => d.fecha === "2026-03-03",
    );
    expect(diaInasistencia.tipo).toBe("INASISTENCIA");
    expect(await db.inasistencia.count()).toBe(1);
  });

  it("AC-2: persiste items resolviendo nombre/valor del catálogo y recalcula (RN-08)", async () => {
    comoEmpleador("u2@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "u2@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    const item = await db.itemAdicional.create({
      data: {
        empleadaId: empleada.id,
        nombre: "Noche acompañamiento",
        valorUnitario: 20000,
        color: "",
        activo: true,
      },
    });

    const res = await PUT(
      putRequest(2026, 3, { items: [{ itemId: item.id, cantidad: 2 }] }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].nombre).toBe("Noche acompañamiento");
    expect(body.items[0].valorUnitario).toBe(20000);
    expect(body.items[0].subtotal).toBe(40000);
    expect(body.desglose.subtotalItems).toBe(40000);
  });

  it("AC-3: persiste montos puntuales y los suma al total (RN-08)", async () => {
    comoEmpleador("u3@example.com");
    await buildEmpleadaAggregate({
      email: "u3@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await PUT(
      putRequest(2026, 3, {
        montosPuntuales: [{ descripcion: "Bono", monto: 50000 }],
      }),
      ctx(2026, 3),
    );
    const body = await res.json();
    expect(body.montosPuntuales[0].monto).toBe(50000);
    expect(body.desglose.subtotalMontosPuntuales).toBe(50000);
  });

  it("AC-4: persiste notas y las devuelve", async () => {
    comoEmpleador("u4@example.com");
    await buildEmpleadaAggregate({
      email: "u4@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await PUT(
      putRequest(2026, 3, { notas: "Pagar el día 5" }),
      ctx(2026, 3),
    );
    const body = await res.json();
    expect(body.notas).toBe("Pagar el día 5");
  });

  it("AC-5: el total combina inasistencias + items + montos (RN-08)", async () => {
    comoEmpleador("u5@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "u5@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    const item = await db.itemAdicional.create({
      data: {
        empleadaId: empleada.id,
        nombre: "Noche",
        valorUnitario: 20000,
        color: "",
        activo: true,
      },
    });

    const res = await PUT(
      putRequest(2026, 3, {
        inasistencias: ["2026-03-03"],
        items: [{ itemId: item.id, cantidad: 2 }],
        montosPuntuales: [{ descripcion: "Bono", monto: 50000 }],
      }),
      ctx(2026, 3),
    );
    const body = await res.json();

    const esperado = calcularDesglose({
      year: 2026,
      month: 3,
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: "2026-01-01",
      fechaFinContrato: null,
      festivos: [],
      inasistencias: ["2026-03-03"],
      items: [{ valorUnitario: 20000, cantidad: 2 }],
      montosPuntuales: [{ monto: 50000 }],
    });
    expect(body.desglose.total).toBe(esperado.total);
  });

  it("AC-6: inasistencia en día NO laboral responde 409 INASISTENCIA_INVALIDA sin persistir", async () => {
    comoEmpleador("u6@example.com");
    await buildEmpleadaAggregate({
      email: "u6@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    // 2026-03-01 es domingo (no laboral).
    const res = await PUT(
      putRequest(2026, 3, { inasistencias: ["2026-03-01"] }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("INASISTENCIA_INVALIDA");
    expect(await db.inasistencia.count()).toBe(0);
  });

  it("AC-7: editar una liquidación CERRADA responde 409 LIQUIDACION_CERRADA", async () => {
    comoEmpleador("u7@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "u7@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await db.liquidacion.create({
      data: { empleadaId: empleada.id, anio: 2026, mes: 3, estado: "CERRADA" },
    });

    const res = await PUT(
      putRequest(2026, 3, { notas: "intento" }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LIQUIDACION_CERRADA");
  });

  it("AC-8: cantidad negativa responde 422 VALIDACION", async () => {
    comoEmpleador("u8@example.com");
    await buildEmpleadaAggregate({
      email: "u8@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await PUT(
      putRequest(2026, 3, { items: [{ itemId: "x", cantidad: -1 }] }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("AC-9: token de empleada responde 403 NO_AUTORIZADO sin modificar", async () => {
    await buildEmpleadaAggregate({
      email: "u9@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });
    const token = await tokenEmpleada("u9@example.com");

    const res = await PUT(
      putRequest(2026, 3, { notas: "hack" }, token),
      ctx(2026, 3),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
    expect(await db.liquidacion.count()).toBe(0);
  });

  it("AC-10: dos PUT con el mismo body dejan el mismo estado (idempotente, sin duplicar)", async () => {
    comoEmpleador("u10@example.com");
    await buildEmpleadaAggregate({
      email: "u10@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    const body = { inasistencias: ["2026-03-03"] };

    const first = await (await PUT(putRequest(2026, 3, body), ctx(2026, 3))).json();
    const second = await (await PUT(putRequest(2026, 3, body), ctx(2026, 3))).json();
    expect(second.inasistencias).toEqual(first.inasistencias);
    expect(await db.inasistencia.count()).toBe(1);
    expect(await db.liquidacion.count()).toBe(1);
  });

  it("AC-11: un segundo PUT con inasistencias distintas reemplaza el conjunto", async () => {
    comoEmpleador("u11@example.com");
    await buildEmpleadaAggregate({
      email: "u11@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await PUT(putRequest(2026, 3, { inasistencias: ["2026-03-03"] }), ctx(2026, 3));
    const res = await PUT(
      putRequest(2026, 3, { inasistencias: ["2026-03-04"] }),
      ctx(2026, 3),
    );
    const body = await res.json();
    expect(body.inasistencias).toEqual(["2026-03-04"]);
    expect(await db.inasistencia.count()).toBe(1);
  });

  it("AC-12: mes fuera de contrato responde 409 MES_FUERA_DE_CONTRATO", async () => {
    comoEmpleador("u12@example.com");
    await buildEmpleadaAggregate({
      email: "u12@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-06-01"),
    });

    const res = await PUT(
      putRequest(2026, 1, { notas: "x" }),
      ctx(2026, 1),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("MES_FUERA_DE_CONTRATO");
  });

  it("AC-13: JSON malformado responde 422 VALIDACION (no 500)", async () => {
    comoEmpleador("u13@example.com");
    await buildEmpleadaAggregate({
      email: "u13@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await PUT(putRequest(2026, 3, "{ roto"), ctx(2026, 3));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDACION");
  });

  it("EC-1: un PUT solo con notas no borra inasistencias previas", async () => {
    comoEmpleador("ec1@example.com");
    await buildEmpleadaAggregate({
      email: "ec1@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await PUT(putRequest(2026, 3, { inasistencias: ["2026-03-03"] }), ctx(2026, 3));
    const res = await PUT(putRequest(2026, 3, { notas: "solo nota" }), ctx(2026, 3));
    const body = await res.json();
    expect(body.inasistencias).toContain("2026-03-03");
    expect(body.notas).toBe("solo nota");
  });

  it("EC-2: inasistencias duplicadas se cuentan una sola vez", async () => {
    comoEmpleador("ec2@example.com");
    await buildEmpleadaAggregate({
      email: "ec2@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await PUT(
      putRequest(2026, 3, { inasistencias: ["2026-03-03", "2026-03-03"] }),
      ctx(2026, 3),
    );
    const body = await res.json();
    expect(body.inasistencias).toEqual(["2026-03-03"]);
    expect(await db.inasistencia.count()).toBe(1);
  });

  it("EC-5: inasistencias [] limpia la categoría", async () => {
    comoEmpleador("ec5@example.com");
    await buildEmpleadaAggregate({
      email: "ec5@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await PUT(putRequest(2026, 3, { inasistencias: ["2026-03-03"] }), ctx(2026, 3));
    const res = await PUT(putRequest(2026, 3, { inasistencias: [] }), ctx(2026, 3));
    const body = await res.json();
    expect(body.inasistencias).toEqual([]);
    expect(await db.inasistencia.count()).toBe(0);
  });
});
