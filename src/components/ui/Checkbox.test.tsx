// RED — Spec B. Checkbox: rol, alternancia, disabled, label clicable (AC-4).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./Checkbox";

describe("Checkbox (Spec B)", () => {
  it("AC-4: expone rol checkbox con su etiqueta", () => {
    render(<Checkbox label="Trapear" />);
    expect(screen.getByRole("checkbox", { name: "Trapear" })).toBeInTheDocument();
  });

  it("AC-4: alterna marcado al hacer clic e invoca el callback", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Lavar" onCheckedChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Lavar" });
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("AC-4: respeta disabled", () => {
    render(<Checkbox label="X" disabled />);
    expect(screen.getByRole("checkbox", { name: "X" })).toBeDisabled();
  });
});
