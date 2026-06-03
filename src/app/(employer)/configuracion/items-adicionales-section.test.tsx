// RED — Spec epic-8.2-configuracion/items-adicionales.
// CRUD de items de pago adicional dentro de /configuracion: carga la lista
// (listarItemsAdicionales), crea (crearItemAdicional), edita (actualizarItemAdicional)
// y elimina (eliminarItemAdicional) por el cliente tipado. Sin servidor: fetch mockeado.
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

import { ItemsAdicionalesSection } from "./items-adicionales-section";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const noContent = (status: number) => new Response(null, { status });
const errorJson = (status: number, code: string) => jsonResponse(status, { code, message: "x" });

interface Item {
  id: string;
  nombre: string;
  valorUnitario: number;
  color?: string | null;
  activo: boolean;
}

let listResponses: Item[][];
let listIndex: number;
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

function installFetch() {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: parseBody(init) });
    if (url.includes("/items-adicionales")) {
      // GET lista
      if (method === "GET") {
        const idx = Math.min(listIndex, listResponses.length - 1);
        listIndex += 1;
        return jsonResponse(200, listResponses[idx]);
      }
      if (method === "POST") return jsonResponse(201, { id: "nuevo", nombre: "x", valorUnitario: 1, activo: true });
      if (method === "PUT") return jsonResponse(200, { id: "i1", nombre: "x", valorUnitario: 1, activo: true });
      if (method === "DELETE") return noContent(204);
    }
    return noContent(404);
  });
  vi.stubGlobal("fetch", fetchMock);
}

const callsTo = (method: string, fragment: string) =>
  calls.filter((c) => c.method === method && c.url.includes(fragment));

const itemsBase: Item[] = [
  { id: "i1", nombre: "Noche acompañamiento", valorUnitario: 20000, color: "#DB2777", activo: true },
  { id: "i2", nombre: "Hora extra diurna", valorUnitario: 5000, color: null, activo: true },
];

describe("ItemsAdicionalesSection (Spec items-adicionales)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    listResponses = [itemsBase];
    listIndex = 0;
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-2: muestra Skeleton mientras carga la lista", () => {
    const { container } = render(<ItemsAdicionalesSection />);
    expect(container.querySelector('[aria-hidden="true"].animate-pulse')).not.toBeNull();
  });

  it("AC-1: carga y renderiza los items (nombre + valor COP)", async () => {
    render(<ItemsAdicionalesSection />);
    expect(await screen.findByText(/Noche acompañamiento/i)).toBeInTheDocument();
    expect(screen.getByText(/Hora extra diurna/i)).toBeInTheDocument();
    // Valor formateado en COP (es-CO, sin decimales): $ 20.000 (separador de miles).
    expect(screen.getByText(/20\.000/)).toBeInTheDocument();
    expect(callsTo("GET", "/items-adicionales").length).toBeGreaterThanOrEqual(1);
  });

  it("AC-3: lista vacía muestra EmptyState con acción para agregar", async () => {
    listResponses = [[]];
    render(<ItemsAdicionalesSection />);
    expect(await screen.findByText(/No hay items/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar/i })).toBeInTheDocument();
  });

  it("AC-4/AC-7: crear un item invoca crearItemAdicional (POST) y refresca la lista", async () => {
    // Tras crear, la siguiente lista incluye el nuevo item.
    const conNuevo: Item = { id: "i3", nombre: "Bono extra", valorUnitario: 30000, activo: true };
    listResponses = [itemsBase, [...itemsBase, conNuevo]];
    render(<ItemsAdicionalesSection />);
    await screen.findByText(/Noche acompañamiento/i);
    await userEvent.click(screen.getByRole("button", { name: /Agregar item/i }));
    await userEvent.type(await screen.findByLabelText(/Nombre/i), "Bono extra");
    await userEvent.type(screen.getByLabelText(/Valor/i), "30000");
    await userEvent.click(screen.getByRole("button", { name: /^Crear$|Guardar item/i }));
    await waitFor(() => expect(callsTo("POST", "/items-adicionales").length).toBe(1));
    const sent = callsTo("POST", "/items-adicionales")[0].body as Record<string, unknown>;
    expect(sent.nombre).toBe("Bono extra");
    expect(sent.valorUnitario).toBe(30000);
    // Refresca la lista (≥2 GET en total).
    await waitFor(() => expect(callsTo("GET", "/items-adicionales").length).toBeGreaterThanOrEqual(2));
  });

  it("AC-5: editar un item invoca actualizarItemAdicional (PUT /items-adicionales/{id})", async () => {
    render(<ItemsAdicionalesSection />);
    await screen.findByText(/Noche acompañamiento/i);
    // Abrir el editor del primer item: el botón de editar tiene como nombre
    // accesible EXACTAMENTE el nombre del item (anclado para no chocar con el
    // botón "Eliminar Noche acompañamiento", que contiene el nombre como subcadena).
    await userEvent.click(screen.getByRole("button", { name: /^Noche acompañamiento$/i }));
    const nombre = await screen.findByLabelText(/Nombre/i);
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Noche acomp. nueva");
    await userEvent.click(screen.getByRole("button", { name: /^Guardar/i }));
    await waitFor(() => expect(callsTo("PUT", "/items-adicionales/i1").length).toBe(1));
  });

  it("AC-6: eliminar un item invoca eliminarItemAdicional (DELETE /items-adicionales/{id})", async () => {
    listResponses = [itemsBase, [itemsBase[1]]];
    render(<ItemsAdicionalesSection />);
    await screen.findByText(/Noche acompañamiento/i);
    await userEvent.click(screen.getByRole("button", { name: /Eliminar Noche acompañamiento/i }));
    await waitFor(() => expect(callsTo("DELETE", "/items-adicionales/i1").length).toBe(1));
  });

  it("AC-8: un 422 al crear muestra Toast de error y mantiene el formulario", async () => {
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      calls.push({ url, method, body: parseBody(init) });
      if (url.includes("/items-adicionales") && method === "GET") return jsonResponse(200, itemsBase);
      if (url.includes("/items-adicionales") && method === "POST") return errorJson(422, "VALIDACION");
      return noContent(404);
    });
    render(<ItemsAdicionalesSection />);
    await screen.findByText(/Noche acompañamiento/i);
    await userEvent.click(screen.getByRole("button", { name: /Agregar item/i }));
    await userEvent.type(await screen.findByLabelText(/Nombre/i), "X");
    await userEvent.type(screen.getByLabelText(/Valor/i), "10");
    await userEvent.click(screen.getByRole("button", { name: /^Crear$|Guardar item/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // El formulario sigue abierto (el campo Nombre permanece).
    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
  });

  it("EC-1: si la carga de la lista falla muestra error y no Skeleton infinito", async () => {
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });
      if (url.includes("/items-adicionales") && method === "GET") return errorJson(500, "ERROR");
      return noContent(404);
    });
    render(<ItemsAdicionalesSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/No pudimos cargar/i)).toBeInTheDocument();
  });
});
