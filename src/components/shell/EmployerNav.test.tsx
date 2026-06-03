// RED — Spec employer-shell. Navegación del empleador: 6 secciones con nombres
// accesibles y rutas correctas, dentro de una región de navegación (AC-1, BR-2).
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

import { EmployerNav } from "./EmployerNav";

const SECCIONES: ReadonlyArray<[string, string]> = [
  ["Inicio", "/"],
  ["Configuración", "/configuracion"],
  ["Liquidar", "/liquidar"],
  ["Historial", "/historial"],
  ["Menú", "/menu"],
  ["Tareas", "/tareas"],
];

describe("EmployerNav (Spec employer-shell)", () => {
  it("AC-1: renderiza una región de navegación con exactamente 6 enlaces", () => {
    render(<EmployerNav />);
    const nav = screen.getByRole("navigation");
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(6);
  });

  it("AC-1: cada sección tiene su nombre accesible y apunta a su ruta", () => {
    render(<EmployerNav />);
    const nav = screen.getByRole("navigation");
    for (const [nombre, ruta] of SECCIONES) {
      const link = within(nav).getByRole("link", { name: new RegExp(nombre, "i") });
      expect(link).toHaveAttribute("href", ruta);
    }
  });
});
