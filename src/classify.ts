import type { Classification } from "./types";

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "mobile.facebook.com",
  "mbasic.facebook.com",
  "fb.com",
  "www.fb.com",
  "fb.watch",
  "www.fb.watch",
]);

const THREADS_HOSTS = new Set([
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
]);

const POST_ROOT_SEGMENTS = new Set([
  "reel",
  "reels",
  "watch",
  "videos",
  "photo.php",
  "photo",
  "photos",
  "permalink.php",
  "story.php",
]);

const POST_ANY_SEGMENTS = new Set(["posts", "photos", "videos", "reel", "reels"]);

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function isFacebookHost(host: string): boolean {
  const h = normalizeHost(host);
  return FACEBOOK_HOSTS.has(h) || h.endsWith(".facebook.com") || h.endsWith(".fb.com");
}

function isThreadsHost(host: string): boolean {
  const h = normalizeHost(host);
  return THREADS_HOSTS.has(h) || h.endsWith(".threads.net") || h.endsWith(".threads.com");
}

function isThreadsPostUrl(url: URL): boolean {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return false;

  const first = parts[0]?.toLowerCase();
  const second = parts[1]?.toLowerCase();

  if (first === "share" || first === "t") return true;
  if (first?.startsWith("@") && second === "post") return true;
  if (first === "post") return true;
  if (parts.length >= 2 && second === "post") return true;

  return false;
}

function isFacebookPostUrl(url: URL): boolean {
  const host = normalizeHost(url.hostname);
  if (host === "fb.watch" || host === "www.fb.watch") {
    return url.pathname.replace(/\/+$/, "").length > 0;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0]?.toLowerCase();
  const second = parts[1]?.toLowerCase();

  if (first && POST_ROOT_SEGMENTS.has(first)) return true;
  if (first === "share" && (second === "p" || second === "r" || second === "v")) return true;
  if (parts.some((p) => POST_ANY_SEGMENTS.has(p.toLowerCase()))) return true;
  if (url.searchParams.has("story_fbid")) return true;
  if (url.searchParams.has("v") && (first === "watch" || url.pathname.includes("/watch"))) return true;
  return false;
}

export function classify(raw: string): Classification {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid", reason: "empty" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: "invalid", reason: "not_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "invalid", reason: "not_url" };
  }

  if (isFacebookHost(url.hostname)) {
    if (isFacebookPostUrl(url)) {
      return { kind: "facebook_post", platform: "facebook", url: url.toString() };
    }
    return { kind: "facebook_unsupported", platform: "facebook", url: url.toString() };
  }

  if (isThreadsHost(url.hostname)) {
    if (isThreadsPostUrl(url)) {
      return { kind: "threads_post", platform: "threads", url: url.toString() };
    }
    return { kind: "threads_unsupported", platform: "threads", url: url.toString() };
  }

  return { kind: "unsupported_platform", url: url.toString() };
}
