import { runActorGetItems } from "../apify";
import { AppError } from "../errors";
import { formatFacebookPost } from "../format";
import type { ExtractSuccess } from "../types";

export async function handleFacebookPost(
  url: string,
  config: { token: string; facebookActor: string; timeoutSecs: number },
  fetcher: typeof fetch = fetch,
): Promise<ExtractSuccess> {
  const items = await runActorGetItems(
    {
      token: config.token,
      actorId: config.facebookActor,
      input: { postUrls: [url] },
      timeoutSecs: config.timeoutSecs,
    },
    fetcher,
  );

  const raw = items[0];
  if (!raw) {
    throw new AppError(502, "UPSTREAM_EMPTY", "Apify returned no post data");
  }

  return await formatFacebookPost(raw, url);
}
