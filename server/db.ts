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

// Supabase pool — official website database (primary target for migration)
export const supabasePool = process.env.SUPABASE_DATABASE_URL
  ? new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

// primaryPool: uses Supabase if available, falls back to Neon
// Gradually replace `pool` with `primaryPool` across server endpoints
// to complete the migration to the official website database.
export const primaryPool = supabasePool ?? pool;
