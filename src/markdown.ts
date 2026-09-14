import { createEngine, standardFilters, TemplateRenderError } from "knap";
import { AppError } from "./errors";
import { FACEBOOK_NOTE_TEMPLATE } from "./templates/facebook";
import { THREADS_NOTE_TEMPLATE } from "./templates/threads";
import type { CanonicalPost } from "./types";

const engine = createEngine({
  filters: standardFilters,
  allowRegex: false,
});

function firstCaptionLine(caption: string | null): string | null {
  if (!caption) return null;
  const line = caption.split(/\r?\n/).find((part) => part.trim());
  return line?.trim() ?? null;
}

export function facebookNoteVariables(post: CanonicalPost): Record<string, unknown> {
  const authorHandle = post.author.handle;
  const authorName = post.author.name;
  const title = authorName ?? authorHandle ?? firstCaptionLine(post.caption) ?? "Facebook post";

  const metrics = [
    metricRow("Likes", post.metrics.likes),
    metricRow("Comments", post.metrics.comments),
    metricRow("Shares", post.metrics.shares),
    metricRow("Views", post.metrics.views),
  ].filter((row) => row !== null);

  return {
    title,
    platform: "facebook",
    id: post.id,
    shortcode: post.shortcode,
    url: post.url,
    originalUrl: post.originalUrl,
    status: post.status,
    authorHandle,
    authorName,
    authorId: post.author.id,
    authorUrl: post.author.url,
    caption: post.caption,
    thumbnailUrl: post.thumbnailUrl,
    postedAt: post.postedAt,
    scrapedAt: post.scrapedAt,
    metrics,
  };
}

export function threadsNoteVariables(post: CanonicalPost): Record<string, unknown> {
  const authorHandle = post.author.handle;
  const authorName = post.author.name;
  const title = authorName
    ? (authorHandle ? `${authorName} (@${authorHandle})` : authorName)
    : (authorHandle ? `@${authorHandle}` : (firstCaptionLine(post.caption) ?? "Threads post"));

  const metrics = [
    metricRow("Likes", post.metrics.likes),
    metricRow("Comments", post.metrics.comments),
    metricRow("Shares", post.metrics.shares),
    metricRow("Reposts", post.metrics.reposts ?? null),
    metricRow("Quotes", post.metrics.quotes ?? null),
    metricRow("Views", post.metrics.views),
  ].filter((row) => row !== null);

  return {
    title,
    platform: "threads",
    id: post.id,
    shortcode: post.shortcode,
    url: post.url,
    originalUrl: post.originalUrl,
    status: post.status,
    authorHandle,
    authorName,
    authorId: post.author.id,
    authorUrl: post.author.url,
    caption: post.caption,
    thumbnailUrl: post.thumbnailUrl,
    postedAt: post.postedAt,
    scrapedAt: post.scrapedAt,
    metrics: metrics.length > 0 ? metrics : null,
    media: post.media && post.media.length > 0 ? post.media : null,
    threadReplies: post.threadReplies && post.threadReplies.length > 0 ? post.threadReplies : null,
  };
}

function metricRow(name: string, count: number | null): { Metric: string; Count: number } | null {
  if (count === null) return null;
  return { Metric: name, Count: count };
}

function noteFilename(post: CanonicalPost): string {
  const stem = [post.author.handle, post.id ?? post.shortcode].filter(Boolean).join("-") || "facebook-post";
  return `${stem.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "facebook-post"}.md`;
}

function threadsNoteFilename(post: CanonicalPost): string {
  const stem = [post.author.handle, post.shortcode ?? post.id].filter(Boolean).join("-") || "threads-post";
  return `${stem.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "threads-post"}.md`;
}

export async function renderFacebookNote(
  post: CanonicalPost,
): Promise<{ filename: string; markdown: string }> {
  try {
    const markdown = await engine.renderOrThrow(FACEBOOK_NOTE_TEMPLATE, {
      variables: facebookNoteVariables(post),
    });
    return { filename: noteFilename(post), markdown };
  } catch (err) {
    if (err instanceof TemplateRenderError) {
      throw new AppError(500, "MARKDOWN_RENDER_FAILED", "Failed to render markdown note");
    }
    throw err;
  }
}

export async function renderThreadsNote(
  post: CanonicalPost,
): Promise<{ filename: string; markdown: string }> {
  try {
    const markdown = await engine.renderOrThrow(THREADS_NOTE_TEMPLATE, {
      variables: threadsNoteVariables(post),
    });
    return { filename: threadsNoteFilename(post), markdown };
  } catch (err) {
    if (err instanceof TemplateRenderError) {
      throw new AppError(500, "MARKDOWN_RENDER_FAILED", "Failed to render markdown note");
    }
    throw err;
  }
}
