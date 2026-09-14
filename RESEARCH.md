# Cloudflare Workers — nghiên cứu giới hạn cho crawl-buddy

Nguồn chính: [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/) (cập nhật 2026-09-05).

Câu hỏi: app nhận POST (URL, ảnh, hoặc MP3) → phân loại → gọi 3rd party → format JSON → trả kết quả, request có thể ~40s. Có dùng Cloudflare Workers được không?

**Kết luận ngắn:** Có. Đây là workload I/O-bound chuẩn của Workers. Bottleneck không phải daily requests hay wall-clock 40s, mà là CPU (Free 10 ms), memory 128 MB khi nhận file, và client có giữ kết nối đủ lâu không.

---

## 1. Daily requests không liên quan tới request 40s

Anchor `#daily-requests` chỉ giới hạn **số lần gọi**, không giới hạn thời gian một request.

| Plan | Requests |
|------|----------|
| Workers Free | 100.000/ngày, reset 00:00 UTC. Vượt → **Error 1027** |
| Workers Paid | Không giới hạn |

Free còn ~1000 requests/phút. Paid không giới hạn RPS nói chung; Workers scale trên mạng Cloudflare.

Khi đụng daily limit:

- Route **fail open**: bỏ qua Worker, request chạy như không có Worker.
- Route **fail closed**: trả trang lỗi 1027. Dùng cho Worker bảo mật.

---

## 2. Hai loại thời gian: wall-clock vs CPU

### Duration (wall-clock)

Tổng thời gian từ lúc Worker bắt đầu đến lúc xong, **kể cả lúc đợi mạng**.

| Trigger | Duration limit |
|---------|----------------|
| HTTP request | **Không giới hạn** (client còn kết nối) |
| Cron Trigger | 15 phút |
| Durable Object Alarm | 15 phút |
| Queue Consumer | 15 phút |
| Durable Object (RPC / HTTP) | Không giới hạn khi caller còn kết nối |
| Workflows (mỗi step) | Không giới hạn wall-clock; vẫn bị CPU limit |

HTTP Worker được chạy, `fetch()` 3rd party, stream response miễn **client chưa disconnect**. Khi client cắt hoặc response xong, việc còn lại có thể bị hủy.

`ctx.waitUntil()` chỉ kéo execution **tối đa 30 giây sau khi đã trả response / client disconnect**. Không dùng để “kéo” request 40s. App này **cần JSON 3rd party trước khi trả** nên phải giữ request-response đồng bộ, không dùng `waitUntil()` cho bước chờ 3rd party.

**Runtime update:** Cloudflare update Workers runtime vài lần/tuần. Request đang chạy được grace **30s** rồi bị kill. Request dài 40s có rủi ro nhỏ trùng lúc update.

### CPU time

Thời gian CPU **thực sự chạy code**. `await fetch()`, đọc KV, query DB, đợi 3rd party **không tính**.

| Limit | Workers Free | Workers Paid |
|-------|--------------|--------------|
| CPU / HTTP request | **10 ms** | 5 phút (mặc định **30 giây**) |
| CPU / Cron Trigger | 10 ms | 30s nếu interval &lt; 1h; 15 phút nếu interval ≥ 1h |

Worker trung bình ~2.2 ms CPU/request. Auth, SSR, parse payload lớn thường 10–20 ms.

Vượt CPU → **Error 1102** `Worker exceeded resource limits` (dashboard: Exceeded CPU Time Limits; analytics: `exceededCpu`).

Paid tăng trần CPU (tối đa 300.000 ms = 5 phút):

```jsonc
{
  "limits": {
    "cpu_ms": 300000
  }
}
```

Hoặc dashboard: Workers & Pages → Worker → Settings → CPU time limit.

### Áp vào request ~40s

| 40 giây là gì | Free | Paid |
|---------------|------|------|
| Đợi I/O (3rd party, upload, mạng), CPU vài ms | Được | Được |
| CPU thật 40s (parse lớn, hash, xử lý media) | Không (10 ms) | Được nếu tăng `cpu_ms` &gt; 40s |

---

## 3. Luồng app (URL) — phù hợp Workers

Luồng:

1. POST nhận input (thường là URL).
2. Phân loại bằng regex.
3. `fetch` 3rd party, chờ JSON (~40s wall-clock).
4. Format JSON theo chuẩn app.
5. Trả kết quả.

| Bước | Loại thời gian | Đánh giá |
|------|----------------|----------|
| POST + regex phân loại | CPU, vài ms | Ổn, kể cả Free |
| Chờ JSON 3rd party ~40s | Wall-clock / I/O | Không tính CPU; HTTP không hard-limit duration |
| Format JSON rồi trả | CPU, thường vài ms | Ổn nếu JSON không cực lớn |

