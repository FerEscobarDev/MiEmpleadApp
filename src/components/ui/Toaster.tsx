"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

// Toast del Design System (design_system.md §3 — Toast). Feedback no bloqueante;
// variantes success | error | info. Respeta prefers-reduced-motion (Sonner lo hace).
export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      theme={(theme as "light" | "dark" | "system") ?? "system"}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-md border border-border bg-surface text-foreground shadow-md",
        },
      }}
    />
  );
}
