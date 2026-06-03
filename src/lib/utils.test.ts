// RED — Spec A (design-tokens). La utilidad `cn` fusiona clases (clsx +
// tailwind-merge); la consumen todos los componentes del Design System.
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn (merge de clases)", () => {
  it("concatena clases simples", () => {
    expect(cn("a", "b")).toContain("a");
    expect(cn("a", "b")).toContain("b");
  });

  it("descarta valores falsy condicionales", () => {
    expect(cn("a", false && "b", undefined, null, "c")).not.toContain("b");
  });

  it("resuelve conflictos de Tailwind dejando la última (tailwind-merge)", () => {
    // p-2 y p-4 entran en conflicto: debe ganar la última.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
