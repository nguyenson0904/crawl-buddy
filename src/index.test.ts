import { describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./types";

const env: Env = { APIFY_TOKEN: "test-token" };

describe("worker fetch", () => {
  it("serves health", async () => {
    const res = await worker.fetch(new Request("https://example.com/health"), env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("validates extract input", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/v1/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      env,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("returns 422 for unknown platforms without calling Apify", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/v1/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://twitter.com/user/status/123" }),
      }),
      env,
    );
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_PLATFORM" },
    });
  });

  it("validates GET extract input url", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/v1/extract"),
      env,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });
});
