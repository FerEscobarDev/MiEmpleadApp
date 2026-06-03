import { describe, it, expect, afterEach } from "vitest";
import { construirCalendario, type DiaCalendario } from "./calendario";
import type { DiaSemana } from "./dias-laborales";

const LUN_SAB: DiaSemana[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

function baseSeptiembre() {
  return {
    year: 2025,
    month: 9,
    diasLaborales: LUN_SAB,
    fechaInicioContrato: "2025-09-01",
    fechaFinContrato: null as string | null,
    festivos: [] as string[],
    inasistencias: [] as string[],
  };
}

function tipoDe(cal: DiaCalendario[], fecha: string): string {
  const dia = cal.find((d) => d.fecha === fecha);
  if (!dia) throw new Error(`fecha no encontrada en el calendario: ${fecha}`);
  return dia.tipo;
}

describe("construirCalendario — estructura (AC-1)", () => {
  it("AC-1: 30 días de septiembre en orden ascendente", () => {
    const cal = construirCalendario(baseSeptiembre());
    expect(cal.length).toBe(30);
    expect(cal[0].fecha).toBe("2025-09-01");
    expect(cal[29].fecha).toBe("2025-09-30");
    const fechas = cal.map((d) => d.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("EC-4: mes inválido lanza RangeError", () => {
    expect(() => construirCalendario({ ...baseSeptiembre(), month: 13 })).toThrow(RangeError);
  });
});

describe("tipos por día (AC-2..AC-10)", () => {
  it("AC-2: domingos son NO_LABORAL con L–S", () => {
    const cal = construirCalendario(baseSeptiembre());
    for (const dom of ["2025-09-07", "2025-09-14", "2025-09-21", "2025-09-28"]) {
      expect(tipoDe(cal, dom)).toBe("NO_LABORAL");
    }
  });

  it("AC-3: antes del inicio de contrato es FUERA_CONTRATO", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), fechaInicioContrato: "2025-09-15" });
    expect(tipoDe(cal, "2025-09-01")).toBe("FUERA_CONTRATO");
    expect(tipoDe(cal, "2025-09-15")).toBe("TRABAJADO");
  });

  it("AC-4: después del fin de contrato es FUERA_CONTRATO", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), fechaFinContrato: "2025-09-15" });
    expect(tipoDe(cal, "2025-09-16")).toBe("FUERA_CONTRATO");
    expect(tipoDe(cal, "2025-09-15")).toBe("TRABAJADO");
  });

  it("AC-5: festivo en día laboral es FESTIVO (agosto 2025)", () => {
    const cal = construirCalendario({
      ...baseSeptiembre(),
      month: 8,
      fechaInicioContrato: "2025-08-01",
      festivos: ["2025-08-07", "2025-08-18"],
    });
    expect(tipoDe(cal, "2025-08-07")).toBe("FESTIVO");
    expect(tipoDe(cal, "2025-08-18")).toBe("FESTIVO");
  });

  it("AC-6: festivo en día no laboral queda NO_LABORAL", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), festivos: ["2025-09-07"] });
    expect(tipoDe(cal, "2025-09-07")).toBe("NO_LABORAL");
  });

  it("AC-7: inasistencia en día laboral es INASISTENCIA", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), inasistencias: ["2025-09-16"] });
    expect(tipoDe(cal, "2025-09-16")).toBe("INASISTENCIA");
  });

  it("AC-8: día laboral en contrato sin novedad es TRABAJADO", () => {
    const cal = construirCalendario(baseSeptiembre());
    expect(tipoDe(cal, "2025-09-02")).toBe("TRABAJADO");
  });

  it("AC-9: inasistencia inválida en domingo no cambia NO_LABORAL", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), inasistencias: ["2025-09-07"] });
    expect(tipoDe(cal, "2025-09-07")).toBe("NO_LABORAL");
  });

  it("AC-10: festivo tiene precedencia sobre inasistencia", () => {
    const cal = construirCalendario({
      ...baseSeptiembre(),
      month: 8,
      fechaInicioContrato: "2025-08-01",
      festivos: ["2025-08-07"],
      inasistencias: ["2025-08-07"],
    });
    expect(tipoDe(cal, "2025-08-07")).toBe("FESTIVO");
  });
});

describe("distribución de tipos en mes parcial (AC-11)", () => {
  it("AC-11: conteo correcto con inicio el 15 e inasistencia el 16", () => {
    const cal = construirCalendario({
      ...baseSeptiembre(),
      fechaInicioContrato: "2025-09-15",
      inasistencias: ["2025-09-16"],
    });
    const counts: Record<string, number> = {};
    for (const d of cal) counts[d.tipo] = (counts[d.tipo] ?? 0) + 1;
    expect(counts.FUERA_CONTRATO).toBe(12);
    expect(counts.NO_LABORAL).toBe(4);
    expect(counts.TRABAJADO).toBe(13);
    expect(counts.INASISTENCIA).toBe(1);
    expect(cal.length).toBe(30);
  });
});

describe("edge cases (EC-1, EC-2, EC-3)", () => {
  it("EC-1: mes fuera de contrato no tiene TRABAJADO", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), fechaInicioContrato: "2025-10-01" });
    expect(cal.some((d) => d.tipo === "TRABAJADO")).toBe(false);
    expect(cal.some((d) => d.tipo === "FUERA_CONTRATO")).toBe(true);
  });

  it("EC-2: sin días laborales, todo es NO_LABORAL", () => {
    const cal = construirCalendario({ ...baseSeptiembre(), diasLaborales: [] });
    expect(cal.every((d) => d.tipo === "NO_LABORAL")).toBe(true);
  });

  it("EC-3: inasistencia fuera de contrato no genera INASISTENCIA", () => {
    const cal = construirCalendario({
      ...baseSeptiembre(),
      fechaInicioContrato: "2025-09-15",
      inasistencias: ["2025-09-02"],
    });
    expect(cal.some((d) => d.tipo === "INASISTENCIA")).toBe(false);
    expect(tipoDe(cal, "2025-09-02")).toBe("FUERA_CONTRATO");
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
    const cal = construirCalendario({
      ...baseSeptiembre(),
      fechaInicioContrato: "2025-09-15",
      inasistencias: ["2025-09-16"],
    });
    expect(cal.length).toBe(30);
    expect(tipoDe(cal, "2025-09-15")).toBe("TRABAJADO");
    expect(tipoDe(cal, "2025-09-16")).toBe("INASISTENCIA");
    expect(tipoDe(cal, "2025-09-01")).toBe("FUERA_CONTRATO");
  });
});
