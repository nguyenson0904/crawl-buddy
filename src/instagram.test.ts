import { describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import {
  decodeHtmlEntities,
  extractMetaTags,
  fetchInstagramPostHtml,
  GOOGLEBOT_USER_AGENT,
  parseDescriptionMeta,
  parseInstagramHtml,
} from "./instagram";

const samplePostHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta property="og:type" content="article" />
    <meta property="instapp:owner_user_id" content="78688855461" />
    <meta name="description" content="658 likes, 5 comments - gitskins on September 6, 2026: &quot;5 useful websites every developer should know &#x2601;&#xfe0f;&#x1f4bb;

From better portfolios to UI inspiration, app mockups, and safer shipping.

Save this for your next build.

#developers #programming #coding #github #ai&quot;. " />
    <meta property="og:site_name" content="Instagram" />
    <meta property="og:title" content="GitSkins on Instagram: &quot;5 useful websites every developer should know&quot;" />
    <meta property="og:image" content="https://example.com/cdn/image.jpg" />
    <meta property="og:url" content="https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/" />
  </head>
  <body>
    <script>
      {"require":[["ScheduledServerJS","handle",null,[{"__bbox":{"result":{"data":{"xig_polaris_media":{"pk":"3980071632848683045","code":"Dc8DhAQjgAl","if_not_gated_logged_out":{"pk":"3980071632848683045","code":"Dc8DhAQjgAl","taken_at":1788681533,"like_count":658,"comment_count":5,"display_uri":"https://example.com/cdn/image.jpg","caption":{"text":"5 useful websites every developer should know ☁️💻\\n\\nFrom better portfolios to UI inspiration, app mockups, and safer shipping.\\n\\nSave this for your next build.\\n\\n#developers #programming #coding #github #ai"},"user":{"pk":"78688855461","username":"gitskins","full_name":"GitSkins","id":"17841478703856106"}}}}}}}]]]}
    </script>
  </body>
</html>
`;

describe("instagram scraper", () => {
  it("uses Googlebot User-Agent header when fetching", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return new Response("<html><head><title>Instagram</title></head><body></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });

    await fetchInstagramPostHtml(
      "https://www.instagram.com/p/Dc8DhAQjgAl/?stkn=cGJzdHBuOHQ4OW15",
      "Dc8DhAQjgAl",
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetcher.mock.calls[0] ?? [];
    expect(String(calledUrl)).toBe("https://www.instagram.com/p/Dc8DhAQjgAl/");
    const headers = init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(GOOGLEBOT_USER_AGENT);
  });

  it("handles 404 response as POST_NOT_FOUND", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return new Response("Not found", { status: 404 });
    });

    await expect(
      fetchInstagramPostHtml("https://www.instagram.com/p/invalid/", "invalid", fetcher),
    ).rejects.toMatchObject({
      code: "POST_NOT_FOUND",
      status: 404,
    } satisfies Partial<AppError>);
  });

  it("parses full post data from script payload", () => {
    const post = parseInstagramHtml(
      samplePostHtml,
      "https://www.instagram.com/p/Dc8DhAQjgAl/?stkn=cGJzdHBuOHQ4OW15",
      "Dc8DhAQjgAl",
    );

    expect(post.id).toBe("3980071632848683045");
    expect(post.shortcode).toBe("Dc8DhAQjgAl");
    expect(post.url).toBe("https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/");
    expect(post.author.handle).toBe("gitskins");
    expect(post.author.name).toBe("GitSkins");
    expect(post.author.id).toBe("78688855461");
    expect(post.metrics.likes).toBe(658);
    expect(post.metrics.comments).toBe(5);
    expect(post.caption).toContain("5 useful websites every developer should know");
    expect(post.postedAt).toBe("2026-09-06T07:58:53.000Z");
  });

  it("falls back to OpenGraph meta tags when script data is absent", () => {
    const metaOnlyHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:url" content="https://www.instagram.com/gitskins/p/Dc8DhAQjgAl/" />
          <meta property="og:image" content="https://example.com/cdn/image.jpg" />
          <meta property="instapp:owner_user_id" content="78688855461" />
          <meta property="og:description" content="120 likes, 3 comments - gitskins on September 6, 2026: &quot;Fallback caption test&quot;. " />
        </head>
        <body></body>
      </html>
    `;

    const post = parseInstagramHtml(
      metaOnlyHtml,
      "https://www.instagram.com/p/Dc8DhAQjgAl/",
      "Dc8DhAQjgAl",
    );

    expect(post.shortcode).toBe("Dc8DhAQjgAl");
    expect(post.author.handle).toBe("gitskins");
    expect(post.metrics.likes).toBe(120);
    expect(post.metrics.comments).toBe(3);
    expect(post.caption).toBe("Fallback caption test");
    expect(post.thumbnailUrl).toBe("https://example.com/cdn/image.jpg");
  });

  it("decodes HTML entities properly", () => {
    expect(decodeHtmlEntities("&quot;hello&quot; &amp; &#064;world")).toBe('"hello" & @world');
  });

  it("extracts meta tags from HTML", () => {
    const meta = extractMetaTags('<meta property="og:title" content="Test &amp; Title" />');
    expect(meta["og:title"]).toBe("Test & Title");
  });

  it("parses description meta strings with various formats", () => {
    const parsed1 = parseDescriptionMeta(
      '658 likes, 5 comments - gitskins on September 6, 2026: "Hello world"',
    );
    expect(parsed1).toEqual({
      likes: 658,
      comments: 5,
      author: "gitskins",
      caption: "Hello world",
    });

    const parsed2 = parseDescriptionMeta('gitskins on September 6, 2026: "No metrics"');
    expect(parsed2).toEqual({
      likes: null,
      comments: null,
      author: "gitskins",
      caption: "No metrics",
    });
  });

  it("throws POST_NOT_FOUND when page is empty / not found", () => {
    const emptyHtml = "<html><head><title>Instagram</title></head><body></body></html>";
    expect(() =>
      parseInstagramHtml(emptyHtml, "https://www.instagram.com/p/invalid/", "invalid"),
    ).toThrowError(AppError);
  });
});
