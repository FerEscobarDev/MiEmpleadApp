// RED — Spec B. La ruta /dev/design-system es solo de desarrollo: en producción
// debe llamar notFound() (AC-14, BR-5).
import { describe, it, expect, vi, afterEach } from "vitest";

// next/navigation.notFound lanza para abortar el render; lo mockeamos para
// poder afirmar que se invoca.
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("assertDevOnly (Spec B)", () => {
  it("AC-14: en producción invoca notFound()", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { assertDevOnly } = await import("./guard");
    expect(() => assertDevOnly()).toThrow();
    expect(notFound).toHaveBeenCalled();
  });

  it("AC-14: en desarrollo no invoca notFound()", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { assertDevOnly } = await import("./guard");
    expect(() => assertDevOnly()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
