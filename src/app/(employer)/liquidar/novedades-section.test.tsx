// RED — Spec epic-8.3-liquidar-mes/novedades.
// Registro de novedades del borrador: marcar/desmarcar inasistencias en el calendario,
// ajustar cantidades de items (listarItemsAdicionales), montos puntuales y notas, todo
// vía actualizarLiquidacion. 409 INASISTENCIA_INVALIDA / LIQUIDACION_CERRADA → mensaje
// amable. Edición deshabilitada cuando CERRADA. Sin servidor: fetch mockeado.
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

interface Item {
  id: string;
  nombre: string;
  valorUnitario: number;
  color?: string | null;
  activo: boolean;
}

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

let calls: { url: string; method: string; body?: unknown }[];
let fetchMock: ReturnType<typeof vi.fn>;

function parseBody(init?: RequestInit): unknown {
  if (init?.body == null) return undefined;
  try {
    const text =
      typeof init.body === "string"
        ? init.body
        : new TextDecoder().decode(init.body as ArrayBuffer);
    return JSON.parse(text);
  } catch {
    return init.body;
  }
}

const ITEMS: Item[] = [
  { id: "i1", nombre: "Noche acompañamiento", valorUnitario: 20000, activo: true },
  { id: "i2", nombre: "Hora extra diurna", valorUnitario: 5000, activo: true },
];

function liquidacion(
  estado: "BORRADOR" | "CERRADA",
  overrides: Partial<Liquidacion> = {},
): Liquidacion {
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
    calendario: [
      { fecha: "2026-05-01", tipo: "TRABAJADO" },
      { fecha: "2026-05-02", tipo: "INASISTENCIA" },
      { fecha: "2026-05-03", tipo: "FESTIVO" },
    ],
    inasistencias: ["2026-05-02"],
    items: [],
    montosPuntuales: [],
    notas: estado === "CERRADA" ? null : "",
    ...overrides,
  };
}

