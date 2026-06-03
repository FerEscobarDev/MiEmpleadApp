// RED — Spec epic-8.5-menu/configuracion-menu.
// Configuración del menú: carga vía obtenerMenu (GET /menu); edición de comidas
// (agregar/renombrar/quitar) y periodicidad (Semanal/Quincenal/Mensual); guardado
// vía actualizarConfiguracionMenu (PUT /menu/configuracion). Estados loading/empty/
// error + a11y. Sin servidor: fetch mockeado. Consume el contrato SOLO por el
// cliente tipado.
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

import { ConfiguracionMenuSection } from "./configuracion-menu-section";

type Periodicidad = "SEMANAL" | "QUINCENAL" | "MENSUAL";
interface MenuConfig {
  comidas: string[];
  periodicidad: Periodicidad;
}
interface MenuEntrada {
  semana: number;
  diaSemana: string;
  comida: string;
  descripcion: string;
}
interface Menu {
  configuracion: MenuConfig;
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

const MENU_EJEMPLO: Menu = {
  configuracion: { comidas: ["Desayuno", "Almuerzo", "Cena"], periodicidad: "SEMANAL" },
  entradas: [
    { semana: 0, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "Frijoles" },
  ],
};

function handlerMenu(menu: Menu = MENU_EJEMPLO) {
  return (url: string, method: string): Response | null => {
    if (/\/menu(?:\?|$)/.test(url) && method === "GET") {
      return jsonResponse(200, menu);
    }
    if (/\/menu\/configuracion(?:\?|$)/.test(url) && method === "PUT") {
      const last = calls[calls.length - 1];
      return jsonResponse(200, last?.body ?? menu.configuracion);
    }
    return null;
  };
}

const getCalls = (fragment: string) =>
  calls.filter((c) => c.method === "GET" && c.url.includes(fragment));
const putConfigCalls = () =>
  calls.filter((c) => c.method === "PUT" && /\/menu\/configuracion/.test(c.url));

describe("ConfiguracionMenuSection (Spec configuracion-menu)", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    installFetch(handlerMenu());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: al montar llama a obtenerMenu (GET /menu)", async () => {
    render(<ConfiguracionMenuSection />);
    await waitFor(() =>
      expect(getCalls("/menu").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("AC-2: muestra estado de carga (Skeleton) y no el formulario mientras carga", () => {
    const { container } = render(<ConfiguracionMenuSection />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-3: tras cargar renderiza las comidas configuradas y la periodicidad actual", async () => {
    render(<ConfiguracionMenuSection />);
    await waitFor(() => expect(getCalls("/menu").length).toBeGreaterThanOrEqual(1));
    // Una entrada editable por comida con su valor actual.
    expect(await screen.findByDisplayValue("Desayuno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Almuerzo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cena")).toBeInTheDocument();
    // Periodicidad: opción Semanal marcada como activa/seleccionada.
    const semanal = screen.getByRole("radio", { name: /semanal/i });
    expect(semanal).toBeChecked();
  });

  it("AC-4: agregar una comida añade un campo editable nuevo sin llamar al backend", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Desayuno");
    const antes = screen.getAllByLabelText(/comida/i).length;
    fireEvent.click(screen.getByRole("button", { name: /agregar comida/i }));
    await waitFor(() =>
      expect(screen.getAllByLabelText(/comida/i).length).toBe(antes + 1),
    );
    expect(putConfigCalls().length).toBe(0);
  });

  it("AC-5: quitar una comida la elimina de la lista sin llamar al backend", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Cena");
    fireEvent.click(screen.getByRole("button", { name: /quitar.*cena/i }));
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Cena")).not.toBeInTheDocument(),
    );
    expect(putConfigCalls().length).toBe(0);
  });

  it("AC-6: cambiar la periodicidad actualiza la selección y expone el número de semanas", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Desayuno");
    fireEvent.click(screen.getByRole("radio", { name: /mensual/i }));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /mensual/i })).toBeChecked(),
    );
    // Expone 4 semanas para Mensual (texto visible que lo comunique).
    expect(screen.getByText(/4\s*semanas/i)).toBeInTheDocument();
  });

  it("AC-7: guardar llama a actualizarConfiguracionMenu con comidas + periodicidad y muestra éxito", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Desayuno");
    fireEvent.click(screen.getByRole("radio", { name: /quincenal/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    await waitFor(() => expect(putConfigCalls().length).toBe(1));
    const body = putConfigCalls()[0].body as MenuConfig;
    expect(body.periodicidad).toBe("QUINCENAL");
    expect(body.comidas).toEqual(
      expect.arrayContaining(["Desayuno", "Almuerzo", "Cena"]),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("AC-8: fallo de carga muestra error amable + toast y no deja Skeleton infinito", async () => {
    installFetch((url, method) => {
      if (/\/menu(?:\?|$)/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "ERROR", message: "x" });
      }
      return null;
    });
    const { container } = render(<ConfiguracionMenuSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("AC-9: fallo de guardado muestra toast de error y conserva lo editado", async () => {
    installFetch((url, method) => {
      if (/\/menu\/configuracion/.test(url) && method === "PUT") {
        return jsonResponse(422, { code: "INVALIDO", message: "x" });
      }
      return handlerMenu()(url, method);
    });
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Desayuno");
    fireEvent.change(screen.getAllByLabelText(/comida/i)[0], {
      target: { value: "Brunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // La comida editada sigue visible (no se descartó por el error).
    expect(screen.getByDisplayValue("Brunch")).toBeInTheDocument();
  });

  it("AC-10 (a11y): periodicidad como radiogroup con nombre, comidas con etiqueta, botones con nombre", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Desayuno");
    const grupo = screen.getByRole("radiogroup", { name: /periodicidad/i });
    expect(within(grupo).getAllByRole("radio").length).toBe(3);
    expect(screen.getAllByLabelText(/comida/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: /agregar comida/i }),
    ).toBeInTheDocument();
  });

  it("EC-1: menú sin comidas permite agregar la primera comida", async () => {
    installFetch(
      handlerMenu({
        configuracion: { comidas: [], periodicidad: "SEMANAL" },
        entradas: [],
      }),
    );
    render(<ConfiguracionMenuSection />);
    await waitFor(() => expect(getCalls("/menu").length).toBeGreaterThanOrEqual(1));
    expect(
      await screen.findByRole("button", { name: /agregar comida/i }),
    ).toBeInTheDocument();
  });

  it("EC-2: comidas en blanco se excluyen del body al guardar", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Cena");
    fireEvent.change(screen.getByDisplayValue("Cena"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    await waitFor(() => expect(putConfigCalls().length).toBe(1));
    const body = putConfigCalls()[0].body as MenuConfig;
    expect(body.comidas).not.toContain("   ");
    expect(body.comidas).toEqual(expect.arrayContaining(["Desayuno", "Almuerzo"]));
  });

  it("EC-3/EC-4: renombrar una comida se refleja en el body guardado", async () => {
    render(<ConfiguracionMenuSection />);
    await screen.findByDisplayValue("Desayuno");
    fireEvent.change(screen.getByDisplayValue("Desayuno"), {
      target: { value: "Onces" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    await waitFor(() => expect(putConfigCalls().length).toBe(1));
    const body = putConfigCalls()[0].body as MenuConfig;
    expect(body.comidas).toContain("Onces");
    expect(body.comidas).not.toContain("Desayuno");
  });
});
