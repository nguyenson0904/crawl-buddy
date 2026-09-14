import { classify } from "./classify";
import { AppError } from "./errors";
import { requireConfig } from "./env";
import { handleFacebookPost } from "./handlers/facebook";
import { handleThreadsPost } from "./handlers/threads";
import type { Env, ExtractSuccess } from "./types";

export function parseExtractInput(body: Record<string, unknown>, maxUrlLength: number): string {
  const url = body.url;
  if (typeof url !== "string" || !url.trim()) {
    throw new AppError(400, "INVALID_INPUT", "url is required");
  }
  const trimmed = url.trim();
  if (trimmed.length > maxUrlLength) {
    throw new AppError(400, "INVALID_INPUT", "url is too long");
  }
  return trimmed;
}

export async function routeExtract(
  rawUrl: string,
  env: Env,
  fetcher: typeof fetch = fetch,
): Promise<ExtractSuccess> {
  const classified = classify(rawUrl);

  switch (classified.kind) {
    case "invalid":
      throw new AppError(400, "INVALID_INPUT", "url must be an absolute http(s) URL");
    case "facebook_unsupported":
      throw new AppError(
        422,
        "UNSUPPORTED_FACEBOOK_URL",
        "Facebook URL must be a public post, reel, video, photo, or share link",
      );
    case "threads_unsupported":
      throw new AppError(
        422,
        "UNSUPPORTED_THREADS_URL",
        "Threads URL must be a public post, share link, or thread URL",
      );
    case "unsupported_platform":
      throw new AppError(422, "UNSUPPORTED_PLATFORM", "No handler registered for this URL");
    case "facebook_post": {
      const config = requireConfig(env);
      return handleFacebookPost(classified.url, config, fetcher);
    }
    case "threads_post":
      return handleThreadsPost(classified.url, env, fetcher);
  }
}
