import { formatInstagramPost } from "../format";
import { fetchInstagramPostHtml, parseInstagramHtml } from "../instagram";
import type { ExtractSuccess } from "../types";

export async function handleInstagramPost(
  url: string,
  shortcode: string,
  fetcher: typeof fetch = fetch,
): Promise<ExtractSuccess> {
  const html = await fetchInstagramPostHtml(url, shortcode, fetcher);
  const post = parseInstagramHtml(html, url, shortcode);
  return await formatInstagramPost(post, url);
}
