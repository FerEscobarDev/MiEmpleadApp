// RED — Spec epic-8.3-liquidar-mes/seleccion-y-desglose.
// Selección de mes/año + carga de la liquidación (obtenerLiquidacion) y render del
// calendario coloreado, panel de desglose destacado y badge de estado. Sin servidor:
// fetch mockeado. La página consume el contrato SOLO por el cliente tipado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { LiquidarMesSection } from "./liquidar-mes-section";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const errorJson = (status: number, code: string) =>
  jsonResponse(status, { code, message: "x" });

interface Liquidacion {
  anio: number;
  mes: number;
  estado: "BORRADOR" | "CERRADA";
  desglose: {
    diasLaboralesMes: number;
    festivosEnDiaLaboral: number;
    diasTrabajados: number;
    valorDia: number;
    subtotalDias: number;
    subtotalItems: number;
    subtotalMontosPuntuales: number;
    total: number;
  };
  calendario: { fecha: string; tipo: string; itemsAdicionales?: string[] }[];
  inasistencias: string[];
  items: { itemId: string; nombre: string; valorUnitario: number; cantidad: number; subtotal: number }[];
  montosPuntuales: { id?: string; descripcion: string; monto: number }[];
  notas?: string | null;
}

let calls: { url: string; method: string }[];
let fetchMock: ReturnType<typeof vi.fn>;

function liquidacionDe(anio: number, mes: number, estado: "BORRADOR" | "CERRADA"): Liquidacion {
  // Calendario mínimo de 3 días de ese mes con tipos variados.
  const p = (d: number) => `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return {
    anio,
    mes,
    estado,
    desglose: {
      diasLaboralesMes: 26,
      festivosEnDiaLaboral: 1,
      diasTrabajados: 24,
      valorDia: 26923,
      subtotalDias: 646152,
      subtotalItems: 40000,
      subtotalMontosPuntuales: 50000,
      total: 736152,
    },
    calendario: [
      { fecha: p(1), tipo: "TRABAJADO" },
      { fecha: p(2), tipo: "INASISTENCIA" },
      { fecha: p(3), tipo: "FESTIVO" },
    ],
    inasistencias: [p(2)],
    items: [],
    montosPuntuales: [],
    notas: estado === "BORRADOR" ? "nota privada" : null,
  };
}

function installFetch(handler?: (url: string, method: string) => Response | null) {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    if (handler) {
      const r = handler(url, method);
      if (r) return r;
    }
    const m = url.match(/\/liquidaciones\/(\d+)\/(\d+)(?:\?|$)/);
    if (m && method === "GET") {
      return jsonResponse(200, liquidacionDe(Number(m[1]), Number(m[2]), "BORRADOR"));
    }
    if (url.includes("/items-adicionales") && method === "GET") {
      return jsonResponse(200, []);
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const getCalls = (fragment: string) =>
  calls.filter((c) => c.method === "GET" && c.url.includes(fragment));

describe("LiquidarMesSection (Spec seleccion-y-desglose)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: al montar llama a obtenerLiquidacion (GET /liquidaciones/{anio}/{mes})", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await waitFor(() =>
      expect(getCalls("/liquidaciones/2026/5").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("AC-2: muestra estado de carga (Skeleton) y no el calendario mientras carga", () => {
    const { container } = render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-3: renderiza el calendario, el panel de desglose y el total destacado en COP", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    // Leyenda del calendario presente (provista por MonthCalendar).
    expect(await screen.findByLabelText(/Leyenda del calendario/i)).toBeInTheDocument();
    // Líneas etiquetadas del desglose.
    expect(screen.getByText(/Días laborales del mes/i)).toBeInTheDocument();
    expect(screen.getByText(/Festivos en día laboral/i)).toBeInTheDocument();
    expect(screen.getByText(/Días trabajados/i)).toBeInTheDocument();
    expect(screen.getByText(/Valor.?día/i)).toBeInTheDocument();
    // Total destacado, formateado en COP (separador de miles).
    const total = screen.getByTestId("liquidacion-total");
    expect(total.textContent).toMatch(/736\.152/);
  });

  it("AC-4: el badge refleja el estado BORRADOR", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(await screen.findByText(/Borrador/i)).toBeInTheDocument();
  });

  it("AC-4: el badge refleja el estado CERRADA", async () => {
    installFetch((url, method) => {
      const m = url.match(/\/liquidaciones\/(\d+)\/(\d+)/);
      if (m && method === "GET" && url.includes("/liquidaciones/")) {
        return jsonResponse(200, liquidacionDe(Number(m[1]), Number(m[2]), "CERRADA"));
      }
      return null;
    });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(await screen.findByText(/Cerrada/i)).toBeInTheDocument();
  });

  it("AC-5: cambiar el mes dispara una nueva carga con el nuevo periodo", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await screen.findByLabelText(/Leyenda del calendario/i);
    const selMes = screen.getByLabelText(/^Mes$/i);
    await userEvent.selectOptions(selMes, "3");
    await waitFor(() =>
      expect(getCalls("/liquidaciones/2026/3").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("AC-6: 409 MES_FUERA_DE_CONTRATO muestra mensaje amable y no renderiza calendario", async () => {
    installFetch((url, method) => {
      if (url.includes("/liquidaciones/") && method === "GET") {
        return errorJson(409, "MES_FUERA_DE_CONTRATO");
      }
      return null;
    });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={1} />);
    expect(await screen.findByText(/fuera del periodo de contrato/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Leyenda del calendario/i)).not.toBeInTheDocument();
  });

  it("AC-7: los selectores de mes y año son accesibles por etiqueta", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(screen.getByLabelText(/^Mes$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Año$/i)).toBeInTheDocument();
  });

  it("EC-1: un error inesperado (500) muestra mensaje de error y toast, sin Skeleton infinito", async () => {
    installFetch((url, method) => {
      if (url.includes("/liquidaciones/") && method === "GET") {
        return errorJson(500, "ERROR");
      }
      return null;
    });
    const { container } = render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/No pudimos cargar/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("EC-2: total 0 se muestra como $ 0 sin romper el formateo", async () => {
    installFetch((url, method) => {
      const m = url.match(/\/liquidaciones\/(\d+)\/(\d+)/);
      if (m && method === "GET" && url.includes("/liquidaciones/")) {
        const liq = liquidacionDe(Number(m[1]), Number(m[2]), "BORRADOR");
        liq.desglose.total = 0;
        return jsonResponse(200, liq);
      }
      return null;
    });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const total = await screen.findByTestId("liquidacion-total");
    expect(within(total).getByText(/\$\s?0/)).toBeInTheDocument();
  });
});
