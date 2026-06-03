// RED — Spec C. El cliente tipado generado desde el contrato dirige las
// peticiones al path correcto bajo /api/v1, sustituyendo params de path,
// sin URLs escritas a mano (AC-3, AC-4, AC-5, EC-3).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "./client";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("apiClient (Spec C)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(okJson({}));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-3/AC-4: GET /empleada apunta a /api/v1/empleada", async () => {
    await apiClient.GET("/empleada");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/v1/empleada");
  });

  it("AC-5: obtenerLiquidacion sustituye los params de path", async () => {
    await apiClient.GET("/liquidaciones/{anio}/{mes}", {
      params: { path: { anio: 2026, mes: 6 } },
    });
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/v1/liquidaciones/2026/6");
  });

  it("EC-3: una respuesta 4xx se devuelve como { error } sin lanzar", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "NO_AUTORIZADO", message: "x" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { error } = await apiClient.GET("/empleada");
    expect(error).toBeTruthy();
  });
});
