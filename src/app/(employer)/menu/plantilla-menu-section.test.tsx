// RED — Spec epic-8.5-menu/plantilla-menu.
// Plantilla del menú: tablero días×comidas por semana del ciclo (pestañas según
// periodicidad), celdas editables de descripción, guardado vía actualizarMenu
// (PUT /menu/entradas) con SOLO entradas válidas (semanas dentro del rango y
// comidas configuradas), realce "hoy" y a11y. Sin servidor: fetch mockeado.
// Consume el contrato SOLO por el cliente tipado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: (...a: unknown[]) => a,
  },
}));

import { PlantillaMenuSection } from "./plantilla-menu-section";

type Periodicidad = "SEMANAL" | "QUINCENAL" | "MENSUAL";
interface MenuEntrada {
  semana: number;
  diaSemana: string;
  comida: string;
  descripcion: string;
}
interface Menu {
  configuracion: { comidas: string[]; periodicidad: Periodicidad };
  entradas: MenuEntrada[];
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;

function installFetch(handler?: (url: string, method: string) => Response | null) {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    let body: unknown = undefined;
    if (init?.body) {
      try {
        const raw =
          init.body instanceof ArrayBuffer
            ? new TextDecoder().decode(init.body)
            : String(init.body);
        body = JSON.parse(raw);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method, body });
    if (handler) {
      const r = handler(url, method);
      if (r) return r;
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

function handlerMenu(menu: Menu) {
  return (url: string, method: string): Response | null => {
    if (/\/menu(?:\?|$)/.test(url) && method === "GET") {
      return jsonResponse(200, menu);
    }
    if (/\/menu\/entradas(?:\?|$)/.test(url) && method === "PUT") {
      const last = calls[calls.length - 1];
      return jsonResponse(200, last?.body ?? menu.entradas);
    }
    return null;
  };
}

const putEntradasCalls = () =>
  calls.filter((c) => c.method === "PUT" && /\/menu\/entradas/.test(c.url));

const MENU_SEMANAL: Menu = {
  configuracion: { comidas: ["Desayuno", "Almuerzo"], periodicidad: "SEMANAL" },
  entradas: [
    { semana: 0, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "Frijoles" },
    { semana: 0, diaSemana: "MARTES", comida: "Desayuno", descripcion: "Arepa" },
  ],
};

describe("PlantillaMenuSection (Spec plantilla-menu)", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    installFetch(handlerMenu(MENU_SEMANAL));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: renderiza el tablero con columnas = comidas y filas = días, con descripciones existentes", async () => {
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    const tabla = await screen.findByRole("table");
    const headers = within(tabla).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.join(" ")).toMatch(/Desayuno/i);
    expect(headers.join(" ")).toMatch(/Almuerzo/i);
    // Filas de días L–D presentes.
    expect(within(tabla).getByText(/Lunes/i)).toBeInTheDocument();
    expect(within(tabla).getByText(/Domingo/i)).toBeInTheDocument();
    // Descripción existente visible (en el valor de una celda editable).
    expect(screen.getByDisplayValue("Frijoles")).toBeInTheDocument();
  });

  it("AC-2: número de pestañas de semana = 1 para SEMANAL", async () => {
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByRole("table");
    expect(screen.getAllByRole("tab").length).toBe(1);
  });

  it("AC-2: número de pestañas de semana = 2 para QUINCENAL", async () => {
    installFetch(
      handlerMenu({
        configuracion: { comidas: ["Almuerzo"], periodicidad: "QUINCENAL" },
        entradas: [],
      }),
    );
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByRole("table");
    expect(screen.getAllByRole("tab").length).toBe(2);
  });

  it("AC-2: número de pestañas de semana = 4 para MENSUAL", async () => {
    installFetch(
      handlerMenu({
        configuracion: { comidas: ["Almuerzo"], periodicidad: "MENSUAL" },
        entradas: [],
      }),
    );
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByRole("table");
    expect(screen.getAllByRole("tab").length).toBe(4);
  });

