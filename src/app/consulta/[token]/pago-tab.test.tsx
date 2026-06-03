// RED — Spec epic-8.7-consulta-empleada/pago-menu-tabs (pestaña Pago).
// Selector de mes (actual por defecto) → obtenerLiquidacion (con X-Acceso-Token) →
// MonthCalendar + desglose con total en COP. NUNCA muestra notas (RN-12, AC-4).
// RTL + fetch mockeado; I/O por el cliente de consulta (header inyectado).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { createConsultaClient } from "./consulta-client";
import { PagoTab } from "./pago-tab";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface Call {
  url: string;
  method: string;
  token: string | null;
}
let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;

function tokenFrom(init?: RequestInit): string | null {
  const h = init?.headers;
  if (h instanceof Headers) return h.get("X-Acceso-Token");
  if (Array.isArray(h)) {
    const f = h.find(([k]) => k.toLowerCase() === "x-acceso-token");
    return f ? f[1] : null;
  }
  if (h) {
    const rec = h as Record<string, string>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === "x-acceso-token");
    return key ? rec[key] : null;
  }
  return null;
}

function installFetch(handler: (url: string, method: string) => Response | null) {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, token: tokenFrom(init) });
    const r = handler(url, method);
    return r ?? new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const HOY = new Date(2026, 5, 3); // junio (mes 6) de 2026

const DESGLOSE = {
  diasLaboralesMes: 26,
  festivosEnDiaLaboral: 1,
  diasTrabajados: 25,
  valorDia: 30000,
  subtotalDias: 750000,
  subtotalItems: 0,
  subtotalMontosPuntuales: 0,
  total: 750000,
};

function liquidacion(extra: Record<string, unknown> = {}) {
  return {
    anio: 2026,
    mes: 6,
    estado: "BORRADOR",
    desglose: DESGLOSE,
    calendario: [
      { fecha: "2026-06-01", tipo: "TRABAJADO" },
      { fecha: "2026-06-02", tipo: "INASISTENCIA" },
    ],
    inasistencias: ["2026-06-02"],
    items: [],
    montosPuntuales: [],
    ...extra,
  };
}

function handlerLiq(body: Record<string, unknown>, status = 200) {
  return (url: string, method: string): Response | null => {
    if (/\/liquidaciones\/\d+\/\d+/.test(url) && method === "GET") {
      return jsonResponse(status, body);
    }
    return null;
  };
}

const getLiqCalls = () =>
  calls.filter((c) => c.method === "GET" && /\/liquidaciones\/\d+\/\d+/.test(c.url));

describe("PagoTab (Spec pago-menu-tabs — Pago)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("AC-1/AC-10: al montar carga obtenerLiquidacion del mes actual con X-Acceso-Token", async () => {
    installFetch(handlerLiq(liquidacion()));
    render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    await waitFor(() => expect(getLiqCalls().length).toBeGreaterThanOrEqual(1));
    expect(getLiqCalls()[0].url).toContain("/liquidaciones/2026/6");
    expect(getLiqCalls()[0].token).toBe("tok-1");
  });

  it("AC-2: cambiar el mes recarga obtenerLiquidacion con el nuevo año/mes", async () => {
    installFetch(handlerLiq(liquidacion()));
    render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    await waitFor(() => expect(getLiqCalls().length).toBeGreaterThanOrEqual(1));
    const selector = screen.getByLabelText(/mes/i);
    fireEvent.change(selector, { target: { value: "2026-05" } });
    await waitFor(() =>
      expect(getLiqCalls().some((c) => c.url.includes("/liquidaciones/2026/5"))).toBe(true),
    );
  });

  it("AC-3: renderiza calendario (leyenda) y el total en COP", async () => {
    installFetch(handlerLiq(liquidacion()));
    render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    expect(await screen.findByLabelText(/leyenda del calendario/i)).toBeInTheDocument();
    // El total 750.000 puede aparecer también como subtotal por días ⇒ al menos uno.
    const montos = await screen.findAllByText(/\$\s?750\.000/);
    expect(montos.length).toBeGreaterThanOrEqual(1);
  });

  it("AC-4 (RN-12): aunque la respuesta traiga notas, el texto secreto NO aparece", async () => {
    installFetch(handlerLiq(liquidacion({ notas: "secreto-del-empleador" })));
    render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    await screen.findByLabelText(/leyenda del calendario/i);
    expect(screen.queryByText(/secreto-del-empleador/)).not.toBeInTheDocument();
  });

  it("AC-5: muestra Skeleton mientras carga", () => {
    installFetch(handlerLiq(liquidacion()));
    const { container } = render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-5: fallo de carga muestra mensaje amable y no deja Skeleton", async () => {
    installFetch((url, method) => {
      if (/\/liquidaciones\/\d+\/\d+/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "ERROR_INTERNO", message: "x" });
      }
      return null;
    });
    const { container } = render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
  });

  it("AC-6: mes fuera de contrato (409) muestra mensaje amable de sin datos", async () => {
    installFetch(handlerLiq({ code: "MES_FUERA_DE_CONTRATO", message: "x" }, 409));
    render(<PagoTab client={createConsultaClient("tok-1")} hoy={HOY} />);
    expect(await screen.findByText(/sin datos|no hay datos|fuera de contrato/i)).toBeInTheDocument();
  });
});
