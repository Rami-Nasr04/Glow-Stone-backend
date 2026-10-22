import { addSubscriber } from "../models/subscriberModel"
import type { SubscribeInput } from "../schemas/subscriber.schema"

// A filled spam trap answers like a real sign-up, so a robot can't tell it was caught, but nothing is saved.
export async function subscribe({ email, rejoin, website }: SubscribeInput): Promise<void> {
  if (website) return
  await addSubscriber(email, rejoin)
}