function installFetch(opts: {
  estado?: "BORRADOR" | "CERRADA";
  items?: Item[];
  putHandler?: (body: unknown) => Response | null;
} = {}) {
  const estado = opts.estado ?? "BORRADOR";
  const items = opts.items ?? ITEMS;
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    const body = parseBody(init);
    calls.push({ url, method, body });
    if (url.includes("/items-adicionales") && method === "GET") {
      return jsonResponse(200, items);
    }
    const m = url.match(/\/liquidaciones\/(\d+)\/(\d+)(?:\?|$)/);
    if (m && method === "GET") {
      return jsonResponse(200, liquidacion(estado));
    }
    if (m && method === "PUT") {
      if (opts.putHandler) {
        const r = opts.putHandler(body);
        if (r) return r;
      }
      // Respuesta recalculada: refleja un total distinto para verificar refresco.
      return jsonResponse(200, liquidacion(estado, {
        desglose: { ...liquidacion(estado).desglose, total: 700000 },
      }));
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const callsTo = (method: string, fragment: string) =>
  calls.filter((c) => c.method === method && c.url.includes(fragment));

describe("LiquidarMesSection — novedades (Spec novedades)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: marcar un día no-inasistencia llama a actualizarLiquidacion incluyéndolo en inasistencias", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    // El día 1 (TRABAJADO) tiene aria-label con "1 de mayo — Trabajado".
    const dia1 = await screen.findByRole("gridcell", { name: /^1 de mayo/i });
    await userEvent.click(dia1);
    await waitFor(() => expect(callsTo("PUT", "/liquidaciones/2026/5").length).toBe(1));
    const sent = callsTo("PUT", "/liquidaciones/2026/5")[0].body as {
      inasistencias?: string[];
    };
    expect(sent.inasistencias).toContain("2026-05-01");
  });

  it("AC-1: tras actualizar, el total mostrado se refresca con la respuesta", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const dia1 = await screen.findByRole("gridcell", { name: /^1 de mayo/i });
    await userEvent.click(dia1);
    await waitFor(() => {
      const total = screen.getByTestId("liquidacion-total");
      expect(total.textContent).toMatch(/700\.000/);
    });
  });

  it("AC-2: tocar un día que ya es inasistencia lo desmarca (ausente del PUT)", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const dia2 = await screen.findByRole("gridcell", { name: /^2 de mayo/i });
    await userEvent.click(dia2);
    await waitFor(() => expect(callsTo("PUT", "/liquidaciones/2026/5").length).toBe(1));
    const sent = callsTo("PUT", "/liquidaciones/2026/5")[0].body as {
      inasistencias?: string[];
    };
    expect(sent.inasistencias).not.toContain("2026-05-02");
  });

  it("AC-3: 409 INASISTENCIA_INVALIDA muestra mensaje amable y no cambia el calendario", async () => {
    installFetch({ putHandler: () => errorJson(409, "INASISTENCIA_INVALIDA") });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const dia3 = await screen.findByRole("gridcell", { name: /^3 de mayo/i });
    await userEvent.click(dia3);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(
      screen.getByText(/no admite inasistencia|no es válida para inasistencia|no se puede registrar inasistencia/i),
    ).toBeInTheDocument();
  });

  it("AC-4: el panel de items se puebla desde listarItemsAdicionales y guardar cantidad envía items", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(await screen.findByText(/Noche acompañamiento/i)).toBeInTheDocument();
    const cantidad = screen.getByLabelText(/Cantidad de Noche acompañamiento/i);
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, "2");
    await userEvent.click(screen.getByRole("button", { name: /Guardar items|Guardar novedades/i }));
    await waitFor(() => expect(callsTo("PUT", "/liquidaciones/2026/5").length).toBeGreaterThanOrEqual(1));
    const sent = callsTo("PUT", "/liquidaciones/2026/5").at(-1)!.body as {
      items?: { itemId: string; cantidad: number }[];
    };
    expect(sent.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemId: "i1", cantidad: 2 })]),
    );
  });

  it("AC-5: agregar un monto puntual envía montosPuntuales", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    await screen.findByLabelText(/Leyenda del calendario/i);
    await userEvent.type(screen.getByLabelText(/Descripción del monto/i), "Bono");
    await userEvent.type(screen.getByLabelText(/Monto puntual/i), "50000");
    await userEvent.click(screen.getByRole("button", { name: /Agregar monto/i }));
    await waitFor(() => expect(callsTo("PUT", "/liquidaciones/2026/5").length).toBeGreaterThanOrEqual(1));
    const sent = callsTo("PUT", "/liquidaciones/2026/5").at(-1)!.body as {
      montosPuntuales?: { descripcion: string; monto: number }[];
    };
    expect(sent.montosPuntuales).toEqual(
      expect.arrayContaining([expect.objectContaining({ descripcion: "Bono", monto: 50000 })]),
    );
  });

  it("AC-6: editar las notas y guardar envía notas", async () => {
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const notas = await screen.findByLabelText(/Notas/i);
    await userEvent.type(notas, "Pago en efectivo");
    await userEvent.click(screen.getByRole("button", { name: /Guardar notas/i }));
    await waitFor(() => expect(callsTo("PUT", "/liquidaciones/2026/5").length).toBeGreaterThanOrEqual(1));
    const sent = callsTo("PUT", "/liquidaciones/2026/5").at(-1)!.body as { notas?: string };
    expect(sent.notas).toContain("Pago en efectivo");
  });

  it("AC-7: en estado CERRADA, marcar un día no dispara escritura", async () => {
    installFetch({ estado: "CERRADA" });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const dia1 = await screen.findByRole("gridcell", { name: /^1 de mayo/i });
    await userEvent.click(dia1);
    // Espera un tick; no debe haber PUT.
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo("PUT", "/liquidaciones/2026/5").length).toBe(0);
  });

  it("AC-7: en estado CERRADA, el campo de notas está deshabilitado", async () => {
    installFetch({ estado: "CERRADA" });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const notas = await screen.findByLabelText(/Notas/i);
    expect(notas).toBeDisabled();
  });

  it("AC-8: 409 LIQUIDACION_CERRADA muestra mensaje amable de mes cerrado", async () => {
    installFetch({ putHandler: () => errorJson(409, "LIQUIDACION_CERRADA") });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const dia1 = await screen.findByRole("gridcell", { name: /^1 de mayo/i });
    await userEvent.click(dia1);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByText(/mes (ya )?(está )?cerrad/i)).toBeInTheDocument();
  });

  it("EC-1: sin items, el panel de items muestra un estado vacío y no rompe la página", async () => {
    installFetch({ items: [] });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    expect(await screen.findByLabelText(/Leyenda del calendario/i)).toBeInTheDocument();
    expect(screen.getByText(/No hay items/i)).toBeInTheDocument();
  });

  it("EC-2: un 500 en actualizarLiquidacion muestra toast de error y conserva el total previo", async () => {
    installFetch({ putHandler: () => errorJson(500, "ERROR") });
    render(<LiquidarMesSection anioInicial={2026} mesInicial={5} />);
    const dia1 = await screen.findByRole("gridcell", { name: /^1 de mayo/i });
    await userEvent.click(dia1);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const total = screen.getByTestId("liquidacion-total");
    expect(total.textContent).toMatch(/646\.152/);
  });
});
