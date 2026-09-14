import { describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import { routeExtract } from "./router";
import type { Env } from "./types";

const env: Env = {
  APIFY_TOKEN: "test-token",
  APIFY_FACEBOOK_ACTOR: "clappi/facebook-posts-reels-scraper",
  APIFY_TIMEOUT_SECS: "30",
};

describe("routeExtract", () => {
  it("routes facebook posts to Apify and formats the result", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify([
          {
            url: "https://www.facebook.com/movieinsightvn/posts/pfbid123",
            shortcode: "pfbid123",
            realId: "1",
            status: "available",
            likes: 10,
            comments: 2,
            shares: 3,
            views: 0,
            caption: "cap",
            author: "movieinsightvn",
            datePosted: "2026-09-13T10:51:14Z",
            scrapedAt: "2026-09-14T04:06:24.375Z",
          },
        ]),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    });

    const result = await routeExtract(
      "https://www.facebook.com/movieinsightvn/posts/pfbid123",
      env,
      fetcher,
    );

    expect(result.ok).toBe(true);
    expect(result.data.metrics.likes).toBe(10);
    expect(result.filename).toBe("movieinsightvn-1.md");
    expect(result.markdown).toContain("cap");
    expect(fetcher).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetcher.mock.calls[0] ?? [];
    expect(String(calledUrl)).toContain("clappi~facebook-posts-reels-scraper/run-sync-get-dataset-items");
    expect(JSON.parse(String(init?.body))).toEqual({
      postUrls: ["https://www.facebook.com/movieinsightvn/posts/pfbid123"],
    });
  });

  it("rejects unsupported platforms", async () => {
    await expect(routeExtract("https://www.instagram.com/p/abc/", env)).rejects.toMatchObject({
      code: "UNSUPPORTED_PLATFORM",
      status: 422,
    } satisfies Partial<AppError>);
  });

  it("rejects facebook page URLs", async () => {
    await expect(routeExtract("https://www.facebook.com/movieinsightvn", env)).rejects.toMatchObject({
      code: "UNSUPPORTED_FACEBOOK_URL",
      status: 422,
    });
  });

  it("routes threads posts to threads handler", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return new Response(
        `<!DOCTYPE html><html><head><meta property="og:title" content="Tester (@couple.nix) on Threads"/><meta property="og:description" content="Data post"/></head><body>"username":"couple.nix","like_count":50</body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    });

    const result = await routeExtract(
      "https://www.threads.com/share/BAc4SjRV8c/",
      env,
      fetcher,
    );

    expect(result.ok).toBe(true);
    expect(result.platform).toBe("threads");
    expect(result.data.author.handle).toBe("couple.nix");
    expect(result.data.metrics.likes).toBe(50);
  });

  it("rejects threads profile URLs without post", async () => {
    await expect(routeExtract("https://www.threads.net/@couple.nix", env)).rejects.toMatchObject({
      code: "UNSUPPORTED_THREADS_URL",
      status: 422,
    });
  });
});
