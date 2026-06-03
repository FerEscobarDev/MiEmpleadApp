// RED — Spec B. TaskChecklist: casillas, marcado e invocación de callback,
// modo solo-lectura (AC-12, EC-3).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskChecklist } from "./TaskChecklist";

const tareas = [
  { rutinaTareaId: "t1", descripcion: "Trapear", hecha: false },
  { rutinaTareaId: "t2", descripcion: "Lavar loza", hecha: true, horaInicio: "08:00" },
];

describe("TaskChecklist (Spec B)", () => {
  it("AC-12: renderiza cada tarea con casilla y descripción", () => {
    render(<TaskChecklist tareas={tareas} />);
    expect(screen.getByRole("checkbox", { name: /Trapear/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Lavar loza/ })).toBeInTheDocument();
  });

  it("AC-12: en modo marcable, alternar invoca el callback con id y nuevo estado", async () => {
    const onToggle = vi.fn();
    render(<TaskChecklist tareas={tareas} editable onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Trapear/ }));
    expect(onToggle).toHaveBeenCalledWith("t1", true);
  });

  it("EC-3: en modo solo-lectura las casillas no invocan callback", async () => {
    const onToggle = vi.fn();
    render(<TaskChecklist tareas={tareas} onToggle={onToggle} />);
    const box = screen.getByRole("checkbox", { name: /Trapear/ });
    await userEvent.click(box).catch(() => {});
    expect(onToggle).not.toHaveBeenCalled();
  });
});
