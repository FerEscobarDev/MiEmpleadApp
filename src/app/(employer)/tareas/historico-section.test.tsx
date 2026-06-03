// RED — Spec epic-8.6-tareas/checklist-historico (histórico).
// Selector de rango (desde/hasta) → obtenerHistoricoTareas (GET
// /tareas/historico?desde=&hasta=) → cumplimientos agrupados por fecha (hecho/
// pendiente). Estados loading/empty/error + a11y. Sin servidor: fetch mockeado.
// Consume el contrato SOLO por el cliente tipado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => a,
    error: (...a: unknown[]) => toastError(...a),
    info: (...a: unknown[]) => a,
  },
}));

import { HistoricoSection } from "./historico-section";

interface CumplimientoTarea {
  fecha: string;
  rutinaTareaId: string;
  descripcion: string;
  hecha: boolean;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface Call {
  url: string;
  method: string;
}

let calls: Call[];
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
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const HISTORICO: CumplimientoTarea[] = [
  { fecha: "2026-05-01", rutinaTareaId: "t1", descripcion: "Preparar desayuno", hecha: true },
  { fecha: "2026-05-01", rutinaTareaId: "t2", descripcion: "Lavar ropa", hecha: false },
  { fecha: "2026-05-02", rutinaTareaId: "t1", descripcion: "Preparar desayuno", hecha: true },
];

function handlerHistorico(items: CumplimientoTarea[] = HISTORICO) {
  return (url: string, method: string): Response | null => {
    if (/\/tareas\/historico\?/.test(url) && method === "GET") {
      return jsonResponse(200, items);
    }
    return null;
  };
}

const getHistoricoCalls = () =>
  calls.filter((c) => c.method === "GET" && /\/tareas\/historico/.test(c.url));

describe("HistoricoSection (Spec checklist-historico — histórico)", () => {
  beforeEach(() => {
    toastError.mockReset();
    installFetch(handlerHistorico());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-8: al montar llama a obtenerHistoricoTareas con desde/hasta y agrupa por fecha", async () => {
    render(<HistoricoSection />);
    await waitFor(() => expect(getHistoricoCalls().length).toBeGreaterThanOrEqual(1));
    const url = getHistoricoCalls()[0].url;
    expect(url).toContain("desde=");
    expect(url).toContain("hasta=");
    // Dos fechas distintas → dos grupos.
    expect(await screen.findByText(/2026-05-01/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-02/)).toBeInTheDocument();
    // Estado por tarea: al menos un "hecho" y un "pendiente" visibles.
    expect(screen.getAllByText(/hecho|pendiente/i).length).toBeGreaterThanOrEqual(2);
  });

  it("AC-9: cambiar el rango vuelve a llamar a obtenerHistoricoTareas con los nuevos parámetros", async () => {
    render(<HistoricoSection />);
    await waitFor(() => expect(getHistoricoCalls().length).toBeGreaterThanOrEqual(1));
    const desde = screen.getByLabelText(/desde/i);
    fireEvent.change(desde, { target: { value: "2026-04-01" } });
    await waitFor(() =>
      expect(getHistoricoCalls().some((c) => c.url.includes("desde=2026-04-01"))).toBe(
        true,
      ),
    );
  });

  it("AC-10: histórico vacío en el rango muestra EmptyState", async () => {
    installFetch(handlerHistorico([]));
    render(<HistoricoSection />);
    await waitFor(() => expect(getHistoricoCalls().length).toBeGreaterThanOrEqual(1));
    expect(await screen.findByText(/no hay/i)).toBeInTheDocument();
  });

  it("AC-11 (a11y): los selectores de rango tienen etiqueta accesible", async () => {
    render(<HistoricoSection />);
    await waitFor(() => expect(getHistoricoCalls().length).toBeGreaterThanOrEqual(1));
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it("AC-13: fallo de carga muestra mensaje amable + toast", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/historico\?/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "X", message: "y" });
      }
      return null;
    });
    render(<HistoricoSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
  });

  it("EC-4: varias fechas se agrupan en secciones separadas", async () => {
    render(<HistoricoSection />);
    await waitFor(() => expect(getHistoricoCalls().length).toBeGreaterThanOrEqual(1));
    // Dos encabezados de fecha distintos.
    const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
    expect(headings.some((h) => h.includes("2026-05-01"))).toBe(true);
    expect(headings.some((h) => h.includes("2026-05-02"))).toBe(true);
  });
});
