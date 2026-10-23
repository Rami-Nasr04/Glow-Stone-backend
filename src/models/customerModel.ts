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

export interface AdminCustomerRow extends CustomerRow {
  created_at: Date
  order_count: number
}

// The studio's customer list (or one customer with a customerId), newest first, with how many orders each placed.
export async function findAdminCustomers(customerId: string | null = null): Promise<AdminCustomerRow[]> {
  return executeQuery<AdminCustomerRow>(
    `select c.id, c.email, c.name, c.phone, c.created_at,
            (select count(*)::int from orders o where o.customer_id = c.id) as order_count
     from customers c
     where $1::uuid is null or c.id = $1::uuid
     order by c.created_at desc, c.email`,
    [customerId],
  )
}
