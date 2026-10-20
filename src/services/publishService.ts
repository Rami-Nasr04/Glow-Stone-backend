import { requiredEnv } from "../lib/env"
import { UpstreamError } from "../lib/errors"

export const PUBLISH_FAILED = "Publishing couldn't start. Try again in a minute."

// Vercel answers a deploy hook within a second; past 5 s something is wrong (the Lambda's own limit is 6 s).
const HOOK_TIMEOUT_MS = 5000

// Asks Vercel to rebuild the shop (its deploy hook). The hook's address is a secret, so neither it nor an error
// message that may contain it is ever logged: only the status code, or the error's name.
export async function publishSite(): Promise<void> {
  const hook = requiredEnv("VERCEL_DEPLOY_HOOK_URL")
  let res: Response
  try {
    res = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(HOOK_TIMEOUT_MS) })
  } catch (err) {
    // The name (TimeoutError, TypeError) and the network code (ENOTFOUND…) say what went wrong without the address.
    const code = err instanceof Error && err.cause instanceof Error && "code" in err.cause ? err.cause.code : undefined
    console.error("Publish: Vercel's deploy hook couldn't be reached:", err instanceof Error ? err.name : "unknown error", code ?? "")
    throw new UpstreamError("PUBLISH_FAILED", PUBLISH_FAILED)
  }
  if (!res.ok) {
    console.error("Publish: Vercel's deploy hook answered", res.status)
    throw new UpstreamError("PUBLISH_FAILED", PUBLISH_FAILED)
  }
}
