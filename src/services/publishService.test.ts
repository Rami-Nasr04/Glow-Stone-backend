import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UpstreamError } from "../lib/errors"
import { PUBLISH_FAILED, publishSite } from "./publishService"

const HOOK = "https://api.vercel.test/v1/integrations/deploy/prj_test/secret-part"
const fetchMock = vi.fn<typeof fetch>()
let log: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", HOOK)
  log = vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  log.mockRestore()
})

// Every line logged, as one string: the hook's address is a secret and must never be in the logs.
const logged = () => JSON.stringify(log.mock.calls, (_, v: unknown) => (v instanceof Error ? `${v.name}: ${v.message}` : v))

describe("publishSite()", () => {
  it("asks Vercel to rebuild the shop with one POST to the deploy hook", async () => {
    fetchMock.mockResolvedValue(new Response('{"job":{"id":"j1","state":"PENDING"}}', { status: 201 }))
    await publishSite()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(HOOK)
    expect(init?.method).toBe("POST")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("refuses with the publish message when Vercel answers an error, and logs only the status", async () => {
    fetchMock.mockResolvedValue(new Response("Not Found", { status: 404 }))
    const err = await publishSite().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UpstreamError)
    expect(err).toMatchObject({ code: "PUBLISH_FAILED", message: PUBLISH_FAILED })
    expect(logged()).toContain("404")
    expect(logged()).not.toContain("secret-part")
  })

  it("refuses with the publish message when Vercel can't be reached, without logging the address", async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for ${HOOK}`))
    await expect(publishSite()).rejects.toMatchObject({ code: "PUBLISH_FAILED", message: PUBLISH_FAILED })
    expect(log).toHaveBeenCalled()
    expect(logged()).not.toContain("secret-part")
  })

  it("refuses with the publish message when Vercel is too slow", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
    await expect(publishSite()).rejects.toMatchObject({ code: "PUBLISH_FAILED" })
  })

  it("fails loudly when the hook isn't configured (a deploy mistake), without calling anything", async () => {
    vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", "")
    await expect(publishSite()).rejects.toThrow("Missing required env var: VERCEL_DEPLOY_HOOK_URL")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("has the message the studio shows", () => {
    expect(PUBLISH_FAILED).toBe("Publishing couldn't start. Try again in a minute.")
  })
})
