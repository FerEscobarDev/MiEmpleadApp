import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests del handler POST /api/v1/auth/logout (Epic 4.1, spec auth-sesion-y-costura).
// El sign-out subyacente (Auth.js) se mockea. Responde 204 y es idempotente.

const signOutMock = vi.fn();

vi.mock("@/features/auth/auth", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

import { POST } from "./route";

function logoutRequest(): Request {
  return new Request("http://localhost/api/v1/auth/logout", { method: "POST" });
}

describe("API POST /api/v1/auth/logout", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it("AC-7: responde 204 e invoca el sign-out", async () => {
    signOutMock.mockResolvedValue(undefined);
    const res = await POST(logoutRequest());
    expect(res.status).toBe(204);
    expect(signOutMock).toHaveBeenCalled();
  });

  it("EC-3 / AC-7: idempotente — sin sesión también responde 204", async () => {
    signOutMock.mockResolvedValue(undefined);
    const res = await POST(logoutRequest());
    expect(res.status).toBe(204);
  });
});
