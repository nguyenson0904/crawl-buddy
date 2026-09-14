import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors";
import { GOOGLEBOT_UA, handleThreadsPost, parseThreadsHtml, unescapeThreadsJson } from "./threads";

describe("threads handler", () => {
  it("unescapes multi-layer json sequences correctly", () => {
    const raw = "\\u002Ftest\\u002520\\u0026amp\\u003D1";
    expect(unescapeThreadsJson(raw)).toBe("/test%20&amp=1");
  });

  it("parses relay stream cache json from threads html", () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Post on Threads</title>
        </head>
        <body>
          <script type="application/json">
            {
              "require": [
                [
                  "ScheduledServerJS",
                  "handle",
                  null,
                  [
                    {
                      "__bbox": {
                        "result": {
                          "data": {
                            "data": {
                              "edges": [
                                {
                                  "node": {
                                    "thread_items": [
                                      {
                                        "post": {
                                          "id": "123456789",
                                          "code": "DdOiOlwkiuO",
                                          "taken_at": 1789301615,
                                          "like_count": 42,
                                          "caption": { "text": "Hello Threads world!" },
                                          "user": {
                                            "username": "tester",
                                            "full_name": "Test User",
                                            "pk": "999"
                                          },
                                          "text_post_app_info": {
                                            "direct_reply_count": 5,
                                            "repost_count": 10,
                                            "quote_count": 2,
                                            "reshare_count": 12
                                          },
                                          "carousel_media": [
                                            {
                                              "image_versions2": {
                                                "candidates": [
                                                  { "url": "https://cdn.example.com/small.jpg", "width": 300, "height": 300 },
                                                  { "url": "https://cdn.example.com/large.jpg", "width": 1200, "height": 800 }
                                                ]
                                              }
                                            }
                                          ]
                                        }
                                      }
                                    ]
                                  }
                                },
                                {
                                  "node": {
                                    "thread_items": [
                                      {
                                        "post": {
                                          "id": "reply_1",
                                          "taken_at": 1789302000,
                                          "like_count": 3,
                                          "caption": { "text": "This is a great reply" },
                                          "user": { "username": "replyer", "full_name": "Replyer Guy" }
                                        }
                                      }
                                    ]
                                  }
                                }
                              ]
                            }
                          }
                        }
                      }
                    }
                  ]
                ]
              ]
            }
          </script>
        </body>
      </html>
    `;

    const parsed = parseThreadsHtml(
      mockHtml,
      "https://www.threads.com/share/test/",
      "https://www.threads.net/@tester/post/DdOiOlwkiuO",
    );

    expect(parsed.id).toBe("123456789");
    expect(parsed.shortcode).toBe("DdOiOlwkiuO");
    expect(parsed.author.handle).toBe("tester");
    expect(parsed.author.name).toBe("Test User");
    expect(parsed.caption).toBe("Hello Threads world!");
    expect(parsed.metrics.likes).toBe(42);
    expect(parsed.metrics.comments).toBe(5);
    expect(parsed.metrics.shares).toBe(12);
    expect(parsed.media).toHaveLength(1);
    expect(parsed.media?.[0]?.url).toBe("https://cdn.example.com/large.jpg");
    expect(parsed.threadReplies).toHaveLength(1);
    expect(parsed.threadReplies?.[0]?.author.handle).toBe("replyer");
    expect(parsed.threadReplies?.[0]?.text).toBe("This is a great reply");
  });

  it("parses fallback regex when relay json is absent", () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Tester (@tester) on Threads" />
          <meta property="og:description" content="Regex fallback caption" />
          <meta property="og:image" content="https://cdn.example.com/og.jpg" />
        </head>
        <body>
          <script>
            var data = {
              "username": "tester",
              "taken_at": 1789301615,
              "like_count": 88,
              "direct_reply_count": 7,
              "repost_count": 15
            };
          </script>
        </body>
      </html>
    `;

    const parsed = parseThreadsHtml(
      mockHtml,
      "https://www.threads.net/@tester/post/abc1234",
      "https://www.threads.net/@tester/post/abc1234",
    );

    expect(parsed.author.handle).toBe("tester");
    expect(parsed.author.name).toBe("Tester");
    expect(parsed.caption).toBe("Regex fallback caption");
    expect(parsed.metrics.likes).toBe(88);
    expect(parsed.metrics.comments).toBe(7);
    expect(parsed.metrics.shares).toBe(15);
    expect(parsed.thumbnailUrl).toBe("https://cdn.example.com/og.jpg");
  });

  it("calls fetcher with Googlebot UA and formats output", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return new Response(
        `<!DOCTYPE html><html><head><meta property="og:title" content="Test (@user) on Threads"/><meta property="og:description" content="Awesome post"/></head><body>"username":"user","like_count":100</body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    });

    const result = await handleThreadsPost(
      "https://www.threads.com/share/BAc4SjRV8c/",
      {},
      fetcher,
    );

    expect(result.ok).toBe(true);
    expect(result.platform).toBe("threads");
    expect(result.data.author.handle).toBe("user");
    expect(result.data.metrics.likes).toBe(100);
    expect(result.markdown).toContain("Awesome post");

    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = init?.headers as Record<string, string>;
    expect(headers?.["User-Agent"]).toBe(GOOGLEBOT_UA);
  });

  it("throws 404 if threads returns 404", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return new Response("Not Found", { status: 404 });
    });

    await expect(
      handleThreadsPost("https://www.threads.net/t/unknown", {}, fetcher),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    } satisfies Partial<AppError>);
  });
});
