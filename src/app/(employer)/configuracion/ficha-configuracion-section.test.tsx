// RED — Spec epic-8.2-configuracion/ficha-y-configuracion.
// Sección de /configuracion: ficha de la empleada (nombre, fechas) + configuración
// (salario COP, días laborales como toggles). Carga vía obtenerEmpleada/obtenerConfiguracion
// y guarda vía actualizarEmpleada/actualizarConfiguracion, todo por el cliente tipado.
// Sin servidor: se mockea fetch global. Se mockea sonner para verificar toasts.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { FichaConfiguracionSection } from "./ficha-configuracion-section";

interface RouteSpec {
  method: string;
  match: (url: string) => boolean;
  respond: () => Response;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const noContent = (status: number) => new Response(null, { status });
const errorJson = (status: number, code: string) =>
  jsonResponse(status, { code, message: "x" });

const empleadaBase = {
  nombre: "María Pérez",
  fechaNacimiento: "1990-04-15",
  fechaInicioContrato: "2024-01-10",
  fechaFinContrato: null as string | null,
};
const configBase = {
  salarioBase: 700000,
  diasLaborales: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"],
};

let routes: RouteSpec[];
let fetchMock: ReturnType<typeof vi.fn>;
// Registro de la última llamada por operación, para inspeccionar body/método/URL.
let calls: { url: string; method: string; body?: unknown }[];

function installFetch() {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    let body: unknown;
    if (init?.body != null) {
      try {
        const text =
          typeof init.body === "string"
            ? init.body
            : new TextDecoder().decode(init.body as ArrayBuffer);
        body = JSON.parse(text);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method, body });
    const route = routes.find((r) => r.method === method && r.match(url));
    if (!route) {
      return noContent(404);
    }
    return route.respond();
  });
  vi.stubGlobal("fetch", fetchMock);
}

function defaultRoutes(): RouteSpec[] {
  return [
    {
      method: "GET",
      match: (u) => u.includes("/empleada"),
      respond: () => jsonResponse(200, empleadaBase),
    },
    {
      method: "PUT",
      match: (u) => u.includes("/empleada"),
      respond: () => jsonResponse(200, empleadaBase),
    },
    {
      method: "GET",
      match: (u) => u.includes("/configuracion"),
      respond: () => jsonResponse(200, configBase),
    },
    {
      method: "PUT",
      match: (u) => u.includes("/configuracion"),
      respond: () => jsonResponse(200, configBase),
    },
  ];
}

const callsTo = (method: string, fragment: string) =>
  calls.filter((c) => c.method === method && c.url.includes(fragment));

