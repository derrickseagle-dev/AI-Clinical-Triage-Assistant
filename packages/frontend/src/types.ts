// ─── Risk Level ─────────────────────────────────────────────────────────────────

export type RiskLevel = "EMERGENCY" | "URGENT" | "ROUTINE" | "SELF_CARE";

// ─── Triage Result ──────────────────────────────────────────────────────────────

export interface TriageResult {
  riskLevel: RiskLevel;
  confidence: number;
  reasoning: string;
  recommendedAction: string;
  followUpGuidance: string;
}

// ─── Queue Entry ────────────────────────────────────────────────────────────────

export interface QueueEntry {
  id: string;
  chiefComplaint: string;
  age: number;
  result: TriageResult;
  createdAt: string;
}

// ─── Severity ordering for sorting ──────────────────────────────────────────────

export const RISK_ORDER: Record<RiskLevel, number> = {
  EMERGENCY: 0,
  URGENT: 1,
  ROUTINE: 2,
  SELF_CARE: 3,
};
