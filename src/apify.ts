import { AppError } from "./errors";

const APIFY_BASE = "https://api.apify.com/v2/acts";

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

function actorPathId(actorId: string): string {
  return actorId.replace("/", "~");
}

function apifyMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { message?: unknown } }).error;
  if (error && typeof error.message === "string" && error.message.length > 0) {
    return error.message.slice(0, 300);
  }
  return null;
}

export async function runActorGetItems(
  options: {
    token: string;
    actorId: string;
    input: unknown;
    timeoutSecs: number;
  },
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>[]> {
  const timeoutSecs = options.timeoutSecs;
  const url = `${APIFY_BASE}/${actorPathId(options.actorId)}/run-sync-get-dataset-items?timeout=${timeoutSecs}`;

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(options.input),
      signal: AbortSignal.timeout((timeoutSecs + 5) * 1000),
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new AppError(504, "UPSTREAM_TIMEOUT", "Apify did not finish in time");
    }
    throw new AppError(502, "UPSTREAM_FAILED", "Could not reach Apify");
  }

  let parsed: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
  }

  if (response.status === 408 || response.status === 504) {
    throw new AppError(504, "UPSTREAM_TIMEOUT", "Apify did not finish in time");
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError(502, "UPSTREAM_AUTH", "Apify rejected the API token");
  }

  if (!response.ok) {
    const detail = apifyMessage(parsed);
    throw new AppError(502, "UPSTREAM_FAILED", detail ?? `Apify returned HTTP ${response.status}`);
  }

  if (!Array.isArray(parsed)) {
    throw new AppError(502, "UPSTREAM_FAILED", "Apify returned an unexpected payload");
  }

  return parsed.filter((item): item is Record<string, unknown> => {
    return item !== null && typeof item === "object" && !Array.isArray(item);
  });
}
