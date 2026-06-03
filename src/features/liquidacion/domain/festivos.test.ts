import { describe, it, expect, afterEach } from "vitest";
import { getHolidaysInMonth, isHoliday } from "./festivos";

describe("getHolidaysInMonth", () => {
  // AC-1: Año Nuevo fijo + Reyes Magos observado el lunes 6.
  it("AC-1: enero 2025 retorna exactamente Año Nuevo y Reyes Magos", () => {
    expect(getHolidaysInMonth(2025, 1)).toEqual(["2025-01-01", "2025-01-06"]);
  });

  // AC-2: San José trasladado al lunes por Ley Emiliani; no la fecha litúrgica.
  it("AC-2: marzo 2025 incluye San José observado el 24 y no el 19", () => {
    const march = getHolidaysInMonth(2025, 3);
    expect(march).toContain("2025-03-24");
    expect(march).not.toContain("2025-03-19");
  });

  // AC-3: Día del Trabajo es festivo fijo (no se traslada).
  it("AC-3: mayo 2025 incluye el Día del Trabajo fijo", () => {
    expect(getHolidaysInMonth(2025, 5)).toContain("2025-05-01");
  });

  // AC-4: Grito de la Independencia fijo.
  it("AC-4: julio 2025 incluye el 20 de julio", () => {
    expect(getHolidaysInMonth(2025, 7)).toContain("2025-07-20");
  });

  // AC-5: Boyacá fijo + Asunción trasladada al lunes.
  it("AC-5: agosto 2025 incluye Boyacá (7) y Asunción trasladada (18)", () => {
    const august = getHolidaysInMonth(2025, 8);
    expect(august).toContain("2025-08-07");
    expect(august).toContain("2025-08-18");
  });

  // AC-6: ordenado ascendentemente, sin duplicados, formato YYYY-MM-DD.
  it("AC-6: el resultado está ordenado, sin duplicados y bien formado", () => {
    for (let month = 1; month <= 12; month++) {
      const result = getHolidaysInMonth(2025, month);
      const sorted = [...result].sort();
      expect(result).toEqual(sorted);
      expect(new Set(result).size).toBe(result.length);
      for (const d of result) {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  // AC-6 (EC-3): junio 2025 tiene dos festivos observados el mismo lunes (30) → una sola vez.
  it("EC-3: junio 2025 no duplica el lunes 30 pese a dos festivos observados", () => {
    const june = getHolidaysInMonth(2025, 6);
    const thirtieth = june.filter((d) => d === "2025-06-30");
    expect(thirtieth.length).toBe(1);
  });

  // AC-7: mes sin festivos retorna lista vacía.
  it("AC-7: un mes sin festivos colombianos retorna []", () => {
    // Febrero no tiene festivos colombianos.
    expect(getHolidaysInMonth(2025, 2)).toEqual([]);
  });

  // AC-10: guarda contra off-by-one entre años y traslado Emiliani de Reyes
  // según el día en que cae el 6 de enero (2024: sáb → lunes 8; 2026: mar → lunes 12).
  it("AC-10: enero 2024 y enero 2026 trasladan Reyes Magos al lunes siguiente", () => {
    expect(getHolidaysInMonth(2024, 1)).toEqual(["2024-01-01", "2024-01-08"]);
    expect(getHolidaysInMonth(2026, 1)).toEqual(["2026-01-01", "2026-01-12"]);
  });

  // EC-4: mes fuera de 1–12 lanza RangeError.
  it("EC-4: mes inválido lanza RangeError", () => {
    expect(() => getHolidaysInMonth(2025, 0)).toThrow(RangeError);
    expect(() => getHolidaysInMonth(2025, 13)).toThrow(RangeError);
    expect(() => getHolidaysInMonth(2025, -1)).toThrow(RangeError);
  });
});

describe("isHoliday", () => {
  // AC-8: lunes observado de San José es festivo; la fecha original no.
  it("AC-8: distingue la fecha observada de la litúrgica de San José", () => {
    expect(isHoliday("2025-03-24")).toBe(true);
    expect(isHoliday("2025-03-19")).toBe(false);
  });

  // AC-9: festivo fijo verdadero; día corriente falso.
  it("AC-9: Año Nuevo es festivo y un día corriente no lo es", () => {
    expect(isHoliday("2025-01-01")).toBe(true);
    expect(isHoliday("2025-07-21")).toBe(false);
  });

  // EC-5: cadena mal formada lanza RangeError.
  it("EC-5: una fecha mal formada lanza RangeError", () => {
    expect(() => isHoliday("2025/03/24")).toThrow(RangeError);
    expect(() => isHoliday("24-03-2025")).toThrow(RangeError);
    expect(() => isHoliday("2025-3-4")).toThrow(RangeError);
  });
});

describe("determinismo e independencia de zona horaria (AC-11, BR-2)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  // AC-11: el resultado no depende de la zona horaria del proceso.
  it("AC-11: getHolidaysInMonth e isHoliday son estables bajo otra zona horaria", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(getHolidaysInMonth(2025, 1)).toEqual(["2025-01-01", "2025-01-06"]);
    expect(getHolidaysInMonth(2025, 3)).toContain("2025-03-24");
    expect(isHoliday("2025-03-24")).toBe(true);
    expect(isHoliday("2025-07-21")).toBe(false);
  });
});
