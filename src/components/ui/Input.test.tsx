// RED — Spec B. Input + Label: asociación label/input y estado de error (AC-3).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input (Spec B)", () => {
  it("AC-3: el input se asocia a su label por nombre accesible", () => {
    render(<Input id="salario" label="Salario base" />);
    expect(screen.getByLabelText("Salario base")).toBeInTheDocument();
  });

  it("AC-3: en error marca aria-invalid y asocia el texto de ayuda", () => {
    render(<Input id="email" label="Email" error="Email inválido" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(screen.getByText("Email inválido")).toBeInTheDocument();
  });
});
