import { describe, expect, it, vi } from "vitest";
import { runActorGetItems } from "./apify";
import { AppError } from "./errors";

describe("runActorGetItems", () => {
  it("returns dataset items on success", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify([{ id: "1" }]), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    const items = await runActorGetItems(
      {
        token: "t",
        actorId: "clappi/facebook-posts-reels-scraper",
        input: { postUrls: ["https://example.com"] },
        timeoutSecs: 30,
      },
      fetcher as unknown as typeof fetch,
    );

    expect(items).toEqual([{ id: "1" }]);
  });

  it("maps HTTP 408 to UPSTREAM_TIMEOUT", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: "timed out" } }), {
        status: 408,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(
      runActorGetItems(
        {
          token: "t",
          actorId: "x/y",
          input: {},
          timeoutSecs: 5,
        },
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT", status: 504 } satisfies Partial<AppError>);
  });
});
