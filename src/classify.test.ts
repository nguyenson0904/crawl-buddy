import { describe, expect, it } from "vitest";
import { classify } from "./classify";

describe("classify", () => {
  it("detects facebook pfbid posts", () => {
    const url =
      "https://www.facebook.com/movieinsightvn/posts/pfbid0C5fUF14hKehoyMcaE5sbor1ocW9ubSazgsa4UL3YDq233nwdXX4JF25uNaFhAp5sl";
    expect(classify(url)).toEqual({
      kind: "facebook_post",
      platform: "facebook",
      url,
    });
  });

  it("detects share, reel, watch, and fb.watch URLs", () => {
    const urls = [
      "https://www.facebook.com/share/p/1ECnzMeN9y/",
      "https://www.facebook.com/share/r/1Dp3jrkRrW/",
      "https://www.facebook.com/reel/1234567890",
      "https://m.facebook.com/watch/?v=123",
      "https://fb.watch/abcde/",
      "https://www.facebook.com/username/videos/123456/",
      "https://www.facebook.com/story.php?story_fbid=123&id=456",
    ];
    for (const url of urls) {
      expect(classify(url).kind).toBe("facebook_post");
    }
  });

  it("rejects facebook page URLs without a post", () => {
    expect(classify("https://www.facebook.com/movieinsightvn")).toMatchObject({
      kind: "facebook_unsupported",
      platform: "facebook",
    });
  });

  it("detects instagram posts and reels", () => {
    expect(
      classify("https://www.instagram.com/p/Dc8DhAQjgAl/?stkn=cGJzdHBuOHQ4OW15"),
    ).toEqual({
      kind: "instagram_post",
      platform: "instagram",
      url: "https://www.instagram.com/p/Dc8DhAQjgAl/?stkn=cGJzdHBuOHQ4OW15",
      shortcode: "Dc8DhAQjgAl",
    });

    expect(classify("https://www.instagram.com/reel/C8j41Q_s0kI/")).toEqual({
      kind: "instagram_post",
      platform: "instagram",
      url: "https://www.instagram.com/reel/C8j41Q_s0kI/",
      shortcode: "C8j41Q_s0kI",
    });

    expect(classify("https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/")).toEqual({
      kind: "instagram_post",
      platform: "instagram",
      url: "https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/",
      shortcode: "Dc8DhAQjgAl",
    });
  });

  it("rejects instagram profile or non-post URLs", () => {
    expect(classify("https://www.instagram.com/gitskins/")).toMatchObject({
      kind: "instagram_unsupported",
      platform: "instagram",
    });
    expect(classify("https://www.instagram.com/explore/")).toMatchObject({
      kind: "instagram_unsupported",
      platform: "instagram",
    });
  });

  it("detects threads post and share URLs", () => {
    const urls = [
      "https://www.threads.com/share/BAc4SjRV8c/",
      "https://www.threads.net/share/BAc4SjRV8c/",
      "https://threads.net/share/BAc4SjRV8c/",
      "https://www.threads.net/@couple.nix/post/DdOiOlwkiuO",
      "https://www.threads.com/@couple.nix/post/DdOiOlwkiuO",
      "https://www.threads.net/t/Cxyz123",
    ];
    for (const url of urls) {
      expect(classify(url)).toEqual({
        kind: "threads_post",
        platform: "threads",
        url,
      });
    }
  });

  it("rejects threads profile URLs without a post", () => {
    expect(classify("https://www.threads.net/@couple.nix")).toMatchObject({
      kind: "threads_unsupported",
      platform: "threads",
    });
  });

  it("rejects unknown platforms and invalid input", () => {
    expect(classify("https://twitter.com/user/status/123").kind).toBe("unsupported_platform");
    expect(classify("not a url")).toEqual({ kind: "invalid", reason: "not_url" });
    expect(classify("   ")).toEqual({ kind: "invalid", reason: "empty" });
  });
});
