import { beforeEach, describe, expect, it, vi } from "vitest"
import { presignUpload } from "./s3Upload"

interface Policy {
  expiration: string
  conditions: unknown[]
}

beforeEach(() => {
  // Signing happens locally: fake keys are enough, nothing is sent to AWS.
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIAFAKEFAKEFAKEFAKE")
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "fake-secret")
  vi.stubEnv("AWS_SESSION_TOKEN", "fake-session")
  vi.stubEnv("AWS_REGION", "eu-central-1")
})

describe("presignUpload()", () => {
  it("lets a browser upload one image of up to 30 MB to exactly this key, for 5 minutes", async () => {
    const key = "incoming/5/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b"
    const started = Date.now()
    const { url, fields } = await presignUpload("glowstone-images-test", key)

    expect(url).toBe("https://glowstone-images-test.s3.eu-central-1.amazonaws.com/")
    expect(fields.key).toBe(key)
    const policy = JSON.parse(Buffer.from(fields.Policy, "base64").toString("utf8")) as Policy
    expect(policy.conditions).toContainEqual({ bucket: "glowstone-images-test" })
    expect(policy.conditions).toContainEqual({ key })
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 31_457_280])
    expect(policy.conditions).toContainEqual(["starts-with", "$Content-Type", "image/"])
    const lifetime = Date.parse(policy.expiration) - started
    expect(lifetime).toBeGreaterThan(295_000)
    expect(lifetime).toBeLessThanOrEqual(301_000)
  })

  it("never lets the browser choose the key", async () => {
    const { fields } = await presignUpload("glowstone-images-test", "incoming/5/x")
    const policy = JSON.parse(Buffer.from(fields.Policy, "base64").toString("utf8")) as Policy
    expect(JSON.stringify(policy.conditions)).not.toContain('"$key"')
  })
})
