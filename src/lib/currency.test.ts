import { describe, it, expect } from "vitest";
import { formatCOP } from "./currency";

// Formateador canónico de referencia (RN-16 / conventions.md §9): COP sin decimales.
const canonical = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

describe("formatCOP", () => {
  it("AC-1: formatea 700000 como pesos con símbolo, miles agrupados y sin decimales", () => {
    const result = formatCOP(700000);
    expect(result).toContain("$");
    // Agrupación de miles es-CO usa "." como separador: 700.000
    expect(result).toContain("700");
    expect(result).toContain("000");
    // Sin parte decimal de dos dígitos al final.
    expect(result).not.toMatch(/[.,]\d{2}$/);
  });

  it("AC-2: formatea 0 con símbolo de peso y sin decimales", () => {
    const result = formatCOP(0);
    expect(result).toContain("$");
    expect(result).toContain("0");
    expect(result).not.toMatch(/[.,]\d{2}$/);
  });

  it("AC-3: agrupa millones y miles para un monto grande (1500000) sin decimales", () => {
    const result = formatCOP(1500000);
    expect(result).toContain("$");
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result).toContain("000");
    expect(result).not.toMatch(/[.,]\d{2}$/);
  });

  it("AC-4: nunca produce dos dígitos decimales al final (maximumFractionDigits: 0)", () => {
    for (const amount of [1234, 999, 1000000, 50]) {
      expect(formatCOP(amount)).not.toMatch(/[.,]\d{2}$/);
    }
  });

  it("AC-5: es equivalente al formateador canónico Intl es-CO/COP/0 decimales", () => {
    for (const amount of [700000, 0, 1500000, 1234]) {
      expect(formatCOP(amount)).toBe(canonical.format(amount));
    }
  });

  it("EC-2: formatea un monto negativo como moneda COP sin decimales", () => {
    const result = formatCOP(-50000);
    expect(result).toContain("$");
    expect(result).toContain("50");
    expect(result).toContain("000");
    expect(result).not.toMatch(/[.,]\d{2}$/);
    expect(result).toBe(canonical.format(-50000));
  });
});
