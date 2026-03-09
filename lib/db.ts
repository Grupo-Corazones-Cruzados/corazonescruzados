import { Pool, PoolClient, QueryResult } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log("query", { text: text.slice(0, 100), duration, rows: result.rowCount });
    }
    return result;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    const msg = (err as { message?: string }).message || "";
    const isConnectionError =
      code === "ECONNRESET" ||
      code === "EPIPE" ||
      code === "57P01" ||
      code === "57P03" ||
      msg.includes("terminated unexpectedly") ||
      msg.includes("Connection terminated") ||
      msg.includes("ECONNRESET") ||
      msg.includes("ECONNREFUSED");

    if (isConnectionError) {
      if (process.env.NODE_ENV === "development") {
        console.log("query (retrying after connection error)", { code, msg: msg.slice(0, 80) });
      }
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === "development") {
        console.log("query (retry ok)", { text: text.slice(0, 100), duration, rows: result.rowCount });
      }
      return result;
    }
    throw err;
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export default pool;