1 subrequest thì Free (50/request) và Paid (10.000) đều thừa.

Pattern:

```js
export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    const { url } = await request.json();
    const kind = classify(url); // regex

    const upstream = await fetch(THIRD_PARTY, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, kind }),
    });

    if (!upstream.ok) {
      return Response.json(
        { error: "upstream_failed", status: upstream.status },
        { status: 502 },
      );
    }

    const raw = await upstream.json();
    return Response.json(format(raw));
  },
};
```

Nên Abort/timeout rõ (ví dụ 45–60s) rồi trả 504, không đợi vô hạn.

### Khi không nên đồng bộ 40s

Đổi sang Queue / Durable Object / nhận job rồi poll hoặc webhook nếu:

- 3rd party đôi khi **&gt; 60–90s** hoặc không ổn định.
- Client (browser, app, caller) **không chịu đợi 40s**.
- Cần retry khi 3rd party fail mà không bắt user chờ.
- Traffic lớn trên Free (dễ đụng 100k request/ngày).

---

## 4. Input ảnh hoặc MP3 — limit mới

Không có limit riêng theo loại file (ảnh vs MP3 vs URL). Cùng rule **request body + memory 128 MB + CPU**.

### Request body (plan Cloudflare zone, không phải Workers plan)

Vượt → **413** Request entity too large.

| Cloudflare plan | Body tối đa |
|-----------------|-------------|
| Free / Pro | **100 MB** |
| Business | 200 MB |
| Enterprise | tới 5 GB (tự chỉnh Maximum Upload Size trên zone) |

Ảnh 2–15 MB, MP3 bài hát 3–10 MB: dưới 100 MB. Podcast / file rất lớn mới sát trần.

Response body: Workers không enforce. CDN cache: 512 MB (Free/Pro/Business), 5 GB (Enterprise).

### Memory: bottleneck thật khi có file

Mỗi isolate **128 MB** (JS heap + Wasm). Đụng → Error 1102, invocation `exceededMemory`.

Nguy hiểm nếu buffer cả file:

```js
await request.arrayBuffer()
await request.blob()
await request.formData()   // parse cả multipart vào RAM
await request.text()
JSON + file base64         // tệ nhất
```

Base64 phình ~33% + overhead string V8. File ~20 MB encode base64 trong JSON đã có case chết isolate 128 MB.

Ảnh vài MB + `formData()` thường sống. MP3 30–50 MB + buffer/base64 dễ chết dù vẫn dưới 100 MB upload.

Docs khuyên stream (`TransformStream` / `node:stream`), không buffer payload lớn; data lớn để KV / R2 / D1.

### CPU với media

| Việc | CPU | Phù hợp Workers? |
|------|-----|------------------|
| Regex + phân loại MIME | vài ms | Có |
| Stream file sang 3rd party | gần 0 | Có |
| `JSON.parse` kết quả vừa | vài ms | Có |
| Encode/decode base64 file lớn | CPU + RAM | Tránh |
| Resize ảnh / decode / transcode MP3 trong Worker | CPU + RAM | **Không** |

Workers không transcode, không “nghe” MP3, không resize ảnh. Chỉ nhận file, (stream) đưa 3rd party, format JSON trả về.

### Cách gửi file

**Nên:** `multipart/form-data` hoặc raw binary, **stream** `request.body` sang 3rd party.

```js
const upstream = await fetch(THIRD_PARTY, {
  method: "POST",
  headers: { "content-type": request.headers.get("content-type") ?? "" },
  body: request.body, // không buffer
});
```

**Tránh:** đọc `arrayBuffer` rồi nhét base64 vào JSON.

`request.formData()` cũng buffer toàn bộ. 3rd party bắt buộc multipart mà file lớn: stream multipart (phức tạp) hoặc **PUT R2 rồi gửi URL** (quay về flow URL).

### Trần size nên tự đặt (không phải limit Cloudflare)

| Loại | Gợi ý cap |
|------|-----------|
| Ảnh | 10–15 MB |
| MP3 (buffer) | 20–25 MB |
| MP3 (stream hoặc R2) | 50–80 MB |
| JSON + base64 | đừng dùng; nếu bắt buộc thì file gốc &lt; 5 MB |

Check `Content-Length` sớm, đừng đợi upload đủ 100 MB mới 413.

Upload chậm (mobile, 20 MB MP3) cộng thời gian 3rd party: client phải giữ kết nối cả lúc upload lẫn lúc chờ.

---

## 5. Limit khác có thể đụng

