import { Pool } from "pg";

// Modul ini khusus server-side (Server Components, Server Actions, Route Handlers).
// DILARANG mengimpor file ini di src/middleware.js.

const globalForDb = globalThis;

/**
 * Membuat atau mengambil instance pg.Pool tunggal agar tidak bocor saat hot-reload (dev).
 */
function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Variabel lingkungan DATABASE_URL belum diatur. Periksa file .env Anda."
    );
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const pool = globalForDb.__ajucutiPgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ajucutiPgPool = pool;
}

/**
 * Menjalankan raw SQL query terparameterisasi ($1, $2, ...).
 * Jangan pernah menggabungkan input pengguna langsung ke string SQL.
 *
 * @param {string} text - Query SQL dengan placeholder $1, $2, dst.
 * @param {Array} [params=[]] - Nilai parameter query.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Menjalankan beberapa query di dalam satu transaksi PostgreSQL secara atomik.
 * Otomatis melakukan ROLLBACK jika terjadi error di dalam callback.
 *
 * @param {(client: import("pg").PoolClient) => Promise<any>} callback
 */
export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}