// RED — Spec epic-8.7-consulta-empleada/tareas-tab (pestaña Tareas).
// obtenerTareasDelDia(hoy) (con X-Acceso-Token) → TaskChecklist marcable; marcar
// llama marcarTarea (PUT /tareas/cumplimiento) optimista con reversión en error.
// Es la ÚNICA escritura de la empleada (RN-13). RTL + fetch mockeado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a), info: vi.fn() },
}));

import { createConsultaClient } from "./consulta-client";
import { TareasTab } from "./tareas-tab";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface Call {
  url: string;
  method: string;
  body: unknown;
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
    calls.push({ url, method, body, token: tokenFrom(init) });
    return handler(url, method) ?? new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

// 3 de junio de 2026.
const HOY = new Date(2026, 5, 3);
const FECHA_HOY = "2026-06-03";

const TAREAS = [
  { rutinaTareaId: "t1", descripcion: "Preparar desayuno", horaInicio: "08:00", horaFin: "09:30", hecha: false },
  { rutinaTareaId: "t2", descripcion: "Lavar ropa", horaInicio: null, horaFin: null, hecha: true },
];

function handlerOk(tareas = TAREAS) {
  return (url: string, method: string): Response | null => {
    if (/\/tareas\/dia\?/.test(url) && method === "GET") {
      return jsonResponse(200, tareas);
    }
    if (/\/tareas\/cumplimiento/.test(url) && method === "PUT") {
      const last = calls[calls.length - 1];
      const b = (last?.body as Record<string, unknown>) ?? {};
      return jsonResponse(200, { ...b, descripcion: "x" });
    }
    return null;
  };
}

const getDia = () => calls.filter((c) => c.method === "GET" && /\/tareas\/dia/.test(c.url));
const putMarcar = () =>
  calls.filter((c) => c.method === "PUT" && /\/tareas\/cumplimiento/.test(c.url));

describe("TareasTab (Spec tareas-tab)", () => {
  beforeEach(() => toastError.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("AC-1: al montar carga obtenerTareasDelDia con la fecha de hoy y X-Acceso-Token", async () => {
    installFetch(handlerOk());
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    await waitFor(() => expect(getDia().length).toBeGreaterThanOrEqual(1));
    expect(getDia()[0].url).toContain(`fecha=${FECHA_HOY}`);
    expect(getDia()[0].token).toBe("tok-7");
  });

  it("AC-2: renderiza las tareas como casillas marcables con su estado inicial", async () => {
    installFetch(handlerOk());
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    expect(await screen.findByText("Preparar desayuno")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").length).toBe(2);
  });

  it("AC-3: marcar llama a marcarTarea con {fecha,rutinaTareaId,hecha}+token y conmuta", async () => {
    installFetch(handlerOk());
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    const t = await screen.findByText("Preparar desayuno");
    const casilla = t.closest("label")?.querySelector('[role="checkbox"]');
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcar().length).toBe(1));
    const body = putMarcar()[0].body as { fecha: string; rutinaTareaId: string; hecha: boolean };
    expect(body).toEqual({ fecha: FECHA_HOY, rutinaTareaId: "t1", hecha: true });
    expect(putMarcar()[0].token).toBe("tok-7");
    await waitFor(() =>
      expect((casilla as HTMLElement).getAttribute("aria-checked")).toBe("true"),
    );
  });

  it("AC-4: si marcarTarea falla, revierte el estado y muestra toast de error", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/dia\?/.test(url) && method === "GET") return jsonResponse(200, TAREAS);
      if (/\/tareas\/cumplimiento/.test(url) && method === "PUT") {
        return jsonResponse(422, { code: "X", message: "y" });
      }
      return null;
    });
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    const t = await screen.findByText("Preparar desayuno");
    const casilla = t.closest("label")?.querySelector('[role="checkbox"]');
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() =>
      expect((casilla as HTMLElement).getAttribute("aria-checked")).toBe("false"),
    );
  });

  it("AC-5: día sin tareas muestra EmptyState", async () => {
    installFetch(handlerOk([]));
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    await waitFor(() => expect(getDia().length).toBeGreaterThanOrEqual(1));
    expect(await screen.findByText(/no hay tareas/i)).toBeInTheDocument();
  });

  it("AC-6: Skeleton mientras carga; fallo muestra mensaje amable sin Skeleton", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/dia\?/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "X", message: "y" });
      }
      return null;
    });
    const { container } = render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
  });

  it("AC-7 (a11y): las casillas tienen la descripción como etiqueta", async () => {
    installFetch(handlerOk());
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    expect(await screen.findByText("Lavar ropa")).toBeInTheDocument();
  });

  it("EC-1: marcar y desmarcar produce dos llamadas (true luego false)", async () => {
    installFetch(handlerOk());
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    const t = await screen.findByText("Preparar desayuno");
    const casilla = t.closest("label")?.querySelector('[role="checkbox"]');
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcar().length).toBe(1));
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcar().length).toBe(2));
    expect((putMarcar()[0].body as { hecha: boolean }).hecha).toBe(true);
    expect((putMarcar()[1].body as { hecha: boolean }).hecha).toBe(false);
  });

  it("EC-2: tarea ya marcada al cargar aparece marcada; desmarcar envía hecha:false", async () => {
    installFetch(handlerOk());
    render(<TareasTab client={createConsultaClient("tok-7")} hoy={HOY} />);
    const t = await screen.findByText("Lavar ropa");
    const casilla = t.closest("label")?.querySelector('[role="checkbox"]');
    expect((casilla as HTMLElement).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcar().length).toBe(1));
    expect((putMarcar()[0].body as { hecha: boolean }).hecha).toBe(false);
  });
});
