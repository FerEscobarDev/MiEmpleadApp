// RED — Spec B. Badge: texto + color, nunca solo color (AC-6, BR-2).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge (Spec B)", () => {
  it("AC-6: muestra el texto del estado (no solo color)", () => {
    render(<Badge variant="warning">Borrador</Badge>);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("AC-6: variante success con texto Cerrada", () => {
    render(<Badge variant="success">Cerrada</Badge>);
    expect(screen.getByText("Cerrada")).toBeInTheDocument();
  });
});
