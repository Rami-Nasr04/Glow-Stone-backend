import { Pool, types, type PoolClient, type QueryResultRow } from "pg"
import { config } from "./config"

// Postgres numeric (OID 1700) returns as a string by default — coerce to a JS number.
types.setTypeParser(1700, (val) => parseFloat(val))

// Module-level pool, reused across warm invocations of the same Lambda container.
// Each container serves one request at a time, so keep `max` small to avoid
// exhausting RDS connection slots when many containers are warm.
const pool = new Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  // Verifies the RDS certificate. Lambda trusts the RDS CA via NODE_EXTRA_CA_CERTS (serverless.yml).
  ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
  max: 2,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 20_000,
  keepAlive: true,
})

pool.on("error", (err) => {
  console.error("Unexpected idle client error:", err)
})

/**
 * Run a parameterized SQL query ($1, $2, ... placeholders).
 * Logs hints for common connection errors before rethrowing.
 */
export const executeQuery = async <T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  try {
    const result = await pool.query<T>(sql, params)
    return result.rows
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    console.error("Query error:", err.message)
    console.error("Query:", sql.substring(0, 120))
    if (err.code === "ENOTFOUND") console.error("Host not found — check DB_HOST and VPC access")
    else if (err.code === "ECONNREFUSED") console.error("Connection refused — check RDS status and security groups")
    else if (err.code === "28P01") console.error("Auth failed — check DB_USER and DB_PASSWORD")
    else if (err.code === "3D000") console.error("Database not found — check DB_NAME")
    throw error
  }
}

/**
 * Run work in one transaction on one connection: commit if it returns, roll back if it throws (then rethrow).
 * A connection whose rollback failed is thrown away instead of going back to the pool.
 */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  let broken = false
  try {
    await client.query("begin")
    const result = await work(client)
    await client.query("commit")
    return result
  } catch (err) {
    try {
      await client.query("rollback")
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr)
      broken = true
    }
    throw err
  } finally {
    client.release(broken)
  }
}

export { pool }
