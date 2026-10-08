import "dotenv/config"

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const config = {
  db: {
    host: required("DB_HOST"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    port: Number(required("DB_PORT")),
    // TLS is on everywhere except the local test database (DB_SSL=false).
    ssl: process.env.DB_SSL !== "false",
  },
}
