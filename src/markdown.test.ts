import { describe, expect, it } from "vitest";
import { facebookNoteVariables, renderFacebookNote } from "./markdown";
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
