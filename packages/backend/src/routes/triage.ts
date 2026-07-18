import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { TriageCase } from "../triage/types.js";
import { assessRisk } from "../triage/engine.js";
import { sql, hasDb } from "../db.js";

export const triageRouter = Router();

// ─── GET /api/triage/history ───────────────────────────────────────────────────

triageRouter.get("/triage/history", async (_req: Request, res: Response) => {
  if (!hasDb()) {
    res.json([]);
    return;
  }

  try {
    const result = await sql`
      SELECT id, chief_complaint, age, risk_level, confidence,
             reasoning, recommended_action, follow_up_guidance, created_at
      FROM triage_cases
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const cases = result.map((row: Record<string, unknown>) => ({
      id: row.id,
      chiefComplaint: row.chief_complaint,
      age: row.age,
      result: {
        riskLevel: row.risk_level,
        confidence: row.confidence,
        reasoning: row.reasoning,
        recommendedAction: row.recommended_action,
        followUpGuidance: row.follow_up_guidance,
      },
      createdAt: row.created_at,
    }));

    res.json(cases);
  } catch (err) {
    console.error("[triage] Failed to fetch history:", err);
    res.json([]);
  }
});

// ─── POST /api/triage ──────────────────────────────────────────────────────────

triageRouter.post("/triage", async (req: Request, res: Response) => {
  const body = req.body as Partial<TriageCase>;

  // ── Validation ──
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body must be a JSON object." });
    return;
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

  // Validate vitals if provided
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

  if (errors.length > 0) {
    res.status(400).json({ error: "Validation failed.", details: errors });
    return;
  }

  // ── Assess ──
  const triageCase: TriageCase = {
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

  const result = assessRisk(triageCase);

  // ── Persist to database (or fall back to in-memory ids) ──
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
      console.error("[triage] Failed to persist case:", err);
      // Fall through — id and createdAt already have in-memory values
    }
  }

  res.json({ id, createdAt, ...result });
});
