// RED — Spec epic-8.3-liquidar-mes/ciclo-vida.
// Cerrar (cerrarLiquidacion) y reabrir (reabrirLiquidacion) la liquidación del mes,
// cada acción confirmada con un Dialog. El badge y la editabilidad reflejan el estado.
// Sin servidor: fetch mockeado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  calendario: { fecha: string; tipo: string }[];
  inasistencias: string[];
  items: never[];
  montosPuntuales: never[];
  notas?: string | null;
}

function liquidacion(estado: "BORRADOR" | "CERRADA"): Liquidacion {
  return {
    anio: 2026,
    mes: 5,
    estado,
    desglose: {
      diasLaboralesMes: 26,
      festivosEnDiaLaboral: 1,
      diasTrabajados: 24,
      valorDia: 26923,
      subtotalDias: 646152,
      subtotalItems: 0,
      subtotalMontosPuntuales: 0,
      total: 646152,
    },
    calendario: [{ fecha: "2026-05-01", tipo: "TRABAJADO" }],
    inasistencias: [],
    items: [],
    montosPuntuales: [],
    notas: estado === "CERRADA" ? null : "",
  };
}

let calls: { url: string; method: string }[];
let fetchMock: ReturnType<typeof vi.fn>;

function installFetch(opts: {
  estadoInicial?: "BORRADOR" | "CERRADA";
  cierreHandler?: () => Response | null;
  reaperturaHandler?: () => Response | null;
} = {}) {
  const estadoInicial = opts.estadoInicial ?? "BORRADOR";
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    if (url.includes("/items-adicionales") && method === "GET") {
      return jsonResponse(200, []);
    }
    if (url.includes("/cierre") && method === "POST") {
      if (opts.cierreHandler) {
        const r = opts.cierreHandler();
        if (r) return r;
      }
      return jsonResponse(200, liquidacion("CERRADA"));
    }
    if (url.includes("/reapertura") && method === "POST") {
      if (opts.reaperturaHandler) {
        const r = opts.reaperturaHandler();
        if (r) return r;
      }
      return jsonResponse(200, liquidacion("BORRADOR"));
    }
    const m = url.match(/\/liquidaciones\/\d+\/\d+(?:\?|$)/);
    if (m && method === "GET") {
      return jsonResponse(200, liquidacion(estadoInicial));
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const callsTo = (method: string, fragment: string) =>
  calls.filter((c) => c.method === method && c.url.includes(fragment));

describe("LiquidarMesSection — ciclo de vida (Spec ciclo-vida)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: en BORRADOR muestra 'Cerrar liquidación' y no 'Reabrir'", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(
      await screen.findByRole("button", { name: /Cerrar liquidación/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reabrir/i })).not.toBeInTheDocument();
  });

  it("AC-2: confirmar el cierre llama a cerrarLiquidacion y el badge pasa a Cerrada", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Cerrar liquidación/i }));
    // El Dialog de confirmación aparece; confirmamos.
    const confirmar = await screen.findByRole("button", { name: /^Confirmar cierre|^Sí, cerrar|^Cerrar$/i });
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(callsTo("POST", "/liquidaciones/2026/5/cierre").length).toBe(1),
    );
    expect(await screen.findByText(/Cerrada/i)).toBeInTheDocument();
  });

  it("AC-3: cancelar en el Dialog de cierre no llama a cerrarLiquidacion", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Cerrar liquidación/i }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(callsTo("POST", "/cierre").length).toBe(0);
  });

  it("AC-4: en CERRADA muestra 'Reabrir' y no 'Cerrar liquidación'", async () => {
    installFetch({ estadoInicial: "CERRADA" });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(await screen.findByRole("button", { name: /^Reabrir/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Cerrar liquidación/i }),
    ).not.toBeInTheDocument();
  });

  it("AC-5: confirmar la reapertura llama a reabrirLiquidacion y el badge vuelve a Borrador", async () => {
    installFetch({ estadoInicial: "CERRADA" });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Reabrir/i }));
    const confirmar = await screen.findByRole("button", { name: /^Confirmar reapertura|^Sí, reabrir|^Reabrir$/i });
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(callsTo("POST", "/liquidaciones/2026/5/reapertura").length).toBe(1),
    );
    expect(await screen.findByText(/Borrador/i)).toBeInTheDocument();
  });

  it("AC-6: un 409 al cerrar muestra mensaje amable y no rompe la página", async () => {
    installFetch({ cierreHandler: () => errorJson(409, "LIQUIDACION_CERRADA") });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Cerrar liquidación/i }));
    const confirmar = await screen.findByRole("button", { name: /^Confirmar cierre|^Sí, cerrar|^Cerrar$/i });
    await userEvent.click(confirmar);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // La página sigue mostrando el calendario (no se rompió).
    expect(screen.getByLabelText(/Leyenda del calendario/i)).toBeInTheDocument();
  });

  it("EC-1: un 500 al cerrar muestra toast de error y conserva el estado Borrador", async () => {
    installFetch({ cierreHandler: () => errorJson(500, "ERROR") });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Cerrar liquidación/i }));
    const confirmar = await screen.findByRole("button", { name: /^Confirmar cierre|^Sí, cerrar|^Cerrar$/i });
    await userEvent.click(confirmar);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByText(/Borrador/i)).toBeInTheDocument();
  });

  it("EC-2: el Dialog de cierre cita el mes/periodo afectado", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Cerrar liquidación/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/mayo|05|2026/i);
  });
});
