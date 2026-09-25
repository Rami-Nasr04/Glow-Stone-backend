import { Pool, types, type QueryResultRow } from "pg"
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
  ssl: { rejectUnauthorized: true },
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

// Exposed for transactions: const client = await pool.connect(); BEGIN / COMMIT / ROLLBACK.
export { pool }
