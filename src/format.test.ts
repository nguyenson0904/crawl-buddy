import { describe, expect, it } from "vitest";
import { decodeJsonEscapes, formatFacebookPost } from "./format";

describe("formatFacebookPost", () => {
  it("maps Apify fields onto the canonical schema", async () => {
    const inputUrl = "https://www.facebook.com/page/posts/pfbid123";
    const result = await formatFacebookPost(
      {
        url: "https://www.facebook.com/page/posts/pfbid123",
        shortcode: "pfbid123",
        realId: "1095037716435126",
        status: "available",
        likes: 913,
        comments: 64,
        shares: 449,
        views: 0,
        caption: "hello",
        datePosted: "2026-09-13T10:51:14Z",
        thumbnailUrl: "https://example.com/thumb.jpg",
        author: "page",
        authorName: null,
        authorId: null,
        authorUrl: "https://www.facebook.com/page",
        scrapedAt: "2026-09-14T04:06:24.375Z",
      },
      inputUrl,
    );

    expect(result.ok).toBe(true);
    expect(result.platform).toBe("facebook");
    expect(result.data.id).toBe("1095037716435126");
    expect(result.data.metrics).toEqual({
      likes: 913,
      comments: 64,
      shares: 449,
      views: 0,
    });
    expect(result.data.author.handle).toBe("page");
    expect(result.filename).toBe("page-1095037716435126.md");
    expect(result.markdown).toContain("# page");
    expect(result.markdown).toContain("hello");
    expect(result.markdown).toContain("| Likes | 913 |");
  });

  it("decodes JSON unicode escapes in captions", () => {
    expect(decodeJsonEscapes("Tin m\\u00ecnh \\u0111i \\ud83d\\udc4d 8.7\\/10")).toBe(
      "Tin mình đi 👍 8.7/10",
    );
  });
});
