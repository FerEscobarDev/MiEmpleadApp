// RED — Spec epic-8.7-consulta-empleada/pago-menu-tabs (pestaña Menú).
// obtenerMenu (con X-Acceso-Token) → "qué preparar hoy" destacado + tablero
// semanal en SOLO LECTURA (sin inputs editables). RTL + fetch mockeado.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { createConsultaClient } from "./consulta-client";
import { MenuTab } from "./menu-tab";

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

function tokenFrom(init?: RequestInit): string | null {
  const h = init?.headers;
  if (h instanceof Headers) return h.get("X-Acceso-Token");
  if (h) {
    const rec = h as Record<string, string>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === "x-acceso-token");
    return key ? rec[key] : null;
  }
  return null;
}

function installFetch(handler: (url: string, method: string) => Response | null) {
  calls = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, token: tokenFrom(init) });
    return handler(url, method) ?? new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

// 3 de junio de 2026 = miércoles.
const HOY = new Date(2026, 5, 3);

const MENU = {
  configuracion: { comidas: ["Desayuno", "Almuerzo"], periodicidad: "SEMANAL" },
  entradas: [
    { semana: 0, diaSemana: "MIERCOLES", comida: "Almuerzo", descripcion: "Sancocho de gallina" },
    { semana: 0, diaSemana: "LUNES", comida: "Desayuno", descripcion: "Huevos pericos" },
  ],
};

function handlerMenu(body: unknown, status = 200) {
  return (url: string, method: string): Response | null => {
    if (/\/menu(\?|$)/.test(url) && method === "GET") {
      return jsonResponse(status, body);
    }
    return null;
  };
}

const getMenuCalls = () =>
  calls.filter((c) => c.method === "GET" && /\/menu(\?|$)/.test(c.url));

describe("MenuTab (Spec pago-menu-tabs — Menú)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("AC-7: al montar llama a obtenerMenu con el header X-Acceso-Token", async () => {
    installFetch(handlerMenu(MENU));
    render(<MenuTab client={createConsultaClient("tok-9")} hoy={HOY} />);
    await waitFor(() => expect(getMenuCalls().length).toBeGreaterThanOrEqual(1));
    expect(getMenuCalls()[0].token).toBe("tok-9");
  });

  it("AC-8: destaca qué preparar hoy (miércoles) y muestra el tablero", async () => {
    installFetch(handlerMenu(MENU));
    render(<MenuTab client={createConsultaClient("tok-9")} hoy={HOY} />);
    // "qué preparar hoy" muestra la comida del miércoles (aparece en la tarjeta de
    // hoy y en el tablero ⇒ al menos una coincidencia).
    const matches = await screen.findAllByText(/sancocho de gallina/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("AC-8: el tablero es de solo lectura (sin inputs editables)", async () => {
    installFetch(handlerMenu(MENU));
    const { container } = render(<MenuTab client={createConsultaClient("tok-9")} hoy={HOY} />);
    await screen.findAllByText(/sancocho de gallina/i);
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("AC-9: muestra Skeleton mientras carga", () => {
    installFetch(handlerMenu(MENU));
    const { container } = render(<MenuTab client={createConsultaClient("tok-9")} hoy={HOY} />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-9: fallo de carga muestra mensaje amable y no deja Skeleton", async () => {
    installFetch(handlerMenu({ code: "ERROR_INTERNO", message: "x" }, 500));
    const { container } = render(<MenuTab client={createConsultaClient("tok-9")} hoy={HOY} />);
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
  });

  it("EC-2: sin entradas para hoy indica que no hay nada definido", async () => {
    const sinHoy = {
      configuracion: { comidas: ["Desayuno"], periodicidad: "SEMANAL" },
      entradas: [{ semana: 0, diaSemana: "LUNES", comida: "Desayuno", descripcion: "Café" }],
    };
    installFetch(handlerMenu(sinHoy));
    render(<MenuTab client={createConsultaClient("tok-9")} hoy={HOY} />);
    expect(await screen.findByText(/nada (definido|programado)|sin men[uú] para hoy/i)).toBeInTheDocument();
  });
});
