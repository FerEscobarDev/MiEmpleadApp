// RED — Spec epic-8.7-consulta-empleada/consult-client-shell (AC-5, AC-6, EC-3).
// El cliente de consulta inyecta el header X-Acceso-Token en cada petición y el
// helper de cumpleaños compara por mes+día. Sin servidor: fetch mockeado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsultaClient, esCumpleanosHoy } from "./consulta-client";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("createConsultaClient — inyección de X-Acceso-Token (AC-5)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let lastInit: RequestInit | undefined;

  beforeEach(() => {
    lastInit = undefined;
    fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      lastInit = init;
      return okJson({ nombre: "Ana", valido: true });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function headerValue(init: RequestInit | undefined, name: string): string | null {
    const h = init?.headers;
    if (!h) return null;
    if (h instanceof Headers) return h.get(name);
    if (Array.isArray(h)) {
      const found = h.find(([k]) => k.toLowerCase() === name.toLowerCase());
      return found ? found[1] : null;
    }
    const rec = h as Record<string, string>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? rec[key] : null;
  }

  it("AC-5: GET /acceso/validar adjunta el header X-Acceso-Token con el token", async () => {
    const client = createConsultaClient("tok-123");
    await client.GET("/acceso/validar");
    expect(fetchMock).toHaveBeenCalled();
    expect(headerValue(lastInit, "X-Acceso-Token")).toBe("tok-123");
  });

  it("AC-5: GET /empleada también adjunta el header X-Acceso-Token", async () => {
    const client = createConsultaClient("tok-xyz");
    await client.GET("/empleada");
    expect(headerValue(lastInit, "X-Acceso-Token")).toBe("tok-xyz");
  });
});

describe("esCumpleanosHoy — comparación por mes+día (AC-6, EC-3)", () => {
  it("AC-6: coincide mes y día de hoy → true", () => {
    const hoy = new Date(2026, 5, 3); // 3 de junio de 2026 (local)
    expect(esCumpleanosHoy("1990-06-03", hoy)).toBe(true);
  });

  it("AC-6: no coincide el día → false", () => {
    const hoy = new Date(2026, 5, 3);
    expect(esCumpleanosHoy("1990-06-04", hoy)).toBe(false);
  });

  it("EC-3: año distinto pero mismo mes y día → true", () => {
    const hoy = new Date(2026, 5, 3);
    expect(esCumpleanosHoy("1985-06-03", hoy)).toBe(true);
  });

  it("fecha de nacimiento ausente/ inválida → false", () => {
    const hoy = new Date(2026, 5, 3);
    expect(esCumpleanosHoy(undefined, hoy)).toBe(false);
    expect(esCumpleanosHoy("", hoy)).toBe(false);
  });
});
