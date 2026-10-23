// GET /me: the signed-in customer, for checkout's "Me" and the account page.
export interface Me {
  email: string
  name: string
  phone: string
}
