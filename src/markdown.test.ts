import { describe, expect, it } from "vitest";
import {
  facebookNoteVariables,
  instagramNoteVariables,
  renderFacebookNote,
  renderInstagramNote,
  renderThreadsNote,
} from "./markdown";
import type { CanonicalPost } from "./types";

const post: CanonicalPost = {
  id: "1095037716435126",
  shortcode: "pfbid123",
  url: "https://www.facebook.com/page/posts/pfbid123",
  originalUrl: "https://www.facebook.com/page/posts/pfbid123",
  status: "available",
  author: {
    handle: "page",
    name: "Page Name",
    id: null,
    url: "https://www.facebook.com/page",
  },
  caption: "hello\n\nworld",
  thumbnailUrl: "https://example.com/thumb.jpg",
  metrics: { likes: 913, comments: 64, shares: 449, views: 0 },
  postedAt: "2026-09-13T10:51:14Z",
  scrapedAt: "2026-09-14T04:06:24.375Z",
};

describe("renderFacebookNote", () => {
  it("renders knap markdown with frontmatter, caption, and metrics table", async () => {
    const note = await renderFacebookNote(post);

    expect(note.filename).toBe("page-1095037716435126.md");
    expect(note.markdown).toContain("platform: \"facebook\"");
    expect(note.markdown).toContain("id: 1095037716435126");
    expect(note.markdown).toContain("# Page Name");
    expect(note.markdown).toContain("hello");
    expect(note.markdown).toContain("![Page Name](https://example.com/thumb.jpg)");
    expect(note.markdown).toContain("| Likes | 913 |");
    expect(note.markdown).toContain("[Open post](https://www.facebook.com/page/posts/pfbid123)");
  });

  it("builds knap variables from the canonical post", () => {
    const vars = facebookNoteVariables(post);
    expect(vars.title).toBe("Page Name");
    expect(vars.metrics).toEqual([
      { Metric: "Likes", Count: 913 },
      { Metric: "Comments", Count: 64 },
      { Metric: "Shares", Count: 449 },
      { Metric: "Views", Count: 0 },
    ]);
  });
});

describe("renderInstagramNote", () => {
  const igPost: CanonicalPost = {
    id: "3980071632848683045",
    shortcode: "Dc8DhAQjgAl",
    url: "https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/",
    originalUrl: "https://www.instagram.com/p/Dc8DhAQjgAl/?stkn=cGJzdHBuOHQ4OW15",
    status: "available",
    author: {
      handle: "gitskins",
      name: "GitSkins",
      id: "78688855461",
      url: "https://www.instagram.com/gitskins/",
    },
    caption: "5 useful websites\n\nSave this.",
    thumbnailUrl: "https://example.com/thumb.jpg",
    metrics: { likes: 658, comments: 5, shares: null, views: null },
    postedAt: "2026-09-06T07:58:53.000Z",
    scrapedAt: "2026-09-14T04:06:24.375Z",
  };

  it("renders knap markdown with instagram frontmatter and metrics", async () => {
    const note = await renderInstagramNote(igPost);

    expect(note.filename).toBe("gitskins-3980071632848683045.md");
    expect(note.markdown).toContain('platform: "instagram"');
    expect(note.markdown).toContain('id: "3980071632848683045"');
    expect(note.markdown).toContain("# GitSkins");
    expect(note.markdown).toContain("5 useful websites");
    expect(note.markdown).toContain("| Likes | 658 |");
    expect(note.markdown).toContain("| Comments | 5 |");
    expect(note.markdown).toContain("[Open post](https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/)");
  });

  it("builds instagram knap variables", () => {
    const vars = instagramNoteVariables(igPost);
    expect(vars.title).toBe("GitSkins");
    expect(vars.platform).toBe("instagram");
    expect(vars.metrics).toEqual([
      { Metric: "Likes", Count: 658 },
      { Metric: "Comments", Count: 5 },
    ]);
  });
});

describe("renderThreadsNote", () => {
  const threadsPost: CanonicalPost = {
    id: "3985273256466852750",
    shortcode: "DdOiOlwkiuO",
    url: "https://www.threads.net/@couple.nix/post/DdOiOlwkiuO",
    originalUrl: "https://www.threads.com/share/BAc4SjRV8c/",
    status: "available",
    author: {
      handle: "couple.nix",
      name: "Tú Nguyễn",
      id: "65232661690",
      url: "https://www.threads.net/@couple.nix",
    },
    caption: "DATA REAL TRÊN SÀN E-COMMERCE",
    thumbnailUrl: "https://example.com/thumb.jpg",
    metrics: { likes: 467, comments: 18, shares: 116, views: null, reposts: 116 },
    postedAt: "2026-09-13T12:13:35.000Z",
    scrapedAt: "2026-09-14T04:06:24.375Z",
    media: [
      { type: "image", url: "https://example.com/img1.jpg", width: 1000, height: 1000 },
    ],
    threadReplies: [
      {
        author: { handle: "replyer", name: "Reply User" },
        text: "Great dataset!",
        likes: 5,
        postedAt: "2026-09-13T12:15:00.000Z",
      },
    ],
  };

  it("renders threads knap markdown with media and replies", async () => {
    const note = await renderThreadsNote(threadsPost);

    expect(note.filename).toBe("couple.nix-DdOiOlwkiuO.md");
    expect(note.markdown).toContain('platform: "threads"');
    expect(note.markdown).toContain('id: "3985273256466852750"');
    expect(note.markdown).toContain("# Tú Nguyễn (@couple.nix)");
    expect(note.markdown).toContain("DATA REAL TRÊN SÀN E-COMMERCE");
    expect(note.markdown).toContain("![Media](https://example.com/img1.jpg)");
    expect(note.markdown).toContain("| Likes | 467 |");
    expect(note.markdown).toContain("| Comments | 18 |");
    expect(note.markdown).toContain("## Thread Replies");
    expect(note.markdown).toContain("> **@replyer**");
    expect(note.markdown).toContain("> Great dataset!");
    expect(note.markdown).toContain("[Open post](https://www.threads.net/@couple.nix/post/DdOiOlwkiuO)");
  });
});
