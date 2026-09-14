import type { CanonicalPost, ExtractSuccess } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatFacebookPost(
  raw: Record<string, unknown>,
  inputUrl: string,
): ExtractSuccess {
  const status = raw.status === "unavailable" ? "unavailable" : "available";

  const data: CanonicalPost = {
    id: asString(raw.realId) ?? asString(raw.shortcode),
    shortcode: asString(raw.shortcode),
    url: asString(raw.url) ?? inputUrl,
    originalUrl: asString(raw.originalUrl) ?? inputUrl,
    status,
    author: {
      handle: asString(raw.author),
      name: asString(raw.authorName),
      id: asString(raw.authorId),
      url: asString(raw.authorUrl),
    },
    caption: asString(raw.caption),
    thumbnailUrl: asString(raw.thumbnailUrl),
    metrics: {
      likes: asNumber(raw.likes),
      comments: asNumber(raw.comments),
      shares: asNumber(raw.shares),
      views: asNumber(raw.views),
    },
    postedAt: asString(raw.datePosted),
    scrapedAt: asString(raw.scrapedAt),
  };

  return {
    ok: true,
    platform: "facebook",
    input: { type: "url", value: inputUrl },
    data,
  };
}
