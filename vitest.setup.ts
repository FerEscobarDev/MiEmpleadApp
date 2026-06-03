import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Desmonta el árbol de React y limpia el DOM entre tests para evitar fugas de
// estado entre casos (elementos duplicados, estado de componentes previos).
afterEach(() => {
  cleanup();
});
