// RED — Spec epic-8.7-consulta-empleada/consult-client-shell.
// /consulta/[token]: valida el token (validarAccesoEmpleada) enviando X-Acceso-Token;
// si 401 → pantalla de error; si 200 → carga obtenerEmpleada y renderiza el shell
// (nombre + Avatar + Tabs Pago/Menú/Tareas) + BirthdayBanner cuando aplica.
// RTL + fetch mockeado. Las pestañas Pago/Menú/Tareas montan su propia I/O; aquí
// se permiten respuestas vacías para esos endpoints.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ConsultaView } from "./consulta-view";

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
  if (!h) return null;
  if (h instanceof Headers) return h.get("X-Acceso-Token");
  if (Array.isArray(h)) {
    const f = h.find(([k]) => k.toLowerCase() === "x-acceso-token");
    return f ? f[1] : null;
  }
  const rec = h as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === "x-acceso-token");
  return key ? rec[key] : null;
}

function installFetch(handler: (url: string, method: string) => Response | null) {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, token: tokenFrom(init) });
    const r = handler(url, method);
    if (r) return r;
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const EMPLEADA = {
  nombre: "Ana Pérez",
  fechaNacimiento: "1990-03-15",
  fechaInicioContrato: "2024-01-01",
  fechaFinContrato: null,
};

// Handler "válido": valida ok, empleada ok, y respuestas neutras para las pestañas.
function handlerValido(empleada = EMPLEADA) {
  return (url: string, method: string): Response | null => {
    if (/\/acceso\/validar/.test(url) && method === "GET") {
      return jsonResponse(200, { nombre: empleada.nombre, valido: true });
    }
    if (/\/empleada/.test(url) && method === "GET") {
      return jsonResponse(200, empleada);
    }
    if (/\/menu/.test(url)) {
      return jsonResponse(200, { configuracion: { comidas: [], periodicidad: "SEMANAL" }, entradas: [] });
    }
    if (/\/tareas\/dia/.test(url)) {
      return jsonResponse(200, []);
    }
    if (/\/liquidaciones\//.test(url)) {
      return jsonResponse(409, { code: "MES_FUERA_DE_CONTRATO", message: "x" });
    }
    return null;
  };
}

const HOY = new Date(2026, 5, 3); // 3 de junio de 2026

describe("ConsultaView (Spec consult-client-shell)", () => {
  beforeEach(() => {
    installFetch(handlerValido());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1/AC-5: al montar llama a validarAccesoEmpleada con el header X-Acceso-Token", async () => {
    render(<ConsultaView token="tok-abc" hoy={HOY} />);
    await waitFor(() =>
      expect(calls.some((c) => /\/acceso\/validar/.test(c.url))).toBe(true),
    );
    const validar = calls.find((c) => /\/acceso\/validar/.test(c.url));
    expect(validar?.token).toBe("tok-abc");
  });

  it("AC-2/EC-1: token inválido (401) muestra pantalla amable y NO las pestañas", async () => {
    installFetch((url, method) => {
      if (/\/acceso\/validar/.test(url) && method === "GET") {
        return jsonResponse(401, { code: "ACCESO_INVALIDO", message: "x" });
      }
      return null;
    });
    render(<ConsultaView token="bad" hoy={HOY} />);
    expect(await screen.findByText(/inválido|invalido|revocado/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /pago/i })).not.toBeInTheDocument();
  });

  it("AC-3: token válido renderiza nombre y las pestañas Pago/Menú/Tareas", async () => {
    render(<ConsultaView token="tok-abc" hoy={HOY} />);
    expect(await screen.findByText(/Ana Pérez/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pago/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /men[uú]/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tareas/i })).toBeInTheDocument();
  });

  it("AC-3/AC-5: obtenerEmpleada también envía el header X-Acceso-Token", async () => {
    render(<ConsultaView token="tok-abc" hoy={HOY} />);
    await waitFor(() => expect(calls.some((c) => /\/empleada/.test(c.url))).toBe(true));
    const emp = calls.find((c) => /\/empleada/.test(c.url));
    expect(emp?.token).toBe("tok-abc");
  });

  it("AC-4: mientras valida muestra un estado de carga (no pestañas, no error)", () => {
    // fetch que no resuelve de inmediato: estado de carga visible en el primer render.
    installFetch(() => null);
    const { container } = render(<ConsultaView token="tok-abc" hoy={HOY} />);
    expect(screen.queryByRole("tab", { name: /pago/i })).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("AC-6: cumpleaños hoy → muestra BirthdayBanner con el nombre", async () => {
    const empleada = { ...EMPLEADA, fechaNacimiento: "1990-06-03" };
    installFetch(handlerValido(empleada));
    render(<ConsultaView token="tok-abc" hoy={HOY} />);
    // "Ana Pérez" aparece en el encabezado y en el banner ⇒ usar findAllByText.
    await waitFor(() => expect(screen.getAllByText(/Ana Pérez/).length).toBeGreaterThanOrEqual(1));
    expect(await screen.findByText(/cumplea[ñn]os de ana/i)).toBeInTheDocument();
  });

  it("AC-6: cumpleaños NO es hoy → no muestra BirthdayBanner", async () => {
    render(<ConsultaView token="tok-abc" hoy={HOY} />);
    await screen.findByText(/Ana Pérez/);
    expect(screen.queryByText(/cumplea[ñn]os de/i)).not.toBeInTheDocument();
  });

  it("AC-7 (a11y): las pestañas exponen roles tab/tablist", async () => {
    render(<ConsultaView token="tok-abc" hoy={HOY} />);
    await screen.findByText(/Ana Pérez/);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").length).toBe(3);
  });

  it("EC-2: obtenerEmpleada falla (500) tras token válido → mensaje de error de ficha", async () => {
    installFetch((url, method) => {
      if (/\/acceso\/validar/.test(url) && method === "GET") {
        return jsonResponse(200, { nombre: "Ana", valido: true });
      }
      if (/\/empleada/.test(url) && method === "GET") {
        return jsonResponse(500, { code: "ERROR_INTERNO", message: "x" });
      }
      return null;
    });
    const { container } = render(<ConsultaView token="tok-abc" hoy={HOY} />);
    const mensajes = await screen.findAllByText(/no pudimos|error/i);
    expect(mensajes.length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
  });
});
