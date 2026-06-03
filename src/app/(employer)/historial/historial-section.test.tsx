// RED — Spec epic-8.4-historial/listado-meses.
// Listado de meses liquidados: carga vía listarLiquidaciones (GET /liquidaciones),
// render de filas (mes-año, estado Badge, total COP) ordenadas de más reciente a más
// antiguo, enlaces al detalle, EmptyState sin datos, Skeleton al cargar, error amable.
// Sin servidor: fetch mockeado. Consume el contrato SOLO por el cliente tipado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => a,
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { HistorialSection } from "./historial-section";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface LiquidacionResumen {
  anio: number;
  mes: number;
  estado: "BORRADOR" | "CERRADA";
  total: number;
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
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const okList = (lista: LiquidacionResumen[]) =>
  (url: string, method: string): Response | null => {
    if (/\/liquidaciones(?:\?|$)/.test(url) && method === "GET") {
      return jsonResponse(200, lista);
    }
    return null;
  };

const getCalls = (fragment: string) =>
  calls.filter((c) => c.method === "GET" && c.url.includes(fragment));

const EJEMPLO: LiquidacionResumen[] = [
  { anio: 2026, mes: 3, estado: "CERRADA", total: 700000 },
  { anio: 2026, mes: 5, estado: "BORRADOR", total: 736152 },
  { anio: 2025, mes: 12, estado: "CERRADA", total: 650000 },
];

describe("HistorialSection (Spec listado-meses)", () => {
  beforeEach(() => {
    toastError.mockReset();
    installFetch(okList(EJEMPLO));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: al montar llama a listarLiquidaciones (GET /liquidaciones)", async () => {
    render(<HistorialSection />);
    await waitFor(() => expect(getCalls("/liquidaciones").length).toBeGreaterThanOrEqual(1));
  });

  it("AC-2: muestra estado de carga (Skeleton) y no la tabla mientras carga", () => {
    const { container } = render(<HistorialSection />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-3: renderiza una fila por mes con mes-año, estado y total en COP", async () => {
    render(<HistorialSection />);
    expect(await screen.findByText(/Mayo 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Marzo 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Diciembre 2025/i)).toBeInTheDocument();
    // Estado como Badge textual.
    expect(screen.getAllByText(/Cerrada/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Borrador/i)).toBeInTheDocument();
    // Total formateado en COP (separador de miles).
    expect(screen.getByText(/736\.152/)).toBeInTheDocument();
  });

  it("AC-4: ordena de más reciente a más antiguo (año desc, mes desc)", async () => {
    render(<HistorialSection />);
    await screen.findByText(/Mayo 2026/i);
    const filas = screen.getAllByRole("row");
    // Primera fila de datos = encabezado en filas[0]; los datos empiezan en filas[1].
    const textos = filas.map((f) => f.textContent ?? "");
    const idxMayo = textos.findIndex((t) => /Mayo 2026/i.test(t));
    const idxMarzo = textos.findIndex((t) => /Marzo 2026/i.test(t));
    const idxDic = textos.findIndex((t) => /Diciembre 2025/i.test(t));
    expect(idxMayo).toBeLessThan(idxMarzo);
    expect(idxMarzo).toBeLessThan(idxDic);
  });

  it("AC-5: cada fila enlaza al detalle /historial/{anio}/{mes}", async () => {
    render(<HistorialSection />);
    const link = await screen.findByRole("link", { name: /Mayo 2026/i });
    expect(link).toHaveAttribute("href", "/historial/2026/5");
  });

  it("AC-6: lista vacía muestra EmptyState y no la tabla", async () => {
    installFetch(okList([]));
    render(<HistorialSection />);
    expect(await screen.findByText(/no hay meses|sin meses|aún no/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC-7: error inesperado (500) muestra mensaje amable y toast, sin Skeleton infinito", async () => {
    installFetch((url, method) => {
      if (/\/liquidaciones(?:\?|$)/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "ERROR", message: "x" });
      }
      return null;
    });
    const { container } = render(<HistorialSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/No pudimos cargar/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("AC-8 (a11y): expone semántica de tabla accesible con encabezados", async () => {
    render(<HistorialSection />);
    const tabla = await screen.findByRole("table");
    expect(tabla).toBeInTheDocument();
    expect(within(tabla).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(1);
  });

  it("EC-1: total 0 se muestra como $ 0", async () => {
    installFetch(okList([{ anio: 2026, mes: 1, estado: "CERRADA", total: 0 }]));
    render(<HistorialSection />);
    await screen.findByText(/Enero 2026/i);
    expect(screen.getByText(/\$\s?0/)).toBeInTheDocument();
  });

  it("EC-3: un solo elemento renderiza exactamente una fila de datos", async () => {
    installFetch(okList([{ anio: 2026, mes: 4, estado: "BORRADOR", total: 500000 }]));
    render(<HistorialSection />);
    await screen.findByText(/Abril 2026/i);
    // 1 fila de encabezado + 1 de datos.
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});
