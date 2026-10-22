import { beforeEach, describe, expect, it, vi } from "vitest"
import { addSubscriber } from "../models/subscriberModel"
import { subscribe } from "./subscriberService"

vi.mock("../models/subscriberModel")

beforeEach(() => {
  vi.resetAllMocks()
})

describe("subscribe()", () => {
  it("adds the email, passing rejoin through", async () => {
    await subscribe({ email: "sara@example.com", rejoin: true, website: "" })
    expect(addSubscriber).toHaveBeenCalledWith("sara@example.com", true)
  })

  it("saves nothing when the spam trap is filled", async () => {
    await subscribe({ email: "bot@example.com", rejoin: false, website: "http://spam.example" })
    expect(addSubscriber).not.toHaveBeenCalled()
  })
})
