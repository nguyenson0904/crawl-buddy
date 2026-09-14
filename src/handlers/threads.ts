import { AppError } from "../errors";
import { renderThreadsNote } from "../markdown";
import type { CanonicalPost, ExtractSuccess, MediaItem, ThreadReply } from "../types";

export const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

export function unescapeThreadsJson(str: string): string {
  let result = str;
  for (let i = 0; i < 3; i++) {
    const prev = result;
    result = result
      .replace(/\\u002[fF]/g, "/")
      .replace(/\\u0025/g, "%")
      .replace(/\\u0026/g, "&")
      .replace(/\\u003[dD]/g, "=");
    if (result === prev) break;
  }
  return result;
}

function findKey(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  for (const k of Object.keys(record)) {
    const res = findKey(record[k], key);
    if (res !== null && res !== undefined) return res;
  }
  return null;
}

function extractShortcodeFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const postIdx = parts.indexOf("post");
    if (postIdx !== -1 && parts[postIdx + 1]) {
      return parts[postIdx + 1];
    }
    const shareIdx = parts.indexOf("share");
    if (shareIdx !== -1 && parts[shareIdx + 1]) {
      return parts[shareIdx + 1];
    }
    const tIdx = parts.indexOf("t");
    if (tIdx !== -1 && parts[tIdx + 1]) {
      return parts[tIdx + 1];
    }
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

interface RawCandidate {
  url: string;
  width?: number;
  height?: number;
}

function getBestCandidate(candidates: RawCandidate[]): RawCandidate | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort(
    (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
  );
  return sorted[0] ?? null;
}

