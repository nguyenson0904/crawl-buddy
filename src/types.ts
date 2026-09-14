export interface Env {
  APIFY_TOKEN?: string;
  APIFY_FACEBOOK_ACTOR?: string;
  APIFY_TIMEOUT_SECS?: string;
}

export type InputType = "url";

export type Platform = "facebook" | "threads";

export type Classification =
  | { kind: "invalid"; reason: "not_url" | "empty" }
  | { kind: "facebook_post"; platform: "facebook"; url: string }
  | { kind: "facebook_unsupported"; platform: "facebook"; url: string }
  | { kind: "threads_post"; platform: "threads"; url: string }
  | { kind: "threads_unsupported"; platform: "threads"; url: string }
  | { kind: "unsupported_platform"; url: string };

export interface ExtractSuccess {
  ok: true;
  platform: Platform;
  input: { type: InputType; value: string };
  filename: string;
  markdown: string;
  data: CanonicalPost;
}

export interface MediaItem {
  type: "image" | "video";
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface ThreadReply {
  author: {
    handle: string | null;
    name: string | null;
    id?: string | null;
  };
  text: string;
  postedAt?: string | null;
  likes?: number | null;
}

export interface CanonicalPost {
  id: string | null;
  shortcode: string | null;
  url: string;
  originalUrl: string;
  status: "available" | "unavailable";
  author: {
    handle: string | null;
    name: string | null;
    id: string | null;
    url: string | null;
  };
  caption: string | null;
  thumbnailUrl: string | null;
  metrics: {
    likes: number | null;
    comments: number | null;
    shares: number | null;
    views: number | null;
    reposts?: number | null;
    quotes?: number | null;
  };
  postedAt: string | null;
  scrapedAt: string | null;
  media?: MediaItem[];
  threadReplies?: ThreadReply[];
}

export interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}