describe("FichaConfiguracionSection (Spec ficha-y-configuracion)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    routes = defaultRoutes();
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-2: muestra estado de carga (Skeleton) mientras cargan los datos", () => {
    const { container } = render(<FichaConfiguracionSection />);
    // El Skeleton del DS marca aria-hidden; debe haber al menos uno mientras carga.
    expect(container.querySelector('[aria-hidden="true"].animate-pulse')).not.toBeNull();
  });

  it("AC-1: carga ficha y configuración y rellena los campos", async () => {
    render(<FichaConfiguracionSection />);
    const nombre = await screen.findByLabelText(/Nombre/i);
    expect(nombre).toHaveValue("María Pérez");
    expect(screen.getByLabelText(/Fecha de nacimiento/i)).toHaveValue("1990-04-15");
    expect(screen.getByLabelText(/Inicio de contrato/i)).toHaveValue("2024-01-10");
    expect(screen.getByLabelText(/Salario base/i)).toHaveValue(700000);
    // Toggle de un día activo según config
    expect(screen.getByRole("switch", { name: /Lunes/i })).toBeChecked();
    expect(screen.getByRole("switch", { name: /Domingo/i })).not.toBeChecked();
    // Se consultaron ambas operaciones de lectura.
    expect(callsTo("GET", "/empleada").length).toBeGreaterThanOrEqual(1);
    expect(callsTo("GET", "/configuracion").length).toBeGreaterThanOrEqual(1);
  });

  it("AC-3: guardar la ficha invoca actualizarEmpleada (PUT /empleada) una vez con los valores", async () => {
    render(<FichaConfiguracionSection />);
    const nombre = await screen.findByLabelText(/Nombre/i);
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Ana Gómez");
    await userEvent.click(screen.getByRole("button", { name: /Guardar ficha/i }));
    await waitFor(() => expect(callsTo("PUT", "/empleada").length).toBe(1));
    const sent = callsTo("PUT", "/empleada")[0].body as Record<string, unknown>;
    expect(sent.nombre).toBe("Ana Gómez");
    expect(sent.fechaInicioContrato).toBe("2024-01-10");
  });

  it("AC-4/AC-5: guardar configuración envía salarioBase y diasLaborales según los toggles", async () => {
    render(<FichaConfiguracionSection />);
    await screen.findByLabelText(/Salario base/i);
    // Desactivar SABADO → debe salir de diasLaborales.
    await userEvent.click(screen.getByRole("switch", { name: /Sábado/i }));
    await userEvent.click(screen.getByRole("button", { name: /Guardar configuración/i }));
    await waitFor(() => expect(callsTo("PUT", "/configuracion").length).toBe(1));
    const sent = callsTo("PUT", "/configuracion")[0].body as {
      salarioBase: number;
      diasLaborales: string[];
    };
    expect(sent.salarioBase).toBe(700000);
    expect(sent.diasLaborales).toContain("LUNES");
    expect(sent.diasLaborales).not.toContain("SABADO");
  });

  it("AC-6: durante el guardado el botón queda deshabilitado (aria-busy)", async () => {
    let resolve: (r: Response) => void = () => {};
    routes = routes.map((r) =>
      r.method === "PUT" && r.match("/empleada")
        ? { ...r, respond: () => jsonResponse(200, empleadaBase) }
        : r,
    );
    // Sobrescribir el PUT /empleada con una promesa controlada.
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });
      if (method === "PUT" && url.includes("/empleada")) {
        return new Promise<Response>((r) => (resolve = r));
      }
      if (method === "GET" && url.includes("/empleada")) return jsonResponse(200, empleadaBase);
      if (url.includes("/configuracion")) return jsonResponse(200, configBase);
      return noContent(404);
    });
    render(<FichaConfiguracionSection />);
    await screen.findByLabelText(/Nombre/i);
    const btn = screen.getByRole("button", { name: /Guardar ficha/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveAttribute("aria-busy", "true");
    resolve(jsonResponse(200, empleadaBase));
  });

  it("AC-7: un guardado exitoso muestra Toast de éxito", async () => {
    render(<FichaConfiguracionSection />);
    await screen.findByLabelText(/Nombre/i);
    await userEvent.click(screen.getByRole("button", { name: /Guardar ficha/i }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("AC-8: un 422 al guardar muestra Toast de error y conserva lo editado", async () => {
    routes = routes.map((r) =>
      r.method === "PUT" && r.match("/empleada")
        ? { ...r, respond: () => errorJson(422, "VALIDACION") }
        : r,
    );
    render(<FichaConfiguracionSection />);
    const nombre = await screen.findByLabelText(/Nombre/i);
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Editado");
    await userEvent.click(screen.getByRole("button", { name: /Guardar ficha/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByLabelText(/Nombre/i)).toHaveValue("Editado");
  });

  it("AC-9 (a11y): todos los días tienen un switch con nombre accesible", async () => {
    render(<FichaConfiguracionSection />);
    await screen.findByLabelText(/Nombre/i);
    for (const dia of [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ]) {
      expect(screen.getByRole("switch", { name: new RegExp(dia, "i") })).toBeInTheDocument();
    }
  });

  it("AC-10 (RN-20): muestra BirthdayBanner cuando hoy es el cumpleaños", async () => {
    const hoy = new Date();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    routes = routes.map((r) =>
      r.method === "GET" && r.match("/empleada")
        ? {
            ...r,
            respond: () =>
              jsonResponse(200, { ...empleadaBase, fechaNacimiento: `1990-${mm}-${dd}` }),
          }
        : r,
    );
    render(<FichaConfiguracionSection />);
    const banner = await screen.findByRole("status");
    expect(within(banner).getByText(/Cumpleaños/i)).toBeInTheDocument();
  });

  it("AC-10 (RN-20): NO muestra BirthdayBanner cuando hoy no es el cumpleaños", async () => {
    render(<FichaConfiguracionSection />);
    await screen.findByLabelText(/Nombre/i);
    // fechaNacimiento 1990-04-15: salvo que el test corra justo ese día, no hay banner.
    const hoy = new Date();
    const esCumple = hoy.getMonth() === 3 && hoy.getDate() === 15;
    if (!esCumple) {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    }
  });

  it("EC-1: si la carga falla muestra error y no se queda en Skeleton", async () => {
    routes = routes.map((r) =>
      r.method === "GET" ? { ...r, respond: () => errorJson(500, "ERROR") } : r,
    );
    render(<FichaConfiguracionSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/No pudimos cargar/i)).toBeInTheDocument();
  });

  it("EC-2: sin fechaFinContrato, el campo de fin queda vacío", async () => {
    render(<FichaConfiguracionSection />);
    await screen.findByLabelText(/Nombre/i);
    expect(screen.getByLabelText(/Fin de contrato/i)).toHaveValue("");
  });
});
