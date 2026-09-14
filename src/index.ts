import { AppError } from "./errors";
import { MAX_URL_LENGTH } from "./env";
import { corsPreflight, errorResponse, fromAppError, json, readJsonObject } from "./http";
import { parseExtractInput, routeExtract } from "./router";
import type { Env } from "./types";

function requestId(request: Request): string {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}

function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(fields));
}

async function handleExtract(request: Request, env: Env, id: string): Promise<Response> {
  const started = Date.now();
  const body = await readJsonObject(request);
  const url = parseExtractInput(body, MAX_URL_LENGTH);

  try {
    const result = await routeExtract(url, env);
    log({
      level: "info",
      msg: "extract.ok",
      requestId: id,
      platform: result.platform,
      status: result.data.status,
      filename: result.filename,
      ms: Date.now() - started,
    });
    return json(result);
  } catch (err) {
    if (err instanceof AppError) {
      log({
        level: "warn",
        msg: "extract.fail",
        requestId: id,
        code: err.code,
        status: err.status,
        ms: Date.now() - started,
      });
      return fromAppError(err);
    }
    throw err;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request);

    try {
      if (request.method === "OPTIONS") {
        return corsPreflight();
      }

      const path = new URL(request.url).pathname;

      if (request.method === "GET" && path === "/health") {
        return json({ ok: true });
      }

      if (request.method === "GET" && path === "/v1/threads") {
        const urlParam = new URL(request.url).searchParams.get("url");
        if (!urlParam?.trim()) {
          throw new AppError(400, "INVALID_INPUT", "url query parameter is required");
        }
        const started = Date.now();
        const result = await routeExtract(urlParam.trim(), env);
        log({
          level: "info",
          msg: "extract.ok",
          requestId: id,
          platform: result.platform,
          status: result.data.status,
          filename: result.filename,
          ms: Date.now() - started,
        });
        return json(result);
      }

      if (request.method === "POST" && (path === "/v1/extract" || path === "/" || path === "/v1/threads")) {
        return await handleExtract(request, env, id);
      }

      return errorResponse(404, "NOT_FOUND", "Not found");
    } catch (err) {
      if (err instanceof AppError) {
        return fromAppError(err);
      }
      log({
        level: "error",
        msg: "unhandled",
        requestId: id,
        error: err instanceof Error ? err.name : "unknown",
      });
      return errorResponse(500, "INTERNAL", "Internal error");
    }
  },
};
