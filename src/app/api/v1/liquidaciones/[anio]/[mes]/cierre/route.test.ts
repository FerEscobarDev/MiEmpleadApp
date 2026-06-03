import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { buildEmpleadaAggregate } from "@/lib/test/factories";
import { db } from "@/lib/db";
import type { DiaSemana } from "@/features/liquidacion/domain/dias-laborales";

// Tests de la frontera HTTP de cerrarLiquidacion y reabrirLiquidacion (Epic 5.2,
// spec cerrar-reabrir-liquidacion-api). El núcleo del epic es RN-09: al cerrar se
// congelan salario, días laborales y valores de items; leer luego el mes cerrado
// usa los valores CONGELADOS, no la configuración vigente. Reabrir vuelve a
// BORRADOR (cálculo en vivo). Solo el empleador (RN-13). Base SQLite real, sin
// mocks de dominio. Patrón de sesión/token como en route.test.ts y actualizar.test.ts.

const obtenerSesionEmpleadorMock = vi.fn();
vi.mock("@/features/auth/application/session-reader", () => ({
  obtenerSesionEmpleador: () => obtenerSesionEmpleadorMock(),
}));

import { generarEnlace } from "@/features/auth/application/acceso-service";
import { POST as CERRAR } from "./route";
import { POST as REABRIR } from "../reapertura/route";
import { GET as OBTENER, PUT as ACTUALIZAR } from "../route";

const DIAS_LMS: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function postRequest(anio: number, mes: number, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["X-Acceso-Token"] = token;
  }
  return new Request(
    `http://localhost/api/v1/liquidaciones/${anio}/${mes}/cierre`,
    { method: "POST", headers },
  );
}

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

