// RED — Spec epic-8.4-historial/detalle-mes.
// Detalle de un mes histórico: carga vía obtenerLiquidacion, render de desglose +
// calendario lectura + badge; "Eliminar" con Dialog de confirmación (RN-19) que solo
// llama a eliminarLiquidacion al confirmar y luego navega a /historial; "Reabrir" solo
// si CERRADA. Sin servidor: fetch + next/navigation mockeados. Solo cliente tipado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, refresh: vi.fn() }),
}));

import { DetalleMesSection } from "./detalle-mes-section";

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

function liquidacionDe(anio: number, mes: number, estado: "BORRADOR" | "CERRADA"): Liquidacion {
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

let calls: { url: string; method: string }[];
let fetchMock: ReturnType<typeof vi.fn>;

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
      return jsonResponse(200, liquidacionDe(Number(m[1]), Number(m[2]), "CERRADA"));
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const callsOf = (method: string, fragment: string) =>
  calls.filter((c) => c.method === method && c.url.includes(fragment));

describe("DetalleMesSection (Spec detalle-mes)", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    pushMock.mockReset();
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: al montar llama a obtenerLiquidacion (GET /liquidaciones/{anio}/{mes})", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    await waitFor(() =>
      expect(callsOf("GET", "/liquidaciones/2026/5").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("AC-2: muestra Skeleton al cargar y luego desglose + calendario + total COP", async () => {
    const { container } = render(<DetalleMesSection anio={2026} mes={5} />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(await screen.findByLabelText(/Leyenda del calendario/i)).toBeInTheDocument();
    expect(screen.getByText(/Días laborales del mes/i)).toBeInTheDocument();
    const total = screen.getByTestId("liquidacion-total");
    expect(total.textContent).toMatch(/736\.152/);
  });

  it("AC-3: el badge refleja el estado CERRADA", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    expect(await screen.findByText(/Cerrada/i)).toBeInTheDocument();
  });

  it("AC-4: 'Eliminar' abre un Dialog de confirmación y NO elimina de inmediato", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    const btn = await screen.findByRole("button", { name: /Eliminar/i });
    await userEvent.click(btn);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(callsOf("DELETE", "/liquidaciones/2026/5")).toHaveLength(0);
  });

  it("AC-5: cancelar el Dialog NO llama a eliminarLiquidacion", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Eliminar/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Cancelar/i }));
    expect(callsOf("DELETE", "/liquidaciones/2026/5")).toHaveLength(0);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("AC-6: confirmar llama a eliminarLiquidacion (DELETE) una vez y navega a /historial", async () => {
    installFetch((url, method) => {
      if (/\/liquidaciones\/\d+\/\d+(?:\?|$)/.test(url) && method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return null;
    });
    render(<DetalleMesSection anio={2026} mes={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Eliminar/i }));
    const dialog = await screen.findByRole("dialog");
    const confirmar = within(dialog).getByRole("button", { name: /Eliminar|Confirmar/i });
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(callsOf("DELETE", "/liquidaciones/2026/5")).toHaveLength(1),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/historial"));
  });

  it("AC-7: 'Reabrir' solo aparece en CERRADA y al confirmar llama a reabrirLiquidacion", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    const reabrir = await screen.findByRole("button", { name: /Reabrir/i });
    await userEvent.click(reabrir);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Reabrir|Confirmar/i }));
    await waitFor(() =>
      expect(callsOf("POST", "/liquidaciones/2026/5/reapertura").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("EC-3: en BORRADOR no se muestra 'Reabrir' pero sí 'Eliminar'", async () => {
    installFetch((url, method) => {
      const m = url.match(/\/liquidaciones\/(\d+)\/(\d+)(?:\?|$)/);
      if (m && method === "GET") {
        return jsonResponse(200, liquidacionDe(Number(m[1]), Number(m[2]), "BORRADOR"));
      }
      return null;
    });
    render(<DetalleMesSection anio={2026} mes={5} />);
    expect(await screen.findByRole("button", { name: /Eliminar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reabrir/i })).not.toBeInTheDocument();
  });

  it("AC-8: el calendario es de solo lectura (los días no son interactivos)", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    await screen.findByLabelText(/Leyenda del calendario/i);
    // En modo lectura, el día no es un botón (sin onSelect ⇒ celda no interactiva).
    expect(screen.queryByRole("button", { name: /de mayo — Trabajado/i })).not.toBeInTheDocument();
  });

  it("AC-9 (a11y): el Dialog de confirmación de eliminar tiene título accesible", async () => {
    render(<DetalleMesSection anio={2026} mes={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Eliminar/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Eliminar liquidación/i)).toBeInTheDocument();
  });

  it("AC-10: error inesperado (500) al cargar muestra mensaje amable + toast, sin Skeleton infinito", async () => {
    installFetch((url, method) => {
      if (/\/liquidaciones\/\d+\/\d+(?:\?|$)/.test(url) && method === "GET") {
        return errorJson(500, "ERROR");
      }
      return null;
    });
    const { container } = render(<DetalleMesSection anio={2026} mes={5} />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/No pudimos cargar/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("EC-1: 409 MES_FUERA_DE_CONTRATO muestra mensaje amable y no el desglose", async () => {
    installFetch((url, method) => {
      if (/\/liquidaciones\/\d+\/\d+(?:\?|$)/.test(url) && method === "GET") {
        return errorJson(409, "MES_FUERA_DE_CONTRATO");
      }
      return null;
    });
    render(<DetalleMesSection anio={2026} mes={1} />);
    expect(await screen.findByText(/fuera del periodo de contrato/i)).toBeInTheDocument();
    expect(screen.queryByTestId("liquidacion-total")).not.toBeInTheDocument();
  });

  it("EC-2: eliminar falla (404) → toast de error y no navega", async () => {
    installFetch((url, method) => {
      if (/\/liquidaciones\/\d+\/\d+(?:\?|$)/.test(url) && method === "DELETE") {
        return new Response(null, { status: 404 });
      }
      return null;
    });
    render(<DetalleMesSection anio={2026} mes={5} />);
    await userEvent.click(await screen.findByRole("button", { name: /Eliminar/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Eliminar|Confirmar/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
