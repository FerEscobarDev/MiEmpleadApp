// RED — Spec employer-shell. Shell del empleador: nav + control "Cerrar sesión"
// que consume cerrarSesionEmpleador vía cliente tipado y redirige a /login
// (AC-2, AC-3, AC-4, EC-2). Sin servidor: fetch y next/navigation mockeados.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  usePathname: () => "/",
}));

import { EmployerShell } from "./EmployerShell";

const noContent = (status: number) => new Response(null, { status });

describe("EmployerShell (Spec employer-shell)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockReset();
    fetchMock = vi.fn().mockResolvedValue(noContent(204));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-2: renderiza un control accesible 'Cerrar sesión' y muestra los hijos", () => {
    render(
      <EmployerShell>
        <p>Contenido protegido</p>
      </EmployerShell>,
    );
    expect(screen.getByRole("button", { name: /Cerrar sesión/i })).toBeInTheDocument();
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it("AC-3: al cerrar sesión invoca cerrarSesionEmpleador (POST /auth/logout) una vez", async () => {
    render(
      <EmployerShell>
        <p>x</p>
      </EmployerShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/v1/auth/logout");
    const init = fetchMock.mock.calls[0][1] ?? {};
    expect(String(init.method).toUpperCase()).toBe("POST");
  });

  it("AC-4: tras un 204 navega a /login", async () => {
    render(
      <EmployerShell>
        <p>x</p>
      </EmployerShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("EC-2: un logout que falla igualmente navega a /login", async () => {
    fetchMock.mockResolvedValue(noContent(500));
    render(
      <EmployerShell>
        <p>x</p>
      </EmployerShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});
