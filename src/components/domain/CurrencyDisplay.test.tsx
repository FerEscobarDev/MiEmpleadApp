// RED — Spec B. CurrencyDisplay: formatea con formatCOP, tabular (AC-10, EC-1, BR-3).
// Nota: Intl es-CO inserta un espacio duro (NBSP, U+00A0) entre el símbolo y las
// cifras; RTL normaliza ese NBSP a espacio regular en el texto del DOM. Por eso
// comparamos el contenido normalizando el espacio en ambos lados — seguimos
// afirmando que el valor proviene de formatCOP (el único formateador).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatCOP } from "@/lib/currency";
import { CurrencyDisplay } from "./CurrencyDisplay";

const norm = (s: string) => s.replace(/\s+/g, " ");
const textIs = (expected: string) => (content: string) => norm(content) === norm(expected);

describe("CurrencyDisplay (Spec B)", () => {
  it("AC-10: renderiza el monto formateado con el helper único formatCOP", () => {
    render(<CurrencyDisplay amount={1500000} />);
    expect(screen.getByText(textIs(formatCOP(1500000)))).toBeInTheDocument();
  });

  it("EC-1: monto 0 se muestra sin decimales", () => {
    render(<CurrencyDisplay amount={0} />);
    expect(screen.getByText(textIs(formatCOP(0)))).toBeInTheDocument();
  });

  it("AC-10: usa números tabulares para alinear montos", () => {
    const { container } = render(<CurrencyDisplay amount={42000} />);
    expect(container.querySelector(".tabular-nums")).not.toBeNull();
  });
});
