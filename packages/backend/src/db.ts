import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;
let _warned = false;

function getSql(): NeonQueryFunction<false, false> | null {
  if (_sql) return _sql;

  if (process.env.DATABASE_URL) {
    _sql = neon(process.env.DATABASE_URL);
    return _sql;
  }

  if (!_warned) {
    console.warn("DATABASE_URL not set — running with in-memory storage");
    _warned = true;
  }
  return null;
}

/** Returns true if a live database connection is available. */
export function hasDb(): boolean {
  return getSql() !== null;
}

/**
 * SQL tagged-template helper using Neon's serverless driver.
 * Returns empty rows when DATABASE_URL is not configured so the app
 * degrades gracefully without a database.
 */
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  const db = getSql();
  if (!db) return [];
  return db(strings, ...values) as unknown as Promise<Record<string, unknown>[]>;
}
