import { listAdminEmails, sendEmail } from "../lib/email"
import { requiredEnv } from "../lib/env"
import type { AdminOrder } from "../types/order"
import { renderCustomerEmail, renderNewOrderAlert, type CustomerEmailKind, type RenderedEmail } from "../views/orderEmails"

// Emails go after the database work is committed. A failed email is logged and never fails the request:
// the order is already saved, and Omar calls every customer anyway.

async function send(label: string, to: string, build: () => RenderedEmail): Promise<void> {
  try {
    await sendEmail(to, build())
  } catch (err) {
    console.error(`Email not sent (${label}):`, err instanceof Error ? err.message : err)
  }
}

function customerEmail(kind: CustomerEmailKind, order: AdminOrder): Promise<void> {
  return send(`${kind} ${order.number}`, order.customer.email, () =>
    renderCustomerEmail(kind, order, order.customer.name, requiredEnv("SITE_URL")),
  )
}

// A new order: the customer's "received" email with the receipt, and the alert to every admin.
export async function notifyOrderPlaced(order: AdminOrder): Promise<void> {
  const alerts = async () => {
    let admins: string[]
    try {
      admins = await listAdminEmails()
    } catch (err) {
      console.error(`Admin alert not sent (new order ${order.number}): admins unreadable:`, err instanceof Error ? err.message : err)
      return
    }
    await Promise.all(admins.map((to) => send(`new order alert ${order.number}`, to, () => renderNewOrderAlert(order, requiredEnv("STUDIO_URL")))))
  }
  await Promise.all([customerEmail("received", order), alerts()])
}

// confirmed, out for delivery, delivered or cancelled: the customer hears about it.
export async function notifyOrderStatus(kind: Exclude<CustomerEmailKind, "received">, order: AdminOrder): Promise<void> {
  await customerEmail(kind, order)
}
