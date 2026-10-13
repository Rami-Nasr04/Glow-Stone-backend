import "dotenv/config"
import { requiredEnv } from "./env"

export const config = {
  db: {
    host: requiredEnv("DB_HOST"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    port: Number(requiredEnv("DB_PORT")),
    // TLS is on everywhere except the local test database (DB_SSL=false).
    ssl: process.env.DB_SSL !== "false",
  },
}
