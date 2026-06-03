import { describe, it, expect, afterEach } from "vitest";
import {
  calcularDesglose,
  esInasistenciaValida,
  validarInasistencias,
} from "./calculo";
import type { DiaSemana } from "./dias-laborales";

const LUN_SAB: DiaSemana[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

// Base reutilizable: septiembre 2025, salario 700000, contrato completo, sin
// festivos ni novedades. valorDia = round(700000/26) = 26923.
function baseSeptiembre() {
  return {
    year: 2025,
    month: 9,
    salarioBase: 700000,
    diasLaborales: LUN_SAB,
    fechaInicioContrato: "2025-09-01",
    fechaFinContrato: null as string | null,
    festivos: [] as string[],
    inasistencias: [] as string[],
    items: [] as { valorUnitario: number; cantidad: number }[],
    montosPuntuales: [] as { monto: number }[],
  };
}

describe("calcularDesglose (AC-1..AC-9)", () => {
  it("AC-1: mes normal completo sin novedades", () => {
    const d = calcularDesglose(baseSeptiembre());
    expect(d.diasLaboralesMes).toBe(26);
    expect(d.festivosEnDiaLaboral).toBe(0);
    expect(d.diasTrabajados).toBe(26);
    expect(d.valorDia).toBe(26923);
    expect(d.subtotalDias).toBe(699998);
    expect(d.subtotalItems).toBe(0);
    expect(d.subtotalMontosPuntuales).toBe(0);
    expect(d.total).toBe(699998);
  });

  it("AC-2: mes de inicio parcial (contrato inicia el 15)", () => {
    const d = calcularDesglose({ ...baseSeptiembre(), fechaInicioContrato: "2025-09-15" });
    expect(d.diasLaboralesMes).toBe(26);
    expect(d.diasTrabajados).toBe(14);
    expect(d.subtotalDias).toBe(376922);
    expect(d.total).toBe(376922);
  });

  it("AC-3: mes de fin parcial (contrato termina el 15)", () => {
    const d = calcularDesglose({ ...baseSeptiembre(), fechaFinContrato: "2025-09-15" });
    expect(d.diasLaboralesMes).toBe(26);
    expect(d.diasTrabajados).toBe(13);
    expect(d.subtotalDias).toBe(349999);
  });

  it("AC-4: mes completamente fuera de contrato da total 0", () => {
    const d = calcularDesglose({ ...baseSeptiembre(), fechaInicioContrato: "2025-10-01" });
    expect(d.diasTrabajados).toBe(0);
    expect(d.subtotalDias).toBe(0);
    expect(d.total).toBe(0);
  });

  it("AC-5: todas las inasistencias (26) dejan subtotal en 0", () => {
    const todosLaborales = calcularDesglose(baseSeptiembre()); // para conocer 26
    expect(todosLaborales.diasTrabajados).toBe(26);
    // Construir las 26 inasistencias = todos los días laborales del mes.
    const inasistencias: string[] = [];
    for (let d = 1; d <= 30; d++) {
      const fecha = `2025-09-${String(d).padStart(2, "0")}`;
      const dow = new Date(Date.UTC(2025, 8, d)).getUTCDay();
      if (dow !== 0) inasistencias.push(fecha); // L–S
    }
    expect(inasistencias.length).toBe(26);
    const d = calcularDesglose({ ...baseSeptiembre(), inasistencias });
    expect(d.diasTrabajados).toBe(0);
    expect(d.subtotalDias).toBe(0);
  });

  it("AC-6: dos inasistencias válidas descuentan dos valor-día", () => {
    const d = calcularDesglose({
      ...baseSeptiembre(),
      inasistencias: ["2025-09-02", "2025-09-03"],
    });
    expect(d.diasTrabajados).toBe(24);
    expect(d.subtotalDias).toBe(646152);
  });

  it("AC-7: festivo en día laboral no se descuenta (agosto 2025)", () => {
    const d = calcularDesglose({
      ...baseSeptiembre(),
      month: 8,
      fechaInicioContrato: "2025-08-01",
      festivos: ["2025-08-07", "2025-08-18"],
    });
    expect(d.diasLaboralesMes).toBe(26);
    expect(d.festivosEnDiaLaboral).toBe(2);
    expect(d.diasTrabajados).toBe(26);
    expect(d.subtotalDias).toBe(26 * 26923);
  });

  it("AC-8: festivo en día no laboral es irrelevante", () => {
    // 2025-09-07 es domingo (no laboral).
    const d = calcularDesglose({ ...baseSeptiembre(), festivos: ["2025-09-07"] });
    expect(d.festivosEnDiaLaboral).toBe(0);
    expect(d.diasTrabajados).toBe(26);
  });

  it("AC-9: items y montos puntuales suman al total (RN-08)", () => {
    const d = calcularDesglose({
      ...baseSeptiembre(),
      items: [
        { valorUnitario: 20000, cantidad: 2 },
        { valorUnitario: 5000, cantidad: 3 },
      ],
      montosPuntuales: [{ monto: 50000 }, { monto: 30000 }],
    });
    expect(d.subtotalItems).toBe(55000);
    expect(d.subtotalMontosPuntuales).toBe(80000);
    expect(d.total).toBe(834998);
  });
});

describe("esInasistenciaValida (AC-10, RN-05)", () => {
  const ctx = {
    diasLaborales: LUN_SAB,
    festivos: ["2025-08-07", "2025-08-18"],
    fechaInicioContrato: "2025-09-01",
    fechaFinContrato: null as string | null,
  };

  it("AC-10: válida en día laboral no festivo dentro de contrato", () => {
    expect(esInasistenciaValida("2025-09-02", ctx)).toBe(true);
  });

  it("AC-10: inválida en día no laboral (domingo)", () => {
    expect(esInasistenciaValida("2025-09-07", ctx)).toBe(false);
  });

  it("AC-10: inválida en festivo", () => {
    // 2025-08-07 es festivo y laboral, pero festivo => inválida.
    expect(esInasistenciaValida("2025-08-07", { ...ctx, fechaInicioContrato: "2025-08-01" })).toBe(
      false,
    );
  });

  it("AC-10: inválida fuera de contrato", () => {
    expect(
      esInasistenciaValida("2025-09-10", { ...ctx, fechaInicioContrato: "2025-09-15" }),
    ).toBe(false);
  });
});

describe("validarInasistencias y descuento solo de válidas (AC-11, EC-1, EC-3)", () => {
  it("AC-11: lista exactamente las inválidas", () => {
    const invalidas = validarInasistencias(
      ["2025-09-02", "2025-09-07", "2025-09-10"],
      {
        diasLaborales: LUN_SAB,
        festivos: [],
        fechaInicioContrato: "2025-09-15",
        fechaFinContrato: null,
      },
    );
    // 2025-09-02 (laboral pero antes del inicio 15 => inválida),
    // 2025-09-07 (domingo => inválida), 2025-09-10 (antes del 15 => inválida).
    expect(invalidas).toEqual(["2025-09-02", "2025-09-07", "2025-09-10"]);
  });

  it("EC-1: una inasistencia inválida no reduce diasTrabajados", () => {
    // 2025-09-07 es domingo: inválida, no descuenta.
    const d = calcularDesglose({ ...baseSeptiembre(), inasistencias: ["2025-09-07"] });
    expect(d.diasTrabajados).toBe(26);
  });

  it("EC-3: inasistencias duplicadas cuentan una sola vez", () => {
    const d = calcularDesglose({
      ...baseSeptiembre(),
      inasistencias: ["2025-09-02", "2025-09-02"],
    });
    expect(d.diasTrabajados).toBe(25);
  });
});

describe("edge cases adicionales (EC-2, EC-4)", () => {
  it("EC-2: sin días laborales configurados, valorDia y subtotalDias son 0", () => {
    const d = calcularDesglose({
      ...baseSeptiembre(),
      diasLaborales: [],
      montosPuntuales: [{ monto: 10000 }],
    });
    expect(d.diasLaboralesMes).toBe(0);
    expect(d.valorDia).toBe(0);
    expect(d.subtotalDias).toBe(0);
    expect(d.total).toBe(10000);
  });

  it("EC-4: items con cantidad 0 aportan 0", () => {
    const d = calcularDesglose({
      ...baseSeptiembre(),
      items: [{ valorUnitario: 20000, cantidad: 0 }],
    });
    expect(d.subtotalItems).toBe(0);
  });
});

describe("determinismo independiente de zona horaria (AC-12)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("AC-12: estable bajo Asia/Tokyo", () => {
    process.env.TZ = "Asia/Tokyo";
    const d = calcularDesglose({ ...baseSeptiembre(), fechaInicioContrato: "2025-09-15" });
    expect(d.diasTrabajados).toBe(14);
    expect(d.total).toBe(376922);
    expect(
      esInasistenciaValida("2025-09-02", {
        diasLaborales: LUN_SAB,
        festivos: [],
        fechaInicioContrato: "2025-09-01",
        fechaFinContrato: null,
      }),
    ).toBe(true);
  });
});
