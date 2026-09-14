import { renderFacebookNote } from "./markdown";
import type { CanonicalPost, ExtractSuccess } from "./types";

export function decodeJsonEscapes(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\\//g, "/");
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return decodeJsonEscapes(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function formatFacebookPost(
  raw: Record<string, unknown>,
  inputUrl: string,
): Promise<ExtractSuccess> {
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

  const note = await renderFacebookNote(data);

  return {
    ok: true,
    platform: "facebook",
    input: { type: "url", value: inputUrl },
    filename: note.filename,
    markdown: note.markdown,
    data,
  };
}
