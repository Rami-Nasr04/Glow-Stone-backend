import { executeQuery } from "../lib/db"

export interface CustomerRow {
  id: string
  email: string
  name: string
  phone: string
}

// Makes the customer's row once. The sign-up triggers run it again on every sign-in, so an existing row is left
// exactly as it is. Only the same sub counts as existing: the same email under another sub (an account deleted
// and made again) is a unique-key error, so it shows in the logs instead of passing silently.
export async function insertCustomer(customer: CustomerRow): Promise<void> {
  await executeQuery("insert into customers (id, email, name, phone) values ($1, $2, $3, $4) on conflict (id) do nothing", [
    customer.id,
    customer.email,
    customer.name,
    customer.phone,
  ])
}

export async function findCustomer(id: string): Promise<CustomerRow | null> {
  const rows = await executeQuery<CustomerRow>("select id, email, name, phone from customers where id = $1", [id])
  return rows[0] ?? null
}
