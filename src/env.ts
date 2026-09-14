import { AppError } from "./errors";
import type { Env } from "./types";

export const DEFAULT_FACEBOOK_ACTOR = "clappi/facebook-posts-reels-scraper";
export const DEFAULT_TIMEOUT_SECS = 55;
export const MAX_URL_LENGTH = 2048;

export function requireConfig(env: Env): {
  token: string;
  facebookActor: string;
  timeoutSecs: number;
} {
  const token = env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new AppError(500, "MISCONFIGURED", "APIFY_TOKEN is not set");
  }

  const rawTimeout = env.APIFY_TIMEOUT_SECS ? Number(env.APIFY_TIMEOUT_SECS) : DEFAULT_TIMEOUT_SECS;
  const timeoutSecs = Number.isFinite(rawTimeout)
    ? Math.min(120, Math.max(5, Math.trunc(rawTimeout)))
    : DEFAULT_TIMEOUT_SECS;

  return {
    token,
    facebookActor: env.APIFY_FACEBOOK_ACTOR?.trim() || DEFAULT_FACEBOOK_ACTOR,
    timeoutSecs,
  };
}
