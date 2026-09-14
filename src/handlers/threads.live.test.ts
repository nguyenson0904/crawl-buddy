import { describe, expect, it } from "vitest";
import worker from "../index";

describe("live threads test", () => {
  it("fetches and extracts data from live threads url", async () => {
    const req = new Request("https://example.com/v1/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.threads.com/share/BAc4SjRV8c/" }),
    });

    const res = await worker.fetch(req, {});
    expect(res.status).toBe(200);

    const json = (await res.json()) as any;
    console.log("=== LIVE THREADS EXTRACT RESULT ===");
    console.log("Status:", json.ok);
    console.log("Platform:", json.platform);
    console.log("Filename:", json.filename);
    console.log("Author:", json.data?.author);
    console.log("Metrics:", json.data?.metrics);
    console.log("Media count:", json.data?.media?.length);
    console.log("Thread replies count:", json.data?.threadReplies?.length);
    console.log("Markdown preview:\n", json.markdown?.slice(0, 400));

    expect(json.ok).toBe(true);
    expect(json.platform).toBe("threads");
    expect(json.data.author.handle).toBe("couple.nix");
    expect(json.data.caption).toContain("DATA REAL TRÊN SÀN E-COMMERCE");
    expect(json.data.metrics.likes).toBeGreaterThan(0);
    expect(json.filename).toContain("couple.nix");
  }, 30000);

  it("extracts via GET /v1/threads?url=...", async () => {
    const req = new Request(
      "https://example.com/v1/threads?url=" +
        encodeURIComponent("https://www.threads.com/share/BAc4SjRV8c/"),
      { method: "GET" },
    );
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.data.author.handle).toBe("couple.nix");
  }, 30000);

  it("extracts via POST /v1/extract (unified endpoint)", async () => {
    const req = new Request("https://example.com/v1/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.threads.com/share/BAc4SjRV8c/" }),
    });
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.data.author.handle).toBe("couple.nix");
  }, 30000);
});
