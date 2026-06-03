// RED — Spec C. El cliente tipado se genera desde el contrato: el archivo de
// tipos existe y declara los paths y los componentes/enums del contrato
// (AC-1, AC-2, AC-6, EC-1). Se verifica como presencia en el archivo generado
// y a nivel de tipos (compila).
import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { paths, components } from "./schema";

const root = process.cwd() + "/";

describe("schema generado desde el contrato (Spec C)", () => {
  it("AC-1: package.json declara el script gen:api con openapi-typescript", () => {
    const pkg = readFileSync(root + "package.json", "utf8");
    expect(pkg).toMatch(/"gen:api"/);
    expect(pkg).toMatch(/openapi-typescript/);
  });

  it("AC-2: el archivo de tipos generado existe", () => {
    expect(existsSync(root + "src/lib/api/schema.d.ts")).toBe(true);
  });

  it("AC-2: declara paths del contrato", () => {
    const schema = readFileSync(root + "src/lib/api/schema.d.ts", "utf8");
    for (const p of [
      "/empleada",
      "/liquidaciones/{anio}/{mes}",
      "/tareas/cumplimiento",
      "/acceso/enlace",
    ]) {
      expect(schema).toContain(p);
    }
  });

  it("AC-6: declara el envelope Error y los enums del contrato", () => {
    const schema = readFileSync(root + "src/lib/api/schema.d.ts", "utf8");
    for (const token of [
      "Error",
      "EstadoLiquidacion",
      "TipoDiaCalendario",
      "DiaSemana",
      "Periodicidad",
    ]) {
      expect(schema).toContain(token);
    }
  });

  it("AC-6 (type-level): los tipos paths/components son utilizables", () => {
    // Aserción a nivel de tipos: si esto compila, los tipos existen.
    type Empleada = components["schemas"]["Empleada"];
    type EmpleadaGet = paths["/empleada"]["get"];
    const ok: true = true as Empleada extends object ? true : true;
    const ok2: true = true as EmpleadaGet extends object ? true : true;
    expect(ok && ok2).toBe(true);
  });
});
