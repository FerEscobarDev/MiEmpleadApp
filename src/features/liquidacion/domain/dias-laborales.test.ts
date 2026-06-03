import { describe, it, expect, afterEach } from "vitest";
import {
  enumerarDiasDelMes,
  diaSemanaDe,
  esDiaLaboral,
  contarDiasLaboralesDelMes,
  contarDiasLaboralesEnContrato,
  calcularValorDia,
  type DiaSemana,
} from "./dias-laborales";

const LUN_SAB: DiaSemana[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const LUN_VIE: DiaSemana[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

describe("enumerarDiasDelMes (AC-1)", () => {
  it("AC-1: septiembre 2025 enumera 30 días en orden ascendente", () => {
    const dias = enumerarDiasDelMes(2025, 9);
    expect(dias.length).toBe(30);
    expect(dias[0]).toBe("2025-09-01");
    expect(dias[29]).toBe("2025-09-30");
    expect([...dias].sort()).toEqual(dias);
  });

  it("AC-1: febrero no bisiesto tiene 28 días y bisiesto 29", () => {
    expect(enumerarDiasDelMes(2025, 2).length).toBe(28);
    expect(enumerarDiasDelMes(2024, 2).length).toBe(29);
    expect(enumerarDiasDelMes(2024, 2)[28]).toBe("2024-02-29");
  });

  it("EC-3: mes inválido lanza RangeError", () => {
    expect(() => enumerarDiasDelMes(2025, 0)).toThrow(RangeError);
    expect(() => enumerarDiasDelMes(2025, 13)).toThrow(RangeError);
  });
});

describe("diaSemanaDe (AC-2)", () => {
  it("AC-2: distingue lunes y domingo", () => {
    expect(diaSemanaDe("2025-09-15")).toBe("LUNES");
    expect(diaSemanaDe("2025-09-14")).toBe("DOMINGO");
  });

  it("EC-3: fecha mal formada lanza RangeError", () => {
    expect(() => diaSemanaDe("2025/09/15")).toThrow(RangeError);
    expect(() => diaSemanaDe("15-09-2025")).toThrow(RangeError);
  });
});

describe("esDiaLaboral (AC-3)", () => {
  it("AC-3: domingo no es laboral con L–S, lunes sí", () => {
    expect(esDiaLaboral("2025-09-14", LUN_SAB)).toBe(false);
    expect(esDiaLaboral("2025-09-15", LUN_SAB)).toBe(true);
  });
});

describe("contarDiasLaboralesDelMes (AC-4, AC-5)", () => {
  it("AC-4: septiembre 2025 tiene 26 días L–S y 22 días L–V", () => {
    expect(contarDiasLaboralesDelMes(2025, 9, LUN_SAB)).toBe(26);
    expect(contarDiasLaboralesDelMes(2025, 9, LUN_VIE)).toBe(22);
  });

  it("AC-5: agosto 2025 cuenta 26 L–S sin excluir festivos en día laboral", () => {
    expect(contarDiasLaboralesDelMes(2025, 8, LUN_SAB)).toBe(26);
  });
});

describe("contarDiasLaboralesEnContrato (AC-6, AC-7, AC-9, EC-1, EC-4)", () => {
  it("AC-6: mes de inicio parcial — desde el 15 cuenta 14 días L–S", () => {
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-09-15", null),
    ).toBe(14);
  });

  it("AC-7: mes de fin parcial — hasta el 15 cuenta 13 días L–S", () => {
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-09-01", "2025-09-15"),
    ).toBe(13);
  });

  it("AC-9: contrato completo iguala el denominador del mes", () => {
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-09-01", null),
    ).toBe(26);
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2024-01-01", "2025-09-30"),
    ).toBe(26);
  });

  it("EC-1: mes completamente fuera del contrato cuenta 0", () => {
    // inicio posterior al fin del mes
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-10-01", null),
    ).toBe(0);
    // fin anterior al inicio del mes
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-01-01", "2025-08-31"),
    ).toBe(0);
  });

  it("EC-4: inicio y fin dentro del mismo mes cuenta solo el rango inclusive", () => {
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-09-15", "2025-09-20"),
    ).toBe(6);
  });
});

describe("calcularValorDia (AC-8, EC-2) — política round-half-up", () => {
  it("AC-8: redondea el valor-día a entero COP antes de multiplicar", () => {
    expect(calcularValorDia(700000, 26)).toBe(26923);
    expect(calcularValorDia(700000, 22)).toBe(31818);
    expect(calcularValorDia(600000, 24)).toBe(25000);
  });

  it("EC-2: denominador 0 retorna 0 sin dividir por cero", () => {
    expect(calcularValorDia(700000, 0)).toBe(0);
  });
});

describe("determinismo independiente de zona horaria (AC-10)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("AC-10: resultados estables bajo Asia/Tokyo", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(enumerarDiasDelMes(2025, 9).length).toBe(30);
    expect(diaSemanaDe("2025-09-15")).toBe("LUNES");
    expect(contarDiasLaboralesDelMes(2025, 9, LUN_SAB)).toBe(26);
    expect(
      contarDiasLaboralesEnContrato(2025, 9, LUN_SAB, "2025-09-15", null),
    ).toBe(14);
    expect(calcularValorDia(700000, 26)).toBe(26923);
  });
});