function putRequest(anio: number, mes: number, body: unknown): Request {
  return new Request(`http://localhost/api/v1/liquidaciones/${anio}/${mes}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

async function obtenerBody(
  empleadaEmail: string,
  anio: number,
  mes: number,
): Promise<Record<string, unknown>> {
  comoEmpleador(empleadaEmail);
  const res = await OBTENER(getRequest(anio, mes), ctx(anio, mes));
  return res.json();
}

describe("API POST /api/v1/liquidaciones/[anio]/[mes]/cierre + /reapertura", () => {
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

  it("AC-1: cerrar un borrador responde 200 CERRADA y persiste los campos congelados", async () => {
    comoEmpleador("c1@example.com");
    await buildEmpleadaAggregate({
      email: "c1@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const res = await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe("CERRADA");

    const row = await db.liquidacion.findFirst({ where: { anio: 2026, mes: 3 } });
    expect(row?.salarioBaseCongelado).not.toBeNull();
    expect(row?.diasLaboralesCongelado).not.toBeNull();
    expect(row?.totalCongelado).not.toBeNull();
    expect(row?.totalCongelado).toBe(body.desglose.total);
  });

  it("AC-2 (RN-09): cambiar el salario tras cerrar NO altera el mes cerrado", async () => {
    comoEmpleador("c2@example.com");
    const { configuracion } = await buildEmpleadaAggregate({
      email: "c2@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const cerrada = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();
    const desgloseAlCerrar = cerrada.desglose;

    // Cambiar el salario en la configuración vigente.
    await db.configuracion.update({
      where: { id: configuracion.id },
      data: { salarioBase: 1400000 },
    });

    const leida = await obtenerBody("c2@example.com", 2026, 3);
    expect(leida.estado).toBe("CERRADA");
    expect(leida.desglose).toEqual(desgloseAlCerrar);
    expect((leida.desglose as { valorDia: number }).valorDia).toBe(
      desgloseAlCerrar.valorDia,
    );
  });

  it("AC-3 (RN-09): cambiar los días laborales tras cerrar NO altera el mes cerrado", async () => {
    comoEmpleador("c3@example.com");
    const { configuracion } = await buildEmpleadaAggregate({
      email: "c3@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const cerrada = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();
    const diasLaboralesMesAlCerrar = cerrada.desglose.diasLaboralesMes;

    // Pasar a L–V (quita el sábado): cambia el denominador en vivo.
    await db.configuracion.update({
      where: { id: configuracion.id },
      data: {
        diasLaborales: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
      },
    });

    const leida = await obtenerBody("c3@example.com", 2026, 3);
    expect(leida.desglose).toEqual(cerrada.desglose);
    expect((leida.desglose as { diasLaboralesMes: number }).diasLaboralesMes).toBe(
      diasLaboralesMesAlCerrar,
    );
  });

  it("AC-4 (RN-09): cambiar el valor de un item del catálogo tras cerrar NO altera el subtotal congelado", async () => {
    comoEmpleador("c4@example.com");
    const { empleada } = await buildEmpleadaAggregate({
      email: "c4@example.com",
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
    // Registrar el item en el borrador vía PUT (snapshot persistido).
    await ACTUALIZAR(
      putRequest(2026, 3, { items: [{ itemId: item.id, cantidad: 2 }] }),
      ctx(2026, 3),
    );

    const cerrada = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();
    expect(cerrada.desglose.subtotalItems).toBe(40000);

    // Cambiar el valor del item en el catálogo.
    await db.itemAdicional.update({
      where: { id: item.id },
      data: { valorUnitario: 99000 },
    });

    const leida = await obtenerBody("c4@example.com", 2026, 3);
    expect((leida.desglose as { subtotalItems: number }).subtotalItems).toBe(40000);
    expect((leida.items as { valorUnitario: number }[])[0].valorUnitario).toBe(20000);
  });

  it("AC-5 (BR-2): cerrar dos veces responde 409 LIQUIDACION_CERRADA", async () => {
    comoEmpleador("c5@example.com");
    await buildEmpleadaAggregate({
      email: "c5@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    const res = await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LIQUIDACION_CERRADA");
  });

  it("AC-6 (RN-11): reabrir una cerrada responde 200 BORRADOR", async () => {
    comoEmpleador("c6@example.com");
    await buildEmpleadaAggregate({
      email: "c6@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    const res = await REABRIR(postRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe("BORRADOR");

    const row = await db.liquidacion.findFirst({ where: { anio: 2026, mes: 3 } });
    expect(row?.estado).toBe("BORRADOR");
  });

  it("AC-7 (BR-2): reabrir una que ya está en borrador responde 409 LIQUIDACION_BORRADOR", async () => {
    comoEmpleador("c7@example.com");
    await buildEmpleadaAggregate({
      email: "c7@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    // Inicializar el borrador con un GET previo.
    await OBTENER(getRequest(2026, 3), ctx(2026, 3));

    const res = await REABRIR(postRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LIQUIDACION_BORRADOR");
  });

  it("AC-8: tras reabrir, un PUT vuelve a responder 200 (edición desbloqueada)", async () => {
    comoEmpleador("c8@example.com");
    await buildEmpleadaAggregate({
      email: "c8@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    // Cerrada: el PUT debe fallar con 409 (AC-15).
    const bloqueado = await ACTUALIZAR(
      putRequest(2026, 3, { notas: "intento" }),
      ctx(2026, 3),
    );
    expect(bloqueado.status).toBe(409);

    await REABRIR(postRequest(2026, 3), ctx(2026, 3));
    const res = await ACTUALIZAR(
      putRequest(2026, 3, { notas: "tras reabrir" }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).notas).toBe("tras reabrir");
  });

  it("AC-9 (RN-09 deja de aplicar): tras reabrir, el desglose se calcula en vivo", async () => {
    comoEmpleador("c9@example.com");
    const { configuracion } = await buildEmpleadaAggregate({
      email: "c9@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const cerrada = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();
    await REABRIR(postRequest(2026, 3), ctx(2026, 3));
    await db.configuracion.update({
      where: { id: configuracion.id },
      data: { salarioBase: 1400000 },
    });

    const leida = await obtenerBody("c9@example.com", 2026, 3);
    expect(leida.estado).toBe("BORRADOR");
    // En vivo con el doble de salario, el valorDia se duplica respecto al cierre.
    expect((leida.desglose as { valorDia: number }).valorDia).toBe(
      cerrada.desglose.valorDia * 2,
    );
  });

  it("AC-10 (BR-6): reabrir, cambiar salario y re-cerrar congela los NUEVOS valores", async () => {
    comoEmpleador("c10@example.com");
    const { configuracion } = await buildEmpleadaAggregate({
      email: "c10@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const primera = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();
    await REABRIR(postRequest(2026, 3), ctx(2026, 3));
    await db.configuracion.update({
      where: { id: configuracion.id },
      data: { salarioBase: 1400000 },
    });
    const segunda = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();

    expect(segunda.desglose.valorDia).toBe(primera.desglose.valorDia * 2);

    // Un cambio posterior ya no afecta (re-congelado con B).
    await db.configuracion.update({
      where: { id: configuracion.id },
      data: { salarioBase: 210000 },
    });
    const leida = await obtenerBody("c10@example.com", 2026, 3);
    expect((leida.desglose as { valorDia: number }).valorDia).toBe(
      segunda.desglose.valorDia,
    );
  });

  it("AC-11 (rol): cerrar con token de empleada responde 403 y no cambia el estado", async () => {
    await buildEmpleadaAggregate({
      email: "c11@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    const token = await tokenEmpleada("c11@example.com");

    const res = await CERRAR(postRequest(2026, 3, token), ctx(2026, 3));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
    const cerradas = await db.liquidacion.count({ where: { estado: "CERRADA" } });
    expect(cerradas).toBe(0);
  });

  it("AC-12 (rol): reabrir con token de empleada responde 403", async () => {
    comoEmpleador("c12@example.com");
    await buildEmpleadaAggregate({
      email: "c12@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    const token = await tokenEmpleada("c12@example.com");

    const res = await REABRIR(postRequest(2026, 3, token), ctx(2026, 3));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-13 (auth): cerrar sin identidad responde 401", async () => {
    await buildEmpleadaAggregate({
      email: "c13@example.com",
      fechaInicioContrato: new Date("2026-01-01"),
    });
    obtenerSesionEmpleadorMock.mockResolvedValue(null);

    const res = await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("NO_AUTORIZADO");
  });

  it("AC-14 (validación): mes fuera de 1..12 responde 422 en cierre y reapertura", async () => {
    comoEmpleador("c14@example.com");
    await buildEmpleadaAggregate({ email: "c14@example.com" });

    const resCierre = await CERRAR(postRequest(2026, 13), ctx(2026, 13));
    expect(resCierre.status).toBe(422);
    expect((await resCierre.json()).code).toBe("VALIDACION");

    const resReapertura = await REABRIR(postRequest(2026, 0), ctx(2026, 0));
    expect(resReapertura.status).toBe(422);
    expect((await resReapertura.json()).code).toBe("VALIDACION");
  });

  it("AC-15: el PUT sobre una CERRADA por esta operación sigue 409 LIQUIDACION_CERRADA", async () => {
    comoEmpleador("c15@example.com");
    await buildEmpleadaAggregate({
      email: "c15@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await CERRAR(postRequest(2026, 3), ctx(2026, 3));

    const res = await ACTUALIZAR(
      putRequest(2026, 3, { notas: "x" }),
      ctx(2026, 3),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LIQUIDACION_CERRADA");
  });

  it("EC-1: cerrar un mes sin novedades congela el total = subtotalDías", async () => {
    comoEmpleador("ec1@example.com");
    await buildEmpleadaAggregate({
      email: "ec1@example.com",
      salarioBase: 700000,
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });

    const body = await (await CERRAR(postRequest(2026, 3), ctx(2026, 3))).json();
    expect(body.desglose.total).toBe(body.desglose.subtotalDias);
    const row = await db.liquidacion.findFirst({ where: { anio: 2026, mes: 3 } });
    expect(row?.totalCongelado).toBe(body.desglose.total);
  });

  it("EC-2: cerrar un mes liquidable sin fila previa la inicializa y la cierra (una sola fila)", async () => {
    comoEmpleador("ec2@example.com");
    await buildEmpleadaAggregate({
      email: "ec2@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    expect(await db.liquidacion.count()).toBe(0);

    const res = await CERRAR(postRequest(2026, 3), ctx(2026, 3));
    expect(res.status).toBe(200);
    expect((await res.json()).estado).toBe("CERRADA");
    expect(await db.liquidacion.count()).toBe(1);
  });

  it("EC-4: reabrir conserva las novedades persistidas", async () => {
    comoEmpleador("ec4@example.com");
    await buildEmpleadaAggregate({
      email: "ec4@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-01-01"),
    });
    await ACTUALIZAR(
      putRequest(2026, 3, { inasistencias: ["2026-03-03"] }),
      ctx(2026, 3),
    );
    await CERRAR(postRequest(2026, 3), ctx(2026, 3));

    await REABRIR(postRequest(2026, 3), ctx(2026, 3));
    expect(await db.inasistencia.count()).toBe(1);
    const leida = await obtenerBody("ec4@example.com", 2026, 3);
    expect(leida.inasistencias).toContain("2026-03-03");
  });

  it("EC-5: cerrar un mes íntegramente fuera de contrato responde 409 MES_FUERA_DE_CONTRATO", async () => {
    comoEmpleador("ec5@example.com");
    await buildEmpleadaAggregate({
      email: "ec5@example.com",
      diasLaborales: DIAS_LMS,
      fechaInicioContrato: new Date("2026-06-01"),
    });

    const res = await CERRAR(postRequest(2026, 1), ctx(2026, 1));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("MES_FUERA_DE_CONTRATO");
    expect(await db.liquidacion.count()).toBe(0);
  });
});