  it("AC-3: cambiar de pestaña de semana muestra las entradas de esa semana", async () => {
    installFetch(
      handlerMenu({
        configuracion: { comidas: ["Almuerzo"], periodicidad: "QUINCENAL" },
        entradas: [
          { semana: 0, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "SemanaCero" },
          { semana: 1, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "SemanaUno" },
        ],
      }),
    );
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByDisplayValue("SemanaCero");
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[1]);
    await waitFor(() =>
      expect(screen.getByDisplayValue("SemanaUno")).toBeInTheDocument(),
    );
  });

  it("AC-4/AC-7: editar una celda y guardar llama a actualizarMenu con la entrada y muestra éxito", async () => {
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByRole("table");
    const celda = screen.getByLabelText(/lunes.*desayuno|desayuno.*lunes/i);
    fireEvent.change(celda, { target: { value: "Huevos pericos" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar.*men|guardar plantilla/i }));
    await waitFor(() => expect(putEntradasCalls().length).toBe(1));
    const body = putEntradasCalls()[0].body as MenuEntrada[];
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          semana: 0,
          diaSemana: "LUNES",
          comida: "Desayuno",
          descripcion: "Huevos pericos",
        }),
      ]),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("AC-5: el body solo contiene semanas válidas y comidas configuradas", async () => {
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /guardar.*men|guardar plantilla/i }));
    await waitFor(() => expect(putEntradasCalls().length).toBe(1));
    const body = putEntradasCalls()[0].body as MenuEntrada[];
    for (const e of body) {
      expect(e.semana).toBeGreaterThanOrEqual(0);
      expect(e.semana).toBeLessThanOrEqual(0); // SEMANAL ⇒ solo semana 0
      expect(["Desayuno", "Almuerzo"]).toContain(e.comida);
    }
  });

  it("AC-6: entradas de comidas no configuradas / semanas fuera de rango se descartan", async () => {
    installFetch(
      handlerMenu({
        configuracion: { comidas: ["Almuerzo"], periodicidad: "SEMANAL" },
        entradas: [
          { semana: 0, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "Valida" },
          // comida no configurada ⇒ debe descartarse
          { semana: 0, diaSemana: "LUNES", comida: "Cena", descripcion: "Invalida" },
          // semana fuera de rango para SEMANAL ⇒ debe descartarse
          { semana: 2, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "FueraRango" },
        ],
      }),
    );
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByDisplayValue("Valida");
    fireEvent.click(screen.getByRole("button", { name: /guardar.*men|guardar plantilla/i }));
    await waitFor(() => expect(putEntradasCalls().length).toBe(1));
    const body = putEntradasCalls()[0].body as MenuEntrada[];
    expect(body.some((e) => e.comida === "Cena")).toBe(false);
    expect(body.some((e) => e.semana === 2)).toBe(false);
    expect(body.some((e) => e.descripcion === "Valida")).toBe(true);
  });

  it("AC-8: fallo de guardado muestra toast de error y conserva las ediciones", async () => {
    installFetch((url, method) => {
      if (/\/menu\/entradas/.test(url) && method === "PUT") {
        return jsonResponse(422, { code: "INVALIDO", message: "x" });
      }
      return handlerMenu(MENU_SEMANAL)(url, method);
    });
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByRole("table");
    const celda = screen.getByLabelText(/lunes.*desayuno|desayuno.*lunes/i);
    fireEvent.change(celda, { target: { value: "Cambio" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar.*men|guardar plantilla/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByDisplayValue("Cambio")).toBeInTheDocument();
  });

  it("AC-9 (hoy): resalta la fila del día actual en la semana visible (aria-current)", async () => {
    render(<PlantillaMenuSection diaHoy="MARTES" />);
    const tabla = await screen.findByRole("table");
    const filaActual = within(tabla)
      .getAllByRole("row")
      .find((r) => r.getAttribute("aria-current") != null);
    expect(filaActual).toBeDefined();
    expect(filaActual?.textContent).toMatch(/Martes/i);
  });

  it("AC-10 (a11y): tabla con encabezados de columna y celdas con nombre accesible", async () => {
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    const tabla = await screen.findByRole("table");
    expect(within(tabla).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByLabelText(/lunes.*desayuno|desayuno.*lunes/i),
    ).toBeInTheDocument();
  });

  it("AC-11 (vacío): sin comidas configuradas no renderiza tabla editable sino una guía", async () => {
    installFetch(
      handlerMenu({
        configuracion: { comidas: [], periodicidad: "SEMANAL" },
        entradas: [],
      }),
    );
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    expect(
      await screen.findByText(/configura.*comida|agrega.*comida|sin comidas/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("EC-1: celda en blanco no se incluye en el body", async () => {
    render(<PlantillaMenuSection diaHoy="LUNES" />);
    await screen.findByDisplayValue("Frijoles");
    fireEvent.change(screen.getByDisplayValue("Frijoles"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /guardar.*men|guardar plantilla/i }));
    await waitFor(() => expect(putEntradasCalls().length).toBe(1));
    const body = putEntradasCalls()[0].body as MenuEntrada[];
    expect(
      body.some((e) => e.diaSemana === "LUNES" && e.comida === "Almuerzo"),
    ).toBe(false);
  });
});
