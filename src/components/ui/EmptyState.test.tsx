// RED — Spec B. EmptyState: mensaje guía + acción opcional (AC-13).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState (Spec B)", () => {
  it("AC-13: renderiza el mensaje guía", () => {
    render(<EmptyState title="Sin meses liquidados" description="Aún no hay historial." />);
    expect(screen.getByText("Sin meses liquidados")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay historial.")).toBeInTheDocument();
  });

  it("AC-13: renderiza una acción cuando se provee", () => {
    render(
      <EmptyState title="Sin items" action={<button>Crear item</button>} />,
    );
    expect(screen.getByRole("button", { name: "Crear item" })).toBeInTheDocument();
  });
});
