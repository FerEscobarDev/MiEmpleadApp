// RED — Spec B. CurrencyDisplay: formatea con formatCOP, tabular (AC-10, EC-1, BR-3).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatCOP } from "@/lib/currency";
import { CurrencyDisplay } from "./CurrencyDisplay";

describe("CurrencyDisplay (Spec B)", () => {
  it("AC-10: renderiza el monto formateado con el helper único formatCOP", () => {
    render(<CurrencyDisplay amount={1500000} />);
    expect(screen.getByText(formatCOP(1500000))).toBeInTheDocument();
  });

  it("EC-1: monto 0 se muestra sin decimales", () => {
    render(<CurrencyDisplay amount={0} />);
    expect(screen.getByText(formatCOP(0))).toBeInTheDocument();
  });

  it("AC-10: usa números tabulares para alinear montos", () => {
    const { container } = render(<CurrencyDisplay amount={42000} />);
    expect(container.querySelector(".tabular-nums")).not.toBeNull();
  });
});
