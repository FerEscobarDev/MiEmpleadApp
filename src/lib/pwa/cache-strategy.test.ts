// RED — Spec 1 (PWA offline). Estrategia de caché del service worker como
// función pura testeable (AC-1..AC-6, EC-1..EC-4). El SW (public/sw.js) espeja
// esta lógica; aquí se certifica la clasificación.
import { describe, it, expect } from "vitest";
import { resolveCacheStrategy } from "./cache-strategy";

const ORIGIN = "https://miempleada.example.com";

describe("resolveCacheStrategy (Spec 1 — PWA offline)", () => {
  it("AC-1: GET /api/v1/menu → network-first", () => {
    expect(
      resolveCacheStrategy({ method: "GET", url: `${ORIGIN}/api/v1/menu` }),
    ).toBe("network-first");
  });

  it("AC-2: GET /api/v1/tareas/dia → network-first", () => {
    expect(
      resolveCacheStrategy({ method: "GET", url: `${ORIGIN}/api/v1/tareas/dia` }),
    ).toBe("network-first");
  });

  it("AC-3: GET /api/v1/tareas/rutina → network-first", () => {
    expect(
      resolveCacheStrategy({
        method: "GET",
        url: `${ORIGIN}/api/v1/tareas/rutina`,
      }),
    ).toBe("network-first");
  });

  it("AC-4: POST /api/v1/tareas/cumplimiento (marcarTarea) → network-only", () => {
    expect(
      resolveCacheStrategy({
        method: "POST",
        url: `${ORIGIN}/api/v1/tareas/cumplimiento`,
      }),
    ).toBe("network-only");
  });

  it("AC-5: navegación GET a /consulta/<token> → app-shell", () => {
    expect(
      resolveCacheStrategy({ method: "GET", url: `${ORIGIN}/consulta/abc123` }),
    ).toBe("app-shell");
  });

  it("AC-6: GET /api/v1/configuracion (ruta del empleador) → network-only", () => {
    expect(
      resolveCacheStrategy({
        method: "GET",
        url: `${ORIGIN}/api/v1/configuracion`,
      }),
    ).toBe("network-only");
  });

  it("EC-1: GET /api/v1/menu/configuracion (empleador, prefijo de /menu) → network-only", () => {
    expect(
      resolveCacheStrategy({
        method: "GET",
        url: `${ORIGIN}/api/v1/menu/configuracion`,
      }),
    ).toBe("network-only");
  });

  it("EC-2: query string en /tareas/dia se ignora → network-first", () => {
    expect(
      resolveCacheStrategy({
        method: "GET",
        url: `${ORIGIN}/api/v1/tareas/dia?fecha=2026-06-03`,
      }),
    ).toBe("network-first");
  });

  it("EC-3: método en minúsculas se trata como GET (case-insensitive)", () => {
    expect(
      resolveCacheStrategy({ method: "get", url: `${ORIGIN}/api/v1/menu` }),
    ).toBe("network-first");
  });

  it("EC-4: URL vacía / no parseable → network-only sin lanzar", () => {
    expect(resolveCacheStrategy({ method: "GET", url: "" })).toBe(
      "network-only",
    );
    expect(resolveCacheStrategy({ method: "GET", url: "::::" })).toBe(
      "network-only",
    );
  });

  it("EC: otra navegación GET no-consulta (/login) → network-only", () => {
    expect(
      resolveCacheStrategy({ method: "GET", url: `${ORIGIN}/login` }),
    ).toBe("network-only");
  });
});
