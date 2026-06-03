import { handlers } from "@/features/auth/auth";

// Route Handler interno de Auth.js (App Router). Expone los endpoints que Auth.js
// gestiona (callback de credenciales, CSRF, etc.). NO forma parte del contrato de
// API público (/api/v1/auth/* son los handlers delgados del contrato).
export const { GET, POST } = handlers;
