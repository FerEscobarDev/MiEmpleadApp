// RED — Spec employer-shell. Guard de rutas protegidas: consume obtenerSesion vía
// cliente tipado; autenticado=false (o fallo) redirige a /login y no muestra el
// contenido; autenticado=true renderiza los hijos (AC-5, AC-6, EC-1).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  usePathname: () => "/",
}));

import { SessionGuard } from "./SessionGuard";

const sesionJson = (autenticado: boolean) =>
  new Response(JSON.stringify({ autenticado, email: autenticado ? "j@e.com" : null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("SessionGuard (Spec employer-shell)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-6: con sesión autenticada renderiza los hijos protegidos", async () => {
    fetchMock.mockResolvedValue(sesionJson(true));
    render(
      <SessionGuard>
        <p>Panel del empleador</p>
      </SessionGuard>,
    );
    expect(await screen.findByText("Panel del empleador")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith("/login");
  });

  it("AC-5: sin sesión (autenticado=false) redirige a /login y no muestra el contenido", async () => {
    fetchMock.mockResolvedValue(sesionJson(false));
    render(
      <SessionGuard>
        <p>Panel del empleador</p>
      </SessionGuard>,
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Panel del empleador")).not.toBeInTheDocument();
  });

  it("EC-1: si obtenerSesion falla, trata como no autenticado y redirige a /login", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    render(
      <SessionGuard>
        <p>Panel del empleador</p>
      </SessionGuard>,
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Panel del empleador")).not.toBeInTheDocument();
  });
});
