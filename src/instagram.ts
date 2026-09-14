import { AppError } from "./errors";
import type { CanonicalPost } from "./types";

export const GOOGLEBOT_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export async function fetchInstagramPostHtml(
  _url: string,
  shortcode: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const targetUrl = `https://www.instagram.com/p/${shortcode}/`;

  let response: Response;
  try {
    response = await fetcher(targetUrl, {
      headers: {
        "User-Agent": GOOGLEBOT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Dest": "document",
      },
    });
  } catch (err) {
    throw new AppError(
      502,
      "UPSTREAM_FAILED",
      `Failed to connect to Instagram: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  if (response.status === 404) {
    throw new AppError(404, "POST_NOT_FOUND", "Instagram post not found");
  }

  if (!response.ok) {
    throw new AppError(
      502,
      "UPSTREAM_FAILED",
      `Instagram returned status ${response.status}`,
    );
  }

  return await response.text();
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#064;/g, "@")
    .replace(/&#x2022;/g, "•");
}

export function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) {
    const attrs = m[1];
    const propMatch = attrs.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']*)["']/i);
    if (propMatch && contentMatch) {
      meta[propMatch[1].toLowerCase()] = decodeHtmlEntities(contentMatch[1]);
    }
  }
  return meta;
}

export function parseDescriptionMeta(desc: string | null | undefined): {
  likes: number | null;
  comments: number | null;
  author: string | null;
  caption: string | null;
} | null {
  if (!desc) return null;
  const trimmed = desc.trim();

  // Pattern with likes and comments:
  // "658 likes, 5 comments - gitskins on September 6, 2026: \"caption\""
  const metricMatch = trimmed.match(
    /^([0-9,]+)\s+likes?,\s+([0-9,]+)\s+comments?\s+-\s+([^:]+)(?::\s*"?([\s\S]*?)"?\s*)?$/,
  );
  if (metricMatch) {
    const likes = Number.parseInt(metricMatch[1].replace(/,/g, ""), 10);
    const comments = Number.parseInt(metricMatch[2].replace(/,/g, ""), 10);
    let authorPart = metricMatch[3].trim();
    const onMatch = authorPart.match(/^(.+?)\s+on\s+.+$/);
    if (onMatch) {
      authorPart = onMatch[1].trim();
    }
    let caption = metricMatch[4]?.trim() || null;
    if (caption) {
      caption = caption.replace(/^["']+|["'.\s]+$/g, "").trim() || null;
    }
    return {
      likes: Number.isFinite(likes) ? likes : null,
      comments: Number.isFinite(comments) ? comments : null,
      author: authorPart || null,
      caption,
    };
  }

  // Pattern without likes/comments:
  // "gitskins on September 6, 2026: \"caption\""
  const noMetricMatch = trimmed.match(/^([^:]+):\s*"?([\s\S]*?)"?\s*$/);
  if (noMetricMatch) {
    let authorPart = noMetricMatch[1].trim();
    const onMatch = authorPart.match(/^(.+?)\s+on\s+.+$/);
    if (onMatch) {
      authorPart = onMatch[1].trim();
    }
    let caption = noMetricMatch[2]?.trim() || null;
    if (caption) {
      caption = caption.replace(/^["']+|["'.\s]+$/g, "").trim() || null;
    }
    return { likes: null, comments: null, author: authorPart || null, caption };
  }

  return null;
}

interface RawPolarisMedia {
  pk?: string;
  id?: string;
  code?: string;
  taken_at?: number;
  like_count?: number;
  comment_count?: number;
  caption?: { text?: string };
  display_uri?: string;
  user?: {
    pk?: string;
    id?: string;
    username?: string;
    full_name?: string;
  };
  if_not_gated_logged_out?: RawPolarisMedia;
  xig_polaris_media?: RawPolarisMedia;
}

function findMediaNode(obj: unknown, shortcode: string): RawPolarisMedia | null {
  if (!obj || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;

  if (record.xig_polaris_media && typeof record.xig_polaris_media === "object") {
    const m = record.xig_polaris_media as RawPolarisMedia;
    return m.if_not_gated_logged_out ?? m;
  }

  if (record.code === shortcode && (record.pk || record.id)) {
    const m = record as RawPolarisMedia;
    return m.if_not_gated_logged_out ?? m;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findMediaNode(item, shortcode);
      if (found) return found;
    }
  } else {
    for (const key of Object.keys(record)) {
      const found = findMediaNode(record[key], shortcode);
      if (found) return found;
    }
  }

  return null;
}

export function parseInstagramHtml(
  html: string,
  inputUrl: string,
  shortcode: string,
): CanonicalPost {
  // Strategy 1: Find embedded Polaris media JSON in <script> tags
  let mediaData: RawPolarisMedia | null = null;
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1];
    if (
      !content.includes("xig_polaris_media") &&
      !content.includes("XIGPolaris") &&
      !content.includes(shortcode)
    ) {
      continue;
    }

    try {
      const parsed = JSON.parse(content);
      const media = findMediaNode(parsed, shortcode);
      if (media) {
        mediaData = media;
        break;
      }
    } catch {
      // Not top-level JSON, ignore
    }
  }

  // Strategy 2: Meta tags
  const meta = extractMetaTags(html);
  const metaParsed = parseDescriptionMeta(meta["og:description"] ?? meta.description);

  // If no media JSON and no meta info at all, post is unavailable or not found
  if (
    !mediaData &&
    !metaParsed?.author &&
    !meta["og:title"] &&
    !meta["og:image"] &&
    !meta["instapp:owner_user_id"]
  ) {
    throw new AppError(404, "POST_NOT_FOUND", "Instagram post not found or unavailable");
  }

  const id =
    mediaData?.pk ??
    mediaData?.id ??
    (meta["instapp:owner_user_id"] ? String(meta["instapp:owner_user_id"]) : null);
  const canonicalShortcode = mediaData?.code ?? shortcode;
  const url = meta["og:url"] ?? `https://www.instagram.com/p/${canonicalShortcode}/`;

  const userObj = mediaData?.user;
  const authorHandle = userObj?.username ?? metaParsed?.author ?? null;
  const authorName = userObj?.full_name ?? null;
  const authorId =
    userObj?.pk ??
    userObj?.id ??
    (meta["instapp:owner_user_id"] ? String(meta["instapp:owner_user_id"]) : null);
  const authorUrl = authorHandle ? `https://www.instagram.com/${authorHandle}/` : null;

  const caption = mediaData?.caption?.text ?? metaParsed?.caption ?? null;
  const thumbnailUrl = mediaData?.display_uri ?? meta["og:image"] ?? null;

  const likes =
    typeof mediaData?.like_count === "number"
      ? mediaData.like_count
      : (metaParsed?.likes ?? null);
  const comments =
    typeof mediaData?.comment_count === "number"
      ? mediaData.comment_count
      : (metaParsed?.comments ?? null);

  let postedAt: string | null = null;
  if (typeof mediaData?.taken_at === "number") {
    postedAt = new Date(mediaData.taken_at * 1000).toISOString();
  }

  return {
    id: id ? String(id) : null,
    shortcode: canonicalShortcode,
    url,
    originalUrl: inputUrl,
    status: "available",
    author: {
      handle: authorHandle,
      name: authorName,
      id: authorId ? String(authorId) : null,
      url: authorUrl,
    },
    caption,
    thumbnailUrl,
    metrics: {
      likes,
      comments,
      shares: null,
      views: null,
    },
    postedAt,
    scrapedAt: new Date().toISOString(),
  };
}
