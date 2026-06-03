// RED — Spec B. MonthCalendar: leyenda con etiquetas, etiqueta textual por día,
// indicador de item adicional (AC-11, EC-2, BR-2, BR-6).
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MonthCalendar } from "./MonthCalendar";

const dias = [
  { fecha: "2026-06-01", tipo: "TRABAJADO" as const },
  { fecha: "2026-06-02", tipo: "INASISTENCIA" as const },
  { fecha: "2026-06-03", tipo: "FESTIVO" as const },
  { fecha: "2026-06-07", tipo: "NO_LABORAL" as const },
  { fecha: "2026-06-15", tipo: "FUERA_CONTRATO" as const },
  { fecha: "2026-06-20", tipo: "TRABAJADO" as const, itemsAdicionales: ["it1"] },
];

describe("MonthCalendar (Spec B)", () => {
  it("AC-11: renderiza una leyenda con etiqueta textual por tipo de día", () => {
    render(<MonthCalendar anio={2026} mes={6} dias={dias} />);
    const legend = screen.getByRole("list", { name: /leyenda/i });
    for (const label of [
      /trabajado/i,
      /inasistencia/i,
      /festivo/i,
      /no laboral/i,
      /fuera de contrato/i,
    ]) {
      expect(within(legend).getByText(label)).toBeInTheDocument();
    }
  });

  it("AC-11 / EC-2: cada día expone una etiqueta accesible de su tipo (no solo color)", () => {
    render(<MonthCalendar anio={2026} mes={6} dias={dias} />);
    // El día fuera de contrato comunica su estado por texto accesible.
    expect(screen.getByLabelText(/15.*fuera de contrato/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/2.*inasistencia/i)).toBeInTheDocument();
  });

  it("AC-11 / BR-6: indica item adicional con un indicador adicional sobre el día", () => {
    render(<MonthCalendar anio={2026} mes={6} dias={dias} />);
    // El día con item adicional incluye la marca textual del indicador.
    expect(screen.getByLabelText(/20.*item adicional/i)).toBeInTheDocument();
  });
});
