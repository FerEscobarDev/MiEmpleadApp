import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del handler POST /api/v1/auth/login (Epic 4.1, spec auth-sesion-y-costura).
// El sign-in subyacente (Auth.js) se mockea: éxito ⇒ 204, fallo de credenciales ⇒
// 401 NO_AUTORIZADO. La validación de entrada (Zod) ⇒ 422 sin tocar el sign-in.

const signInMock = vi.fn();

vi.mock("@/features/auth/auth", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

import { POST } from "./route";

function loginRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("API POST /api/v1/auth/login", () => {
  beforeEach(() => {
    signInMock.mockReset();
  });

  it("AC-6: credenciales válidas responden 204 sin cuerpo", async () => {
    signInMock.mockResolvedValue(undefined);
    const res = await POST(
      loginRequest({ email: "jefe@example.com", password: "clave" }),
    );
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("AC-5: credenciales inválidas responden 401 NO_AUTORIZADO", async () => {
    signInMock.mockRejectedValue(new Error("CredentialsSignin"));
    const res = await POST(
      loginRequest({ email: "jefe@example.com", password: "mala" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("NO_AUTORIZADO");
  });

  it("AC-4: body sin password responde 422 VALIDACION sin invocar sign-in", async () => {
    const res = await POST(loginRequest({ email: "jefe@example.com" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("AC-4: JSON malformado responde 422 VALIDACION (no 500)", async () => {
    const res = await POST(loginRequest("{ roto"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDACION");
    expect(signInMock).not.toHaveBeenCalled();
  });
});
