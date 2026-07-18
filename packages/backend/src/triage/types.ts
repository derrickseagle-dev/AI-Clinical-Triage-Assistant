// ─── Risk Level ───────────────────────────────────────────────────────────────

export type RiskLevel = "EMERGENCY" | "URGENT" | "ROUTINE" | "SELF_CARE";

// ─── Symptom Input ────────────────────────────────────────────────────────────

export interface SymptomInput {
  /** Free-text description of the symptom (e.g. "sharp chest pain") */
  description: string;
  /** Severity on a 1–10 scale (1 = barely noticeable, 10 = worst imaginable) */
  severity: number;
  /** How long the symptom has persisted (e.g. "2 hours", "3 days") */
  duration: string;
  /** Body area affected (e.g. "chest", "head", "abdomen") */
  bodyArea: string;
  /** Any other symptoms the patient is experiencing alongside the primary one */
  associatedSymptoms: string[];
}

// ─── Vital Signs Input ────────────────────────────────────────────────────────

export interface VitalInput {
  /** Heart rate in beats per minute */
  heartRate?: number;
  /** Systolic blood pressure in mmHg */
  systolicBP?: number;
  /** Diastolic blood pressure in mmHg */
  diastolicBP?: number;
  /** Body temperature in degrees Fahrenheit */
  temperatureF?: number;
  /** Oxygen saturation as a percentage (0–100) */
  oxygenSaturation?: number;
  /** Blood glucose in mg/dL */
  bloodGlucose?: number;
}

// ─── Triage Case (combined input) ─────────────────────────────────────────────

export interface TriageCase {
  /** The patient's primary reason for seeking care */
  chiefComplaint: string;
  /** Patient age in years */
  age: number;
  /** One or more structured symptom entries */
  symptoms: SymptomInput[];
  /** Optional vital signs from devices or self-report */
  vitals?: VitalInput;
}

// ─── Triage Result ────────────────────────────────────────────────────────────

export interface TriageResult {
  /** Classified risk level */
  riskLevel: RiskLevel;
  /** Confidence in the classification (0 = none, 1 = certain) */
  confidence: number;
  /** Human-readable explanation of why this risk level was assigned */
  reasoning: string;
  /** Actionable next-step recommendation */
  recommendedAction: string;
  /** Guidance for follow-up or monitoring */
  followUpGuidance: string;
}