function parseRelayData(
  html: string,
  inputUrl: string,
  finalUrl: string,
): CanonicalPost | null {
  const scriptMatches = [...html.matchAll(/<script[^>]*>(.*?)<\/script>/gis)];

  for (const match of scriptMatches) {
    const content = match[1];
    if (!content.includes("thread_items")) continue;

    try {
      const parsed = JSON.parse(content) as unknown;
      const edges = findKey(parsed, "edges");
      if (!Array.isArray(edges) || edges.length === 0) continue;

      const firstEdge = edges[0] as Record<string, unknown>;
      const node = firstEdge?.node as Record<string, unknown>;
      const threadItems = node?.thread_items;
      if (!Array.isArray(threadItems) || threadItems.length === 0) continue;

      const firstItem = threadItems[0] as Record<string, unknown>;
      const mainPost = firstItem?.post as Record<string, unknown>;
      if (!mainPost) continue;

      const user = (mainPost.user as Record<string, unknown>) || {};
      const captionObj = (mainPost.caption as Record<string, unknown>) || {};
      const textPostAppInfo = (mainPost.text_post_app_info as Record<string, unknown>) || {};

      // Extract media
      const media: MediaItem[] = [];
      if (Array.isArray(mainPost.carousel_media)) {
        for (const item of mainPost.carousel_media as Record<string, unknown>[]) {
          const iv2 = item.image_versions2 as Record<string, unknown> | undefined;
          const cands = (iv2?.candidates as RawCandidate[]) || [];
          const best = getBestCandidate(cands);
          if (best?.url) {
            media.push({
              type: "image",
              url: best.url.replace(/&amp;/g, "&"),
              width: best.width ?? null,
              height: best.height ?? null,
            });
          }
        }
      } else {
        const iv2 = mainPost.image_versions2 as Record<string, unknown> | undefined;
        const cands = (iv2?.candidates as RawCandidate[]) || [];
        const best = getBestCandidate(cands);
        if (best?.url) {
          media.push({
            type: "image",
            url: best.url.replace(/&amp;/g, "&"),
            width: best.width ?? null,
            height: best.height ?? null,
          });
        }
      }

      // Extract thread replies
      const threadReplies: ThreadReply[] = [];
      const mainPostId = mainPost.id ? String(mainPost.id) : null;

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i] as Record<string, unknown>;
        const edgeNode = edge?.node as Record<string, unknown>;
        const edgeItems = edgeNode?.thread_items;
        if (!Array.isArray(edgeItems)) continue;

        for (let j = 0; j < edgeItems.length; j++) {
          if (i === 0 && j === 0) continue;
          const item = edgeItems[j] as Record<string, unknown>;
          const post = item?.post as Record<string, unknown>;
          if (!post) continue;

          const replyId = post.id ? String(post.id) : null;
          if (replyId && replyId === mainPostId) continue;

          const replyCaption = post.caption as Record<string, unknown> | undefined;
          const replyText = typeof replyCaption?.text === "string" ? replyCaption.text : null;
          if (!replyText) continue;

          const replyUser = (post.user as Record<string, unknown>) || {};
          const replyLikes = typeof post.like_count === "number" ? post.like_count : null;
          const replyTakenAt = typeof post.taken_at === "number" ? post.taken_at : null;

          threadReplies.push({
            author: {
              handle: typeof replyUser.username === "string" ? replyUser.username : null,
              name: typeof replyUser.full_name === "string" ? replyUser.full_name : null,
              id: replyUser.pk ? String(replyUser.pk) : null,
            },
            text: replyText,
            postedAt: replyTakenAt ? new Date(replyTakenAt * 1000).toISOString() : null,
            likes: replyLikes,
          });
        }
      }

      const shortcode =
        (typeof mainPost.code === "string" ? mainPost.code : null) ??
        extractShortcodeFromUrl(finalUrl) ??
        extractShortcodeFromUrl(inputUrl);

      const handle = typeof user.username === "string" ? user.username : null;
      const id = mainPost.id ? String(mainPost.id) : (mainPost.pk ? String(mainPost.pk) : shortcode);

      const likes = typeof mainPost.like_count === "number" ? mainPost.like_count : null;
      const comments =
        typeof textPostAppInfo.direct_reply_count === "number"
          ? textPostAppInfo.direct_reply_count
          : typeof mainPost.direct_reply_count === "number"
            ? mainPost.direct_reply_count
            : null;
      const reposts =
        typeof textPostAppInfo.repost_count === "number"
          ? textPostAppInfo.repost_count
          : null;
      const quotes =
        typeof textPostAppInfo.quote_count === "number"
          ? textPostAppInfo.quote_count
          : null;
      const reshares =
        typeof textPostAppInfo.reshare_count === "number"
          ? textPostAppInfo.reshare_count
          : reposts;
      const views = typeof mainPost.view_count === "number" ? mainPost.view_count : null;
      const takenAt = typeof mainPost.taken_at === "number" ? mainPost.taken_at : null;

      const canonicalUrl =
        (typeof mainPost.canonical_url === "string" ? mainPost.canonical_url : null) ??
        (handle && shortcode ? `https://www.threads.net/@${handle}/post/${shortcode}` : finalUrl);

      return {
        id,
        shortcode,
        url: canonicalUrl,
        originalUrl: inputUrl,
        status: "available",
        author: {
          handle,
          name: typeof user.full_name === "string" ? user.full_name : null,
          id: user.pk ? String(user.pk) : null,
          url: handle ? `https://www.threads.net/@${handle}` : null,
        },
        caption: typeof captionObj.text === "string" ? captionObj.text : null,
        thumbnailUrl: media[0]?.url ?? null,
        metrics: {
          likes,
          comments,
          shares: reshares,
          views,
          reposts,
          quotes,
        },
        postedAt: takenAt ? new Date(takenAt * 1000).toISOString() : null,
        scrapedAt: new Date().toISOString(),
        media: media.length > 0 ? media : undefined,
        threadReplies: threadReplies.length > 0 ? threadReplies : undefined,
      };
    } catch {
      // Continue to next script tag
    }
  }

  return null;
}

