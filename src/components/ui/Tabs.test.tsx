// RED — Spec B. Tabs: roles tab/tablist/tabpanel y cambio de panel (AC-7).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

function Fixture() {
  return (
    <Tabs defaultValue="pago">
      <TabsList>
        <TabsTrigger value="pago">Pago</TabsTrigger>
        <TabsTrigger value="menu">Menú</TabsTrigger>
      </TabsList>
      <TabsContent value="pago">Panel de pago</TabsContent>
      <TabsContent value="menu">Panel de menú</TabsContent>
    </Tabs>
  );
}

describe("Tabs (Spec B)", () => {
  it("AC-7: expone tablist y tabs", () => {
    render(<Fixture />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pago" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Menú" })).toBeInTheDocument();
  });

  it("AC-7: al activar otra pestaña muestra su panel", async () => {
    render(<Fixture />);
    expect(screen.getByText("Panel de pago")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Menú" }));
    expect(screen.getByText("Panel de menú")).toBeInTheDocument();
  });
});
