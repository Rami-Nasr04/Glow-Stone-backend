import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const DB_ENV = { DB_HOST: "h", DB_USER: "u", DB_PASSWORD: "p", DB_NAME: "n", DB_PORT: "5432" }

beforeEach(() => {
  vi.resetModules()
  Object.assign(process.env, DB_ENV)
})

afterEach(() => {
  delete process.env.DB_SSL
})

describe("config.db.ssl", () => {
  it("is on by default (RDS)", async () => {
    const { config } = await import("./config")
    expect(config.db.ssl).toBe(true)
  })

  it("is off only when DB_SSL is exactly 'false' (the local test database)", async () => {
    process.env.DB_SSL = "false"
    const { config } = await import("./config")
    expect(config.db.ssl).toBe(false)
  })
})
