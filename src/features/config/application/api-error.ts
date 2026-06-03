// Envelope de error único del contrato (api-contract.openapi.yaml → Error):
// { code, message, details? }. Reutilizado por todos los Route Handlers del
// feature config (architecture.md §5.3). Centraliza la construcción de la
// Response JSON con el status correcto para no duplicar el shape en cada handler.

export interface ErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

// Código de negocio estable para fallos de validación de entrada (Zod) en la
// frontera. El contrato mapea validación → 422 (BadRequest).
export const CODE_VALIDACION = "VALIDACION";

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorEnvelope = { code, message };
  if (details !== undefined) {
    body.details = details;
  }
  return Response.json(body, { status });
}

// Respuesta de validación fallida (422) a partir de los issues de Zod.
export function validationErrorResponse(details: unknown): Response {
  return errorResponse(422, CODE_VALIDACION, "Datos inválidos.", details);
}