function parseRegexFallback(
  html: string,
  inputUrl: string,
  finalUrl: string,
): CanonicalPost {
  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);

  const rawCaption = ogDescMatch ? ogDescMatch[1] : (titleMatch ? titleMatch[1] : null);
  const caption = rawCaption ? decodeHtmlEntities(rawCaption) : null;

  let authorName: string | null = null;
  let authorHandle: string | null = null;
  if (ogTitleMatch) {
    const decodedOgTitle = decodeHtmlEntities(ogTitleMatch[1]);
    const m = decodedOgTitle.match(/^(.*?)(?:\s*\(@([^)]+)\))?\s+on Threads/i);
    if (m) {
      authorName = m[1]?.trim() || null;
      authorHandle = m[2]?.trim() || null;
    }
  }

  const usernameMatch = html.match(/"username":\s*"([^"]+)"/);
  if (!authorHandle && usernameMatch) {
    authorHandle = usernameMatch[1];
  }

  const takenAtMatch = html.match(/"taken_at":\s*(\d+)/);
  const postedAt = takenAtMatch
    ? new Date(Number.parseInt(takenAtMatch[1], 10) * 1000).toISOString()
    : null;

  const likeCountMatch = html.match(/"like_count":\s*(\d+)/);
  const likes = likeCountMatch ? Number.parseInt(likeCountMatch[1], 10) : null;

  const replyCountMatch = html.match(/"direct_reply_count":\s*(\d+)/);
  const comments = replyCountMatch ? Number.parseInt(replyCountMatch[1], 10) : null;

  const repostCountMatch = html.match(/"repost_count":\s*(\d+)/);
  const reposts = repostCountMatch ? Number.parseInt(repostCountMatch[1], 10) : null;

  // Carousel media parsing with bracket depth
  const media: MediaItem[] = [];
  const carouselIdx = html.indexOf('"carousel_media":');
  if (carouselIdx !== -1) {
    const startIdx = html.indexOf("[", carouselIdx);
    if (startIdx !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIdx = -1;
      for (let i = startIdx; i < html.length; i++) {
        const char = html[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\") {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === "[") depth++;
          else if (char === "]") {
            depth--;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
      }

      if (endIdx !== -1) {
        const unescaped = unescapeThreadsJson(html.slice(startIdx, endIdx + 1));
        try {
          const carouselItems = JSON.parse(unescaped) as Record<string, unknown>[];
          for (const item of carouselItems) {
            const iv2 = item.image_versions2 as Record<string, unknown> | undefined;
            const candidates = (iv2?.candidates as RawCandidate[]) || [];
            const best = getBestCandidate(candidates);
            if (best?.url) {
              media.push({
                type: "image",
                url: best.url.replace(/&amp;/g, "&"),
                width: best.width ?? null,
                height: best.height ?? null,
              });
            }
          }
        } catch {
          // Fallback to single image
        }
      }
    }
  }

  if (media.length === 0 && ogImageMatch) {
    media.push({
      type: "image",
      url: decodeHtmlEntities(ogImageMatch[1]),
    });
  }

  // Regex replies fallback
  const threadReplies: ThreadReply[] = [];
  const textMatches = [...html.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)];
  const seenTexts = new Set<string>();
  if (caption) seenTexts.add(caption.trim());

  for (const m of textMatches) {
    try {
      const decoded = JSON.parse(`"${m[1]}"`) as string;
      const clean = decoded.trim();
      if (
        clean.length > 5 &&
        !seenTexts.has(clean) &&
        !clean.startsWith("http") &&
        !clean.includes("Threads is a new app")
      ) {
        seenTexts.add(clean);
        threadReplies.push({
          author: {
            handle: null,
            name: null,
          },
          text: clean,
        });
      }
    } catch {
      // Ignore invalid escapes
    }
  }

  const shortcode = extractShortcodeFromUrl(finalUrl) ?? extractShortcodeFromUrl(inputUrl);
  const canonicalUrl =
    authorHandle && shortcode
      ? `https://www.threads.net/@${authorHandle}/post/${shortcode}`
      : finalUrl;

  return {
    id: shortcode,
    shortcode,
    url: canonicalUrl,
    originalUrl: inputUrl,
    status: "available",
    author: {
      handle: authorHandle,
      name: authorName,
      id: null,
      url: authorHandle ? `https://www.threads.net/@${authorHandle}` : null,
    },
    caption,
    thumbnailUrl: media[0]?.url ?? null,
    metrics: {
      likes,
      comments,
      shares: reposts,
      views: null,
      reposts,
    },
    postedAt,
    scrapedAt: new Date().toISOString(),
    media: media.length > 0 ? media : undefined,
    threadReplies: threadReplies.length > 0 ? threadReplies : undefined,
  };
}

export function parseThreadsHtml(
  html: string,
  inputUrl: string,
  finalUrl: string,
): CanonicalPost {
  return parseRelayData(html, inputUrl, finalUrl) ?? parseRegexFallback(html, inputUrl, finalUrl);
}

export async function handleThreadsPost(
  url: string,
  _env?: unknown,
  fetcher: typeof fetch = fetch,
): Promise<ExtractSuccess> {
  const res = await fetcher(url, {
    headers: {
      "User-Agent": GOOGLEBOT_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Mode": "navigate",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new AppError(404, "NOT_FOUND", "Threads post not found");
    }
    throw new AppError(502, "UPSTREAM_ERROR", `Failed to fetch Threads: ${res.status}`);
  }

  const finalUrl = res.url || url;
  const html = await res.text();
  const data = parseThreadsHtml(html, url, finalUrl);
  const note = await renderThreadsNote(data);

  return {
    ok: true,
    platform: "threads",
    input: { type: "url", value: url },
    filename: note.filename,
    markdown: note.markdown,
    data,
  };
}
