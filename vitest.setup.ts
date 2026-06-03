import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom no implementa ResizeObserver, que Radix usa internamente (ej. el thumb del
// Switch vía use-size). Polyfill mínimo no-op para que los componentes Radix se
// monten en el entorno de pruebas.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Desmonta el árbol de React y limpia el DOM entre tests para evitar fugas de
// estado entre casos (elementos duplicados, estado de componentes previos).
afterEach(() => {
  cleanup();
});
