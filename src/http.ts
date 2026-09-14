import { AppError } from "./errors";
import type { ErrorBody } from "./types";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
} as const;

export const MAX_JSON_BYTES = 16_384;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS,
    },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  const body: ErrorBody = { ok: false, error: { code, message } };
  return json(body, status);
}

export function fromAppError(err: AppError): Response {
  return errorResponse(err.status, err.code, err.message);
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

export async function readJsonObject(request: Request, maxBytes = MAX_JSON_BYTES): Promise<Record<string, unknown>> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  if (buf.byteLength === 0) {
    throw new AppError(400, "INVALID_INPUT", "JSON body is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new AppError(400, "INVALID_INPUT", "Body must be valid JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(400, "INVALID_INPUT", "JSON body must be an object");
  }

  return parsed as Record<string, unknown>;
}
