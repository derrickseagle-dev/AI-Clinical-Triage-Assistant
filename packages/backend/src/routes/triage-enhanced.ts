import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { TriageCase, TriageResult } from "../triage/types.js";
import { assessRisk } from "../triage/engine.js";
import { sql, hasDb } from "../db.js";
import { hasLlm, enhanceTriageResult } from "../llm/client.js";

export const enhancedTriageRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shared validation between /triage and /triage/enhanced. */
function validateTriageBody(body: Partial<TriageCase>): string[] {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    errors.push("Request body must be a JSON object.");
    return errors;
  }

  if (!body.chiefComplaint || typeof body.chiefComplaint !== "string" || body.chiefComplaint.trim().length === 0) {
    errors.push("chiefComplaint is required and must be a non-empty string.");
  }

  if (body.age === undefined || body.age === null || typeof body.age !== "number" || body.age < 0 || body.age > 130) {
    errors.push("age is required and must be a number between 0 and 130.");
  }

  if (!Array.isArray(body.symptoms)) {
    errors.push("symptoms must be an array (may be empty).");
  } else {
    for (let i = 0; i < body.symptoms.length; i++) {
      const s = body.symptoms[i];
      if (!s || typeof s !== "object") {
        errors.push(`symptoms[${i}] must be an object.`);
        continue;
      }
      if (typeof s.description !== "string" || s.description.trim().length === 0) {
        errors.push(`symptoms[${i}].description is required and must be a non-empty string.`);
      }
      if (typeof s.severity !== "number" || s.severity < 1 || s.severity > 10) {
        errors.push(`symptoms[${i}].severity is required and must be a number between 1 and 10.`);
      }
      if (typeof s.duration !== "string" || s.duration.trim().length === 0) {
        errors.push(`symptoms[${i}].duration is required and must be a non-empty string.`);
      }
      if (typeof s.bodyArea !== "string" || s.bodyArea.trim().length === 0) {
        errors.push(`symptoms[${i}].bodyArea is required and must be a non-empty string.`);
      }
      if (!Array.isArray(s.associatedSymptoms)) {
        errors.push(`symptoms[${i}].associatedSymptoms must be an array.`);
      }
    }
  }

  if (body.vitals !== undefined && body.vitals !== null) {
    const v = body.vitals;
    if (typeof v !== "object") {
      errors.push("vitals must be an object.");
    } else {
      if (v.heartRate !== undefined && (typeof v.heartRate !== "number" || v.heartRate < 0 || v.heartRate > 300)) {
        errors.push("vitals.heartRate must be a number between 0 and 300.");
      }
      if (v.systolicBP !== undefined && (typeof v.systolicBP !== "number" || v.systolicBP < 0 || v.systolicBP > 300)) {
        errors.push("vitals.systolicBP must be a number between 0 and 300.");
      }
      if (v.diastolicBP !== undefined && (typeof v.diastolicBP !== "number" || v.diastolicBP < 0 || v.diastolicBP > 200)) {
        errors.push("vitals.diastolicBP must be a number between 0 and 200.");
      }
      if (v.temperatureF !== undefined && (typeof v.temperatureF !== "number" || v.temperatureF < 70 || v.temperatureF > 115)) {
        errors.push("vitals.temperatureF must be a number between 70 and 115.");
      }
      if (v.oxygenSaturation !== undefined && (typeof v.oxygenSaturation !== "number" || v.oxygenSaturation < 0 || v.oxygenSaturation > 100)) {
        errors.push("vitals.oxygenSaturation must be a number between 0 and 100.");
      }
      if (v.bloodGlucose !== undefined && (typeof v.bloodGlucose !== "number" || v.bloodGlucose < 0 || v.bloodGlucose > 1000)) {
        errors.push("vitals.bloodGlucose must be a number between 0 and 1000.");
      }
    }
  }

  return errors;
}

/** Build a TriageCase from a validated body. */
function buildTriageCase(body: Partial<TriageCase>): TriageCase {
  return {
    chiefComplaint: body.chiefComplaint!.trim(),
    age: body.age!,
    symptoms: (body.symptoms || []).map((s) => ({
      description: s.description.trim(),
      severity: s.severity,
      duration: s.duration.trim(),
      bodyArea: s.bodyArea.trim(),
      associatedSymptoms: s.associatedSymptoms || [],
    })),
    vitals: body.vitals,
  };
}

// ─── POST /api/triage/enhanced ────────────────────────────────────────────────

enhancedTriageRouter.post("/triage/enhanced", async (req: Request, res: Response) => {
  const body = req.body as Partial<TriageCase>;

  // ── Validation ──
  const errors = validateTriageBody(body);
  if (errors.length > 0) {
    res.status(400).json({ error: "Validation failed.", details: errors });
    return;
  }

  // ── Deterministic Assessment ──
  const triageCase = buildTriageCase(body);
  const deterministicResult = assessRisk(triageCase);

  // ── AI Enhancement (optional) ──
  const aiAvailable = hasLlm();
  let result: TriageResult;
  if (aiAvailable) {
    result = await enhanceTriageResult(deterministicResult, triageCase);

    // Defense in depth: AI must never downgrade risk level
    const riskOrder: Record<string, number> = { SELF_CARE: 0, ROUTINE: 1, URGENT: 2, EMERGENCY: 3 };
    if ((riskOrder[result.riskLevel] ?? -1) < (riskOrder[deterministicResult.riskLevel] ?? -1)) {
      console.warn(
        `[triage:enhanced] AI downgraded risk from ${deterministicResult.riskLevel} to ${result.riskLevel} — rejecting downgrade`,
      );
      result = deterministicResult;
    }
  } else {
    result = deterministicResult;
  }

  // ── Persist to database ──
  let id: string = randomUUID();
  let createdAt = new Date().toISOString();

  if (hasDb()) {
    try {
      const dbResult = await sql`
        INSERT INTO triage_cases (
          chief_complaint, age, symptoms, vitals,
          risk_level, confidence, reasoning,
          recommended_action, follow_up_guidance
        )
        VALUES (
          ${triageCase.chiefComplaint}, ${triageCase.age},
          ${JSON.stringify(triageCase.symptoms)},
          ${triageCase.vitals ? JSON.stringify(triageCase.vitals) : null},
          ${result.riskLevel}, ${result.confidence}, ${result.reasoning},
          ${result.recommendedAction}, ${result.followUpGuidance}
        )
        RETURNING id, created_at
      `;
      if (dbResult.length > 0) {
        id = String(dbResult[0].id);
        createdAt = String(dbResult[0].created_at);
      }
    } catch (err) {
      console.error("[triage:enhanced] Failed to persist case:", err);
    }
  }

  res.json({
    id,
    createdAt,
    ...result,
    aiEnhanced: aiAvailable,
  });
});
