// RED — Spec epic-8.6-tareas/rutina-editor.
// Editor de rutina por día de la semana: carga vía obtenerRutinaTareas (GET
// /tareas/rutina), agrupa por día Lunes–Domingo, permite agregar/editar/eliminar/
// reordenar tareas con horario opcional (HH:mm) y guarda el conjunto completo vía
// actualizarRutinaTareas (PUT /tareas/rutina). Estados loading/empty/error + a11y.
// Sin servidor: fetch mockeado. Consume el contrato SOLO por el cliente tipado.
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

import { RutinaSection } from "./rutina-section";

type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO"
  | "DOMINGO";
interface RutinaTarea {
  id: string;
  diaSemana: DiaSemana;
  descripcion: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  orden: number;
}
interface RutinaTareaInput {
  diaSemana: DiaSemana;
  descripcion: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  orden: number;
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

const RUTINA_EJEMPLO: RutinaTarea[] = [
  {
    id: "t1",
    diaSemana: "LUNES",
    descripcion: "Preparar desayuno",
    horaInicio: "08:00",
    horaFin: "09:30",
    orden: 0,
  },
  {
    id: "t2",
    diaSemana: "LUNES",
    descripcion: "Lavar ropa",
    horaInicio: null,
    horaFin: null,
    orden: 1,
  },
  {
    id: "t3",
    diaSemana: "MIERCOLES",
    descripcion: "Limpiar ventanas",
    horaInicio: null,
    horaFin: null,
    orden: 0,
  },
];

function handlerRutina(rutina: RutinaTarea[] = RUTINA_EJEMPLO) {
  return (url: string, method: string): Response | null => {
    if (/\/tareas\/rutina(?:\?|$)/.test(url) && method === "GET") {
      return jsonResponse(200, rutina);
    }
    if (/\/tareas\/rutina(?:\?|$)/.test(url) && method === "PUT") {
      const last = calls[calls.length - 1];
      const input = (last?.body as RutinaTareaInput[]) ?? [];
      // Eco como RutinaTarea[] (agrega ids ficticios).
      const out: RutinaTarea[] = input.map((i, idx) => ({ id: `n${idx}`, ...i }));
      return jsonResponse(200, out);
    }
    return null;
  };
}

const getRutinaCalls = () =>
  calls.filter((c) => c.method === "GET" && /\/tareas\/rutina/.test(c.url));
const putRutinaCalls = () =>
  calls.filter((c) => c.method === "PUT" && /\/tareas\/rutina/.test(c.url));

describe("RutinaSection (Spec rutina-editor)", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    installFetch(handlerRutina());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: al montar llama a obtenerRutinaTareas (GET /tareas/rutina) una vez", async () => {
    render(<RutinaSection />);
    await waitFor(() => expect(getRutinaCalls().length).toBe(1));
  });

  it("AC-2: muestra estado de carga (Skeleton) y no el editor mientras carga", () => {
    const { container } = render(<RutinaSection />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-3: agrupa las tareas bajo su día de la semana (Lunes–Domingo en orden)", async () => {
    render(<RutinaSection />);
    await waitFor(() => expect(getRutinaCalls().length).toBe(1));
    // Encabezados de los 7 días presentes y en orden.
    const dias = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];
    const headings = screen
      .getAllByRole("heading")
      .map((h) => h.textContent ?? "");
    const indices = dias.map((d) => headings.findIndex((h) => h.includes(d)));
    expect(indices.every((i) => i >= 0)).toBe(true);
    const soloDias = indices.filter((i) => i >= 0);
    expect([...soloDias].sort((a, b) => a - b)).toEqual(soloDias);
    // Las tareas del lunes están presentes.
    expect(await screen.findByDisplayValue("Preparar desayuno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lavar ropa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Limpiar ventanas")).toBeInTheDocument();
  });

  it("AC-4: un día sin tareas muestra EmptyState y permite agregar la primera", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    // Martes no tiene tareas → grupo de Martes con su botón de agregar.
    const grupoMartes = screen.getByRole("group", { name: /martes/i });
    expect(
      within(grupoMartes).getByRole("button", { name: /agregar tarea/i }),
    ).toBeInTheDocument();
  });

  it("AC-5: agregar una tarea añade una fila editable sin llamar al backend", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    const grupoLunes = screen.getByRole("group", { name: /lunes/i });
    const antes = within(grupoLunes).getAllByLabelText(/descripción/i).length;
    fireEvent.click(
      within(grupoLunes).getByRole("button", { name: /agregar tarea/i }),
    );
    await waitFor(() =>
      expect(within(grupoLunes).getAllByLabelText(/descripción/i).length).toBe(
        antes + 1,
      ),
    );
    expect(putRutinaCalls().length).toBe(0);
  });

  it("AC-6/AC-9: editar descripción y guardar envía actualizarRutinaTareas (PUT) una vez con el cambio", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    fireEvent.change(screen.getByDisplayValue("Lavar ropa"), {
      target: { value: "Lavar y tender ropa" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(putRutinaCalls().length).toBe(1));
    const body = putRutinaCalls()[0].body as RutinaTareaInput[];
    const descripciones = body.map((b) => b.descripcion);
    expect(descripciones).toContain("Lavar y tender ropa");
    expect(descripciones).toContain("Preparar desayuno");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("AC-7: eliminar una tarea la quita sin llamar al backend", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Limpiar ventanas");
    fireEvent.click(screen.getByRole("button", { name: /eliminar.*limpiar ventanas/i }));
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Limpiar ventanas")).not.toBeInTheDocument(),
    );
    expect(putRutinaCalls().length).toBe(0);
  });

  it("AC-8: reordenar (subir) cambia el orden visible y el orden enviado", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    const grupoLunes = screen.getByRole("group", { name: /lunes/i });
    // Subir "Lavar ropa" (orden 1) por encima de "Preparar desayuno" (orden 0).
    fireEvent.click(
      within(grupoLunes).getByRole("button", { name: /subir.*lavar ropa/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(putRutinaCalls().length).toBe(1));
    const body = putRutinaCalls()[0].body as RutinaTareaInput[];
    const lunes = body
      .filter((b) => b.diaSemana === "LUNES")
      .sort((a, b) => a.orden - b.orden);
    expect(lunes[0].descripcion).toBe("Lavar ropa");
    expect(lunes[1].descripcion).toBe("Preparar desayuno");
  });

  it("AC-10: horario inválido (horaInicio > horaFin) no guarda, muestra error y conserva edición", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    // Forzar rango inválido en la tarea del lunes con horario.
    const grupoLunes = screen.getByRole("group", { name: /lunes/i });
    const inicios = within(grupoLunes).getAllByLabelText(/hora inicio/i);
    const fines = within(grupoLunes).getAllByLabelText(/hora fin/i);
    fireEvent.change(inicios[0], { target: { value: "10:00" } });
    fireEvent.change(fines[0], { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(putRutinaCalls().length).toBe(0);
    // La edición se conserva.
    expect((inicios[0] as HTMLInputElement).value).toBe("10:00");
  });

  it("AC-11 (a11y): cada día es un grupo con nombre, campos y botones con nombre accesible", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    expect(screen.getByRole("group", { name: /lunes/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /domingo/i })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/descripción/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /guardar rutina/i })).toBeInTheDocument();
  });

  it("AC-12: fallo de carga muestra error amable + toast y no deja Skeleton infinito", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/rutina/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "ERROR", message: "x" });
      }
      return null;
    });
    const { container } = render(<RutinaSection />);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("AC-13: fallo de guardado muestra toast de error y conserva lo editado", async () => {
    installFetch((url, method) => {
      if (/\/tareas\/rutina/.test(url) && method === "PUT") {
        return jsonResponse(422, { code: "INVALIDO", message: "x" });
      }
      return handlerRutina()(url, method);
    });
    render(<RutinaSection />);
    await screen.findByDisplayValue("Preparar desayuno");
    fireEvent.change(screen.getByDisplayValue("Lavar ropa"), {
      target: { value: "Lavar todo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByDisplayValue("Lavar todo")).toBeInTheDocument();
  });

  it("EC-1: rutina vacía muestra EmptyState por día y guarda [] ", async () => {
    installFetch(handlerRutina([]));
    render(<RutinaSection />);
    await waitFor(() => expect(getRutinaCalls().length).toBe(1));
    expect(
      await screen.findByRole("group", { name: /lunes/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(putRutinaCalls().length).toBe(1));
    expect(putRutinaCalls()[0].body).toEqual([]);
  });

  it("EC-2: descripción en blanco se excluye del body al guardar", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Lavar ropa");
    fireEvent.change(screen.getByDisplayValue("Lavar ropa"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(putRutinaCalls().length).toBe(1));
    const body = putRutinaCalls()[0].body as RutinaTareaInput[];
    expect(body.map((b) => b.descripcion)).not.toContain("   ");
    expect(body.map((b) => b.descripcion)).toContain("Preparar desayuno");
  });

  it("EC-3: tarea con solo horaInicio es válida y se envía sin fallar", async () => {
    render(<RutinaSection />);
    await screen.findByDisplayValue("Limpiar ventanas");
    const grupoMiercoles = screen.getByRole("group", { name: /miércoles/i });
    const inicios = within(grupoMiercoles).getAllByLabelText(/hora inicio/i);
    fireEvent.change(inicios[0], { target: { value: "07:00" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar rutina/i }));
    await waitFor(() => expect(putRutinaCalls().length).toBe(1));
    const body = putRutinaCalls()[0].body as RutinaTareaInput[];
    const tarea = body.find((b) => b.descripcion === "Limpiar ventanas");
    expect(tarea?.horaInicio).toBe("07:00");
    expect(toastError).not.toHaveBeenCalled();
  });
});
