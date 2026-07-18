import { sql, hasDb } from "../db.js";

/**
 * Run idempotent schema migration — creates tables if they don't exist.
 * Safe to call on every server start.
 */
export async function initSchema(): Promise<void> {
  if (!hasDb()) return;

  await sql`
    CREATE TABLE IF NOT EXISTS triage_cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chief_complaint TEXT NOT NULL,
      age INTEGER NOT NULL,
      symptoms JSONB NOT NULL,
      vitals JSONB,
      risk_level TEXT NOT NULL CHECK (risk_level IN ('EMERGENCY','URGENT','ROUTINE','SELF_CARE')),
      confidence REAL NOT NULL,
      reasoning TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      follow_up_guidance TEXT NOT NULL,
      image_paths JSONB,
      audio_transcript TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}
