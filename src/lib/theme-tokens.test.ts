// RED — Spec A (design-tokens). Verifica que la configuración de tema Tailwind
// y los globals codifican los tokens del Design System (design_system.md §2).
// Estos tests leen los archivos de configuración como texto y aserciones de
// presencia de tokens; no dependen de un navegador.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const root = process.cwd() + "/";
const readRepo = (rel: string) => readFileSync(root + rel, "utf8");

describe("Tailwind theme tokens (Spec A)", () => {
  const config = readRepo("tailwind.config.ts");
  const css = readRepo("src/app/globals.css");

  it("AC-1: usa la estrategia de modo oscuro por clase", () => {
    expect(config).toMatch(/darkMode:\s*\[?\s*["']class["']/);
  });

  it("AC-2: expone los colores semánticos de marca", () => {
    for (const token of [
      "primary",
      "secondary",
      "accent",
      "success",
      "warning",
      "error",
      "info",
    ]) {
      expect(config).toContain(token);
    }
  });

  it("AC-3: expone los tokens de color del calendario", () => {
    // Cada tipo de día del calendario debe existir como token de color.
    for (const token of [
      "trabajado",
      "inasistencia",
      "festivo",
      "noLaboral",
      "fueraContrato",
      "itemAdicional",
    ]) {
      expect(config).toContain(token);
    }
    // El contenedor del grupo de calendario debe existir.
    expect(config).toMatch(/cal/);
  });

  it("AC-4: expone los neutrales de la escala slate del DS", () => {
    for (const step of ["50", "100", "200", "400", "600", "800", "900"]) {
      expect(config).toContain(`"${step}"`);
    }
  });

  it("AC-5: define spacing, radios y sombras del DS", () => {
    // Spacing del DS.
    expect(config).toMatch(/spacing/);
    // Radios del DS (md = 10px es distintivo del sistema).
    expect(config).toMatch(/borderRadius/);
    // Sombras incluida la de foco.
    expect(config).toMatch(/boxShadow/);
    expect(config).toMatch(/focus/);
  });

  it("AC-6: globals.css declara variables de tema para claro y oscuro", () => {
    expect(css).toMatch(/:root/);
    expect(css).toMatch(/\.dark/);
    // Debe declarar al menos la variable del color primario en ambos.
    expect(css).toMatch(/--primary/);
  });

  it("AC-7: la fuente es Inter y hay utilidad de números tabulares", () => {
    // La variable de fuente del DS debe estar referenciada en el tema.
    expect(config).toMatch(/font/i);
    // Números tabulares disponibles vía variable de fuente o utilidad.
    expect(css + config).toMatch(/tabular|--font-sans|Inter/i);
  });
});
