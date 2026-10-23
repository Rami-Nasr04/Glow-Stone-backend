import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { listAdminEmails, sendEmail } from "../lib/email"
import type { AdminOrder } from "../types/order"
import { notifyOrderPlaced, notifyOrderStatus } from "./orderNotificationService"

vi.mock("../lib/email")

const order: AdminOrder = {
  id: 7,
  number: "GS-0007",
  status: "pending",
  createdAt: "2026-11-06T14:03:00.000Z",
  items: [{ productId: 5, name: "Qadisha", stoneType: "Limestone", color: "Sand", quantity: 1, unitPrice: 890, lineTotal: 890, image: null }],
  subtotal: 890,
  deliveryFee: 0,
  total: 890,
  recipient: { name: "Sara Khoury", phone: "+96171234567", isAccountHolder: true },
  city: "Jounieh",
  address: "Main road",
  deliveryNotes: null,
  isGift: false,
  giftMessage: null,
  canCancel: true,
  customer: { id: "1b5c", email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" },
  nextStatus: "confirmed",
  canEditFee: true,
}

let log: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("SITE_URL", "https://glowstonelb.com")
  vi.stubEnv("STUDIO_URL", "https://studio.glowstonelb.com")
  log = vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  log.mockRestore()
})

const sentTo = () => vi.mocked(sendEmail).mock.calls.map(([to, email]) => [to, email.subject])

describe("notifyOrderPlaced()", () => {
  it("sends the customer's receipt and the alert to every admin", async () => {
    vi.mocked(listAdminEmails).mockResolvedValue(["rami@example.com", "omar@example.com"])
    await notifyOrderPlaced(order)
    expect(sentTo()).toEqual(
      expect.arrayContaining([
        ["sara@example.com", "We've received your order GS-0007"],
        ["rami@example.com", "New order GS-0007 · Sara Khoury · $890"],
        ["omar@example.com", "New order GS-0007 · Sara Khoury · $890"],
      ]),
    )
    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it("never throws: a failed email or an unreadable admin list is only logged", async () => {
    vi.mocked(listAdminEmails).mockRejectedValue(new Error("AccessDenied"))
    vi.mocked(sendEmail).mockRejectedValue(new Error("MessageRejected"))
    await expect(notifyOrderPlaced(order)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith("Email not sent (received GS-0007):", "MessageRejected")
    expect(log).toHaveBeenCalledWith("Admin alert not sent (new order GS-0007): admins unreadable:", "AccessDenied")
  })

  it("never throws when a setting is missing", async () => {
    vi.stubEnv("SITE_URL", "")
    vi.mocked(listAdminEmails).mockResolvedValue([])
    await expect(notifyOrderPlaced(order)).resolves.toBeUndefined()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe("notifyOrderStatus()", () => {
  it("sends the step's email to the account holder", async () => {
    await notifyOrderStatus("confirmed", { ...order, status: "confirmed" })
    expect(sentTo()).toEqual([["sara@example.com", "Your order GS-0007 is confirmed"]])
  })
})
