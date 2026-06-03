// RED — Spec B. Dialog/Modal: apertura, rol dialog con nombre, cierre con Esc (AC-8).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./Dialog";

function Fixture() {
  return (
    <Dialog>
      <DialogTrigger>Eliminar</DialogTrigger>
      <DialogContent>
        <DialogTitle>Eliminar liquidación</DialogTitle>
        <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog (Spec B)", () => {
  it("AC-8: abre el diálogo con rol dialog y nombre accesible", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar liquidación" });
    expect(dialog).toBeInTheDocument();
  });

  it("AC-8: se cierra con la tecla Escape", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
