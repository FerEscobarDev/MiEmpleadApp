// RED — Spec C. Andamiaje PWA: existe un manifest válido con los campos
// requeridos para instalación (AC-7, BR-3, BR-4).
import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";

const root = process.cwd() + "/";
const manifestPath = root + "public/manifest.webmanifest";

describe("PWA manifest (Spec C)", () => {
  it("AC-7: existe public/manifest.webmanifest", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("AC-7: declara los campos de instalación PWA", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("es-CO");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
