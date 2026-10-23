import { describe, expect, it } from "vitest"
import type { AdminOrder, Order } from "../types/order"
import { escapeHtml, formatMoney, formatPhone, renderCustomerEmail, renderNewOrderAlert, type CustomerEmailKind } from "./orderEmails"

const SITE = "https://glowstonelb.com"

const order: Order = {
  id: 7,
  number: "GS-0007",
  status: "pending",
  createdAt: "2026-11-06T14:03:00.000Z",
  items: [
    {
      productId: 5,
      name: "Qadisha",
      stoneType: "Limestone",
      color: "Sand",
      quantity: 2,
      unitPrice: 890,
      lineTotal: 1780,
      image: { url: "https://cdn.example.net/products/5/abcdefghij12", width: 2048, height: 3072 },
    },
  ],
  subtotal: 1780,
  deliveryFee: 0,
  total: 1780,
  recipient: { name: "Sara Khoury", phone: "+96171234567", isAccountHolder: true },
  city: "Jounieh",
  address: "Main road, Haddad bldg",
  deliveryNotes: null,
  isGift: false,
  giftMessage: null,
  canCancel: true,
}

describe("formatting", () => {
  it("shows money like the shop: cents only when there are some", () => {
    expect(formatMoney(890)).toBe("$890")
    expect(formatMoney(1200.5)).toBe("$1,200.50")
  })

  it("shows Lebanese phones in groups", () => {
    expect(formatPhone("+96171234567")).toBe("+961 71 234 567")
    expect(formatPhone("+9613123456")).toBe("+961 3 123 456")
  })

  it("escapes HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;")
  })
})

describe("renderCustomerEmail()", () => {
  it("the received email thanks the customer by first name and carries the receipt", () => {
    const email = renderCustomerEmail("received", order, "Sara Khoury", SITE)
    expect(email.subject).toBe("We've received your order GS-0007")
    expect(email.html).toContain("Thank you, Sara.")
    expect(email.html).toContain("Qadisha")
    expect(email.html).toContain("LIMESTONE · SAND · QTY 2")
    expect(email.html).toContain("$1,780")
    expect(email.html).toContain("Delivery: Free")
    expect(email.html).toContain("https://cdn.example.net/products/5/abcdefghij12/480.webp")
    expect(email.html).toContain(`${SITE}/account/orders/7`)
    expect(email.text).toContain("- Qadisha (Limestone · Sand) x 2: $1,780")
    expect(email.text).toContain("Sara Khoury · +961 71 234 567")
  })

  it("the confirmed email shows a fee Omar agreed", () => {
    const email = renderCustomerEmail("confirmed", { ...order, status: "confirmed", deliveryFee: 12.5, total: 1792.5 }, "Sara", SITE)
    expect(email.html).toContain("Delivery: $12.50")
    expect(email.text).toContain("Total: $1,792.50 (cash on delivery)")
  })

  it("out for delivery asks for the total in cash", () => {
    expect(renderCustomerEmail("out_for_delivery", order, "Sara", SITE).text).toContain("Please have $1,780 ready in cash")
  })

  it("delivered has the care tips and no receipt", () => {
    const email = renderCustomerEmail("delivered", order, "Sara", SITE)
    expect(email.html).toContain("CARING FOR YOUR PIECE")
    expect(email.html).not.toContain("ORDER GS-0007")
    expect(email.html).toContain(`${SITE}/collection`)
  })

  it.each<CustomerEmailKind>(["received", "confirmed", "out_for_delivery", "delivered", "cancelled"])("%s has a subject, HTML and text", (kind) => {
    const email = renderCustomerEmail(kind, order, "Sara", SITE)
    expect(email.subject).not.toBe("")
    expect(email.html.startsWith("<!doctype html>")).toBe(true)
    expect(email.text).toContain("glowstone216@gmail.com")
  })

  it("escapes everything the customer typed", () => {
    const sneaky = {
      ...order,
      recipient: { name: "<script>x</script>", phone: "+96171234567", isAccountHolder: false },
      address: `"><img src=x onerror=alert(1)>`,
      isGift: true,
      giftMessage: "<b>hi</b>",
    }
    const { html } = renderCustomerEmail("received", sneaky, "<i>Sara</i>", SITE)
    expect(html).not.toMatch(/<script>|<img src=x|<b>hi|<i>Sara/)
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;")
  })

  it("shows the gift and its card message", () => {
    const { html, text } = renderCustomerEmail("received", { ...order, isGift: true, giftMessage: "Happy birthday" }, "Sara", SITE)
    expect(html).toContain("GIFT")
    expect(text).toContain('Gift: "Happy birthday"')
  })
})

describe("renderNewOrderAlert()", () => {
  it("gives Omar the customer, the phone to call and a link to the studio", () => {
    const admin: AdminOrder = {
      ...order,
      customer: { id: "1b5c", email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" },
      nextStatus: "confirmed",
      canEditFee: true,
    }
    const email = renderNewOrderAlert(admin, "https://studio.glowstonelb.com")
    expect(email.subject).toBe("New order GS-0007 · Sara Khoury · $1,780")
    expect(email.text).toContain("Sara Khoury (+961 71 234 567, sara@example.com) placed an order.")
    expect(email.html).toContain("https://studio.glowstonelb.com/orders/7")
  })
})
