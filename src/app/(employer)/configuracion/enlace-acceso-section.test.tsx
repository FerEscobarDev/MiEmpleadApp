// RED — Spec epic-8.2-configuracion/enlace-acceso.
// Tarjeta del enlace de acceso de la empleada dentro de /configuracion: generar/regenerar
// (generarEnlaceAcceso), copiar al portapapeles y revocar con confirmación (revocarEnlaceAcceso),
// todo por el cliente tipado. Sin servidor: fetch mockeado; clipboard stub.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { EnlaceAccesoSection } from "./enlace-acceso-section";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const noContent = (status: number) => new Response(null, { status });
const errorJson = (status: number, code: string) => jsonResponse(status, { code, message: "x" });

const enlaceActivo = {
  token: "tok-123",
  url: "https://miempleadapp.co/consulta/tok-123",
  activo: true,
};

let calls: { url: string; method: string }[];
let fetchMock: ReturnType<typeof vi.fn>;
let clipboardWrite: ReturnType<typeof vi.fn>;

function installFetch(impl?: (url: string, method: string) => Response) {
  calls = [];
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    if (impl) return impl(url, method);
    if (url.includes("/acceso/enlace") && method === "POST") return jsonResponse(200, enlaceActivo);
    if (url.includes("/acceso/enlace") && method === "DELETE") return noContent(204);
    return noContent(404);
  });
  vi.stubGlobal("fetch", fetchMock);
}

function installClipboard() {
  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWrite },
  });
}

const callsTo = (method: string, fragment: string) =>
  calls.filter((c) => c.method === method && c.url.includes(fragment));

describe("EnlaceAccesoSection (Spec enlace-acceso)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    installFetch();
    installClipboard();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("EC-1: estado inicial sin enlace muestra 'Revocado' y permite generar", () => {
    render(<EnlaceAccesoSection />);
    expect(screen.getByText(/Revocado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regenerar|Generar/i })).toBeInTheDocument();
  });

  it("AC-3: Regenerar invoca generarEnlaceAcceso (POST) una vez y muestra la nueva URL", async () => {
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await waitFor(() => expect(callsTo("POST", "/acceso/enlace").length).toBe(1));
    expect(await screen.findByText(enlaceActivo.url)).toBeInTheDocument();
    expect(screen.getByText(/Activo/i)).toBeInTheDocument();
  });

  it("AC-1/AC-2: con enlace activo, copiar escribe la URL en el portapapeles y notifica éxito", async () => {
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await screen.findByText(enlaceActivo.url);
    await userEvent.click(screen.getByRole("button", { name: /Copiar/i }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(enlaceActivo.url));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("AC-4: Revocar abre confirmación; al confirmar invoca revocarEnlaceAcceso (DELETE) una vez", async () => {
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await screen.findByText(enlaceActivo.url);
    await userEvent.click(screen.getByRole("button", { name: /^Revocar$/i }));
    // Diálogo de confirmación.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Confirmar dentro del diálogo.
    await userEvent.click(within(dialog).getByRole("button", { name: /Revocar|Confirmar/i }));
    await waitFor(() => expect(callsTo("DELETE", "/acceso/enlace").length).toBe(1));
  });

  it("AC-4: cancelar la confirmación NO invoca revocarEnlaceAcceso", async () => {
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await screen.findByText(enlaceActivo.url);
    await userEvent.click(screen.getByRole("button", { name: /^Revocar$/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(callsTo("DELETE", "/acceso/enlace").length).toBe(0);
  });

  it("AC-5: tras revocar con éxito, refleja estado revocado y deshabilita copiar", async () => {
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await screen.findByText(enlaceActivo.url);
    await userEvent.click(screen.getByRole("button", { name: /^Revocar$/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Revocar|Confirmar/i }));
    await waitFor(() => expect(screen.getByText(/Revocado/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Copiar/i })).toBeDisabled();
  });

  it("EC-2: si generarEnlaceAcceso falla, muestra Toast de error", async () => {
    installFetch((url, method) =>
      url.includes("/acceso/enlace") && method === "POST" ? errorJson(500, "ERROR") : noContent(404),
    );
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("EC-4: si el portapapeles falla, muestra Toast de error en vez de éxito", async () => {
    clipboardWrite.mockRejectedValue(new Error("denied"));
    render(<EnlaceAccesoSection />);
    await userEvent.click(screen.getByRole("button", { name: /Regenerar|Generar/i }));
    await screen.findByText(enlaceActivo.url);
    await userEvent.click(screen.getByRole("button", { name: /Copiar/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