| Feature | Free | Paid |
|---------|------|------|
| Memory / isolate | 128 MB | 128 MB |
| Subrequests / invocation | 50 | 10.000 (config tới 10M) |
| Subrequest tới service nội bộ | 1.000 | theo limit đã config |
| Kết nối outgoing đồng thời đang chờ headers | 6 | 6 |
| Worker size (uncompressed) | 64 MiB | 64 MiB |
| Startup time (global scope) | 1 giây | 1 giây |
| Số Worker / account | 100 | 500 |
| Env vars / Worker | 64 | 128 |
| Env var size | 5 KB | 5 KB |
| URL size | 16 KB | 16 KB |
| Request / response headers | 128 KB tổng | 128 KB tổng |
| Log / request | 256 KB | 256 KB |

Subrequest (`fetch`, R2, KV, D1) **không có time limit riêng** khi client còn kết nối. Redirect chain mỗi hop tính 1 subrequest.

Sau khi response headers của một connection về, connection đó **không còn** chiếm slot 6. Connection thứ 7 queue đến khi một connection nhận headers.

Không đọc body thì vẫn nên `response.body.cancel()` để giải phóng memory.

Worker-to-Worker: dùng **Service Bindings**. `fetch()` cùng zone không binding thì fail; Custom Domain thì nhận được.

### Memory / CPU errors

Cả hai đều Error 1102. Phân biệt trên dashboard Metrics → Errors → Invocation Statuses, hoặc Logpush (`exceededCpu` / `exceededMemory`).

Có thể gặp `Memory limit would be exceeded before EOF` khi buffer response body quá lớn.

---

## 6. Free vs Paid

Paid: $5/tháng (Standard). Không tính duration, không tính egress Workers.

| | Free | Paid (Standard) |
|--|------|-----------------|
| Requests | 100k/ngày | 10 triệu/tháng included, +$0.30 / triệu |
| CPU included | 10 ms / invocation (hard cap) | 30 triệu CPU-ms/tháng, +$0.02 / triệu CPU-ms |
| CPU max / HTTP | 10 ms | default 30s, tăng tới 5 phút |
| Duration HTTP | không tính tiền, không hard limit | không tính tiền, không hard limit |
| Production URL + file vừa, CPU nhẹ | Prototype / traffic thấp | Nên dùng |
| JSON cực lớn hoặc CPU &gt; 10 ms | Dễ 1102 | An toàn hơn |

Prototype / ít request: Free đủ nếu CPU vài ms và không buffer file lớn. Production: Paid.

---

## 7. So sánh hai loại input

| | Chỉ URL | Ảnh / MP3 |
|--|---------|-----------|
| Request body | vài KB | tới 100 MB (Free/Pro zone) |
| Memory | không đáng kể | **128 MB là bottleneck** |
| Thời gian | chủ yếu đợi 3rd party | **upload** + đợi 3rd party |
| Client timeout | ~40s xử lý | thêm lúc mạng chậm upload |
| Daily requests | 1 request = 1 job | vẫn 1 request |
| Pattern ổn | POST JSON URL → fetch 3rd party | Stream body hoặc R2 + gửi URL |

---

## 8. Khuyến nghị cho crawl-buddy

1. **Giữ HTTP đồng bộ** cho job ~40s: nhận POST → classify → `fetch` 3rd party → format JSON → trả. Đúng model Workers.
2. **Timeout/abort** 45–60s với 3rd party; fail thì 502/504 có message rõ.
3. **Client phải keep-alive** đủ lâu (browser, mobile, nginx, API gateway hay cắt 15–30s). Đây là rủi ro sản phẩm, không phải limit Worker.
4. **URL:** Free được nếu &lt; 100k req/ngày và CPU &lt; 10 ms. Production → Paid.
5. **Ảnh/MP3:** không base64 trong JSON; không `arrayBuffer()` / `formData()` file lớn. Stream `request.body` hoặc upload R2 rồi gửi URL cho 3rd party.
6. **Tự cap size** (ảnh 10–15 MB, MP3 20–25 MB nếu buffer).
7. **Không xử lý media trong Worker** (resize, transcode). Việc nặng để 3rd party.
8. Nếu 3rd party thường xuyên &gt; 60–90s hoặc cần retry: Queue / Workflow + poll/webhook, không giữ HTTP 40s.

---

## 9. Nguồn

- [Limits · Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [Pricing · Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing)
- [Fetch API · Workers](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Changelog: CPU time tới 5 phút](https://developers.cloudflare.com/changelog/2025-03-25-higher-cpu-limits/)
- [Stream large JSON](https://developers.cloudflare.com/workers/examples/streaming-json/)
- [Error 1102](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/#error-1102-worker-exceeded-resource-limits)
