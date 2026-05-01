import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Supabase pool kept for reference but not used as primary
// All application data lives in the local PostgreSQL (DATABASE_URL)
export const supabasePool = process.env.SUPABASE_DATABASE_URL
  ? new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

// primaryPool: always use local PostgreSQL where all data lives
export const primaryPool = pool;
