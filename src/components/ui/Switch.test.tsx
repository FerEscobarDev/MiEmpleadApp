// RED — Spec B. Switch: rol switch y estado on/off (AC-5).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Switch } from "./Switch";

describe("Switch (Spec B)", () => {
  it("AC-5: expone rol switch con nombre accesible", () => {
    render(<Switch aria-label="Lunes" />);
    expect(screen.getByRole("switch", { name: "Lunes" })).toBeInTheDocument();
  });

  it("AC-5: refleja su estado on/off vía aria-checked", () => {
    const { rerender } = render(<Switch aria-label="Activo" checked={false} />);
    expect(screen.getByRole("switch", { name: "Activo" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    rerender(<Switch aria-label="Activo" checked />);
    expect(screen.getByRole("switch", { name: "Activo" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
