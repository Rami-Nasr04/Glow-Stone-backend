// Reads a setting from the environment; a missing or empty one is a deploy mistake, so fail loudly.
export function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}
