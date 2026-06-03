// RED — Spec epic-8.6-tareas/checklist-historico (checklist del día).
// Selector de fecha (hoy por defecto) → obtenerTareasDelDia (GET /tareas/dia?fecha=)
// → TaskChecklist marcable; marcar llama marcarTarea (PUT /tareas/cumplimiento) con
// toggle optimista y revierte en error. Estados loading/empty/error + a11y.
// Sin servidor: fetch mockeado. Consume el contrato SOLO por el cliente tipado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: (...a: unknown[]) => a,
  },
}));

import { ChecklistSection } from "./checklist-section";

interface TareaDelDia {
  rutinaTareaId: string;
  descripcion: string;
  horaInicio?: string | null;
  horaFin?: string | null;
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

const TAREAS_HOY: TareaDelDia[] = [
  {
    rutinaTareaId: "t1",
    descripcion: "Preparar desayuno",
    horaInicio: "08:00",
    horaFin: "09:30",
    hecha: false,
  },
  {
    rutinaTareaId: "t2",
    descripcion: "Lavar ropa",
    horaInicio: null,
    horaFin: null,
    hecha: true,
  },
];

function handlerDia(tareas: TareaDelDia[] = TAREAS_HOY) {
  return (url: string, method: string): Response | null => {
    if (/\/tareas\/dia\?/.test(url) && method === "GET") {
      return jsonResponse(200, tareas);
    }
    if (/\/tareas\/cumplimiento(?:\?|$)/.test(url) && method === "PUT") {
      const last = calls[calls.length - 1];
      const b = (last?.body as { fecha: string; rutinaTareaId: string; hecha: boolean }) ?? {
        fecha: "2026-06-03",
        rutinaTareaId: "t1",
        hecha: true,
      };
      return jsonResponse(200, { ...b, descripcion: "x" });
    }
    return null;
  };
}

const getDiaCalls = () =>
  calls.filter((c) => c.method === "GET" && /\/tareas\/dia/.test(c.url));
const putMarcarCalls = () =>
  calls.filter((c) => c.method === "PUT" && /\/tareas\/cumplimiento/.test(c.url));

const FECHA_HOY = new Date().toISOString().slice(0, 10);

describe("ChecklistSection (Spec checklist-historico — checklist)", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    installFetch(handlerDia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: al montar llama a obtenerTareasDelDia con la fecha de hoy", async () => {
    render(<ChecklistSection />);
    await waitFor(() => expect(getDiaCalls().length).toBeGreaterThanOrEqual(1));
    expect(getDiaCalls()[0].url).toContain(`fecha=${FECHA_HOY}`);
  });

  it("AC-2: cambiar la fecha vuelve a llamar a obtenerTareasDelDia con la nueva fecha", async () => {
    render(<ChecklistSection />);
    await waitFor(() => expect(getDiaCalls().length).toBeGreaterThanOrEqual(1));
    const selector = screen.getByLabelText(/fecha/i);
    fireEvent.change(selector, { target: { value: "2026-05-01" } });
    await waitFor(() =>
      expect(getDiaCalls().some((c) => c.url.includes("fecha=2026-05-01"))).toBe(true),
    );
  });

  it("AC-3: muestra Skeleton mientras carga y no la lista", () => {
    const { container } = render(<ChecklistSection />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-4: tras cargar renderiza las tareas como casillas marcables", async () => {
    render(<ChecklistSection />);
    await waitFor(() => expect(getDiaCalls().length).toBeGreaterThanOrEqual(1));
    expect(await screen.findByText("Preparar desayuno")).toBeInTheDocument();
    expect(screen.getByText("Lavar ropa")).toBeInTheDocument();
    const casillas = screen.getAllByRole("checkbox");
    expect(casillas.length).toBe(2);
  });

  it("AC-5: marcar una tarea llama a marcarTarea con {fecha,rutinaTareaId,hecha} y conmuta", async () => {
    render(<ChecklistSection />);
    const desayuno = await screen.findByText("Preparar desayuno");
    const casilla = desayuno.closest("label")?.querySelector('[role="checkbox"]');
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcarCalls().length).toBe(1));
    const body = putMarcarCalls()[0].body as {
      fecha: string;
      rutinaTareaId: string;
      hecha: boolean;
    };
    expect(body.rutinaTareaId).toBe("t1");
    expect(body.hecha).toBe(true);
    expect(body.fecha).toBe(FECHA_HOY);
    await waitFor(() =>
      expect((casilla as HTMLElement).getAttribute("aria-checked")).toBe("true"),
    );
  });

  it("AC-6: si marcarTarea falla, revierte el estado y muestra toast de error", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/dia\?/.test(url) && method === "GET") {
        return jsonResponse(200, TAREAS_HOY);
      }
      if (/\/tareas\/cumplimiento/.test(url) && method === "PUT") {
        return jsonResponse(422, { code: "X", message: "y" });
      }
      return null;
    });
    render(<ChecklistSection />);
    const desayuno = await screen.findByText("Preparar desayuno");
    const casilla = desayuno.closest("label")?.querySelector('[role="checkbox"]');
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() =>
      expect((casilla as HTMLElement).getAttribute("aria-checked")).toBe("false"),
    );
  });

  it("AC-7: día sin tareas muestra EmptyState, no una lista vacía", async () => {
    installFetch(handlerDia([]));
    render(<ChecklistSection />);
    await waitFor(() => expect(getDiaCalls().length).toBeGreaterThanOrEqual(1));
    expect(await screen.findByText(/no hay tareas/i)).toBeInTheDocument();
  });

  it("AC-11 (a11y): el selector de fecha tiene etiqueta y las casillas etiqueta", async () => {
    render(<ChecklistSection />);
    await waitFor(() => expect(getDiaCalls().length).toBeGreaterThanOrEqual(1));
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(await screen.findByText("Preparar desayuno")).toBeInTheDocument();
  });

  it("AC-12: fallo de carga muestra mensaje amable + toast y no deja Skeleton", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/dia\?/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "X", message: "y" });
      }
      return null;
    });
    const { container } = render(<ChecklistSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("EC-1: marcar y desmarcar produce dos llamadas (true luego false)", async () => {
    render(<ChecklistSection />);
    const desayuno = await screen.findByText("Preparar desayuno");
    const casilla = desayuno.closest("label")?.querySelector('[role="checkbox"]');
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcarCalls().length).toBe(1));
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcarCalls().length).toBe(2));
    expect((putMarcarCalls()[0].body as { hecha: boolean }).hecha).toBe(true);
    expect((putMarcarCalls()[1].body as { hecha: boolean }).hecha).toBe(false);
  });

  it("EC-2: tarea ya marcada al cargar aparece marcada; desmarcar envía hecha:false", async () => {
    render(<ChecklistSection />);
    const lavar = await screen.findByText("Lavar ropa");
    const casilla = lavar.closest("label")?.querySelector('[role="checkbox"]');
    expect((casilla as HTMLElement).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(casilla as Element);
    await waitFor(() => expect(putMarcarCalls().length).toBe(1));
    expect((putMarcarCalls()[0].body as { hecha: boolean }).hecha).toBe(false);
  });
});
