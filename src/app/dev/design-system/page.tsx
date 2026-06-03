import * as React from "react";
import { assertDevOnly } from "./guard";
import { ComponentsShowcase, Section, ThemeToggle } from "./sections";
import { TokenPalette, TypeScale, SpacingScale } from "./tokens-display";

export const metadata = {
  title: "Design System — MiEmpleadApp (dev)",
  robots: { index: false, follow: false },
};

// Showcase del Design System (solo desarrollo, BR-5). Renderiza la paleta de
// tokens, las escalas tipográfica/de spacing y todos los componentes base y de
// dominio en sus variantes/estados. Es el artefacto de la aprobación visual.
export default function DesignSystemPage() {
  assertDevOnly();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-xl p-lg">
      <header className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 font-bold text-foreground">Design System · MiEmpleadApp</h1>
          <p className="text-body text-foreground-muted">
            Tokens, componentes base y de dominio. Solo visible en desarrollo.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <TokenPalette />
      <TypeScale />
      <SpacingScale />

      <Section title="Componentes">
        <p className="text-caption text-foreground-muted">
          Cada componente se muestra en sus variantes y estados.
        </p>
      </Section>
      <ComponentsShowcase />
    </main>
  );
}
