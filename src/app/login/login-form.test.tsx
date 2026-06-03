// RED — Spec login-page. Formulario de inicio de sesión del empleador:
// renderiza campos accesibles, consume iniciarSesionEmpleador vía cliente tipado,
// redirige al éxito, muestra error en línea con 401, estado de carga al enviar
// (AC-1..AC-5, EC-1, EC-2). Sin servidor: se mockea fetch global y next/navigation.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
}));

import { LoginForm } from "./login-form";

const noContent = (status: number) => new Response(null, { status });
const errorJson = (status: number, code: string) =>
  new Response(JSON.stringify({ code, message: "x" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function fillAndSubmit(email = "jefe@ejemplo.com", password = "secreta123") {
  await userEvent.type(screen.getByLabelText(/Correo electrónico/i), email);
  await userEvent.type(screen.getByLabelText(/Contraseña/i), password);
  await userEvent.click(screen.getByRole("button", { name: /Entrar/i }));
}

describe("LoginForm (Spec login-page)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockReset();
    fetchMock = vi.fn().mockResolvedValue(noContent(204));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: renderiza campos de email y contraseña y un botón Entrar accesibles", () => {
    render(<LoginForm />);
    const email = screen.getByLabelText(/Correo electrónico/i);
    const password = screen.getByLabelText(/Contraseña/i);
    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /Entrar/i })).toBeInTheDocument();
  });

  it("AC-2: al enviar invoca iniciarSesionEmpleador (POST /auth/login) una vez con las credenciales", async () => {
    render(<LoginForm />);
    await fillAndSubmit("jefe@ejemplo.com", "secreta123");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/v1/auth/login");
    const init = fetchMock.mock.calls[0][1] ?? {};
    const body = typeof init.body === "string" ? init.body : "";
    expect(body).toContain("jefe@ejemplo.com");
    expect(body).toContain("secreta123");
  });

  it("AC-3: tras un 204 navega a /", async () => {
    render(<LoginForm />);
    await fillAndSubmit();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });

  it("AC-4: con 401 muestra error en línea 'Credenciales inválidas.' y no navega", async () => {
    fetchMock.mockResolvedValue(errorJson(401, "NO_AUTORIZADO"));
    render(<LoginForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/Credenciales inválidas\./i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("AC-5: durante el envío el botón queda deshabilitado y aria-busy", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    );
    render(<LoginForm />);
    await fillAndSubmit();
    const btn = screen.getByRole("button", { name: /Entrar/i });
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveAttribute("aria-busy", "true");
    resolveFetch(noContent(204));
  });

  it("EC-1: un fallo de servidor (500) muestra el mensaje genérico y no navega", async () => {
    fetchMock.mockResolvedValue(errorJson(500, "ERROR_INTERNO"));
    render(<LoginForm />);
    await fillAndSubmit();
    expect(
      await screen.findByText(/No pudimos iniciar sesión\. Intenta de nuevo\./i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("EC-2: reintentar tras un error limpia el error y procede", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(401, "NO_AUTORIZADO"));
    render(<LoginForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/Credenciales inválidas\./i)).toBeInTheDocument();

    fetchMock.mockResolvedValue(noContent(204));
    await userEvent.click(screen.getByRole("button", { name: /Entrar/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(/Credenciales inválidas\./i)).not.toBeInTheDocument();
  });
});
