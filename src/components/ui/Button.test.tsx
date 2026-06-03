// RED — Spec B. Button: variantes, estados, a11y (AC-1, AC-2, EC-4).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button (Spec B)", () => {
  it("AC-1: renderiza con rol button y muestra su texto", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("AC-1: soporta variantes sin romper el rol", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
    for (const variant of ["secondary", "ghost", "danger", "link"] as const) {
      rerender(<Button variant={variant}>A</Button>);
      expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
    }
  });

  it("AC-1: refleja disabled y no invoca onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        X
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "X" });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("AC-1 / EC-4: en loading queda deshabilitado y comunica el estado", () => {
    render(<Button loading>Enviar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("AC-2: solo-ícono expone un nombre accesible vía aria-label", () => {
    render(
      <Button aria-label="Cerrar" iconOnly>
        <svg aria-hidden="true" />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
