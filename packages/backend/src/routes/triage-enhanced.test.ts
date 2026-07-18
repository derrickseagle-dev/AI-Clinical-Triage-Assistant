import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { enhancedTriageRouter } from "./triage-enhanced.js";
import * as llmClient from "../llm/client.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api", enhancedTriageRouter);
  return app;
}

const validTriageBody = {
  chiefComplaint: "Mild headache",
  age: 30,
  symptoms: [
    {
      description: "Dull frontal headache",
      severity: 3,
      duration: "2 hours",
      bodyArea: "head",
      associatedSymptoms: [],
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/triage/enhanced — fallback (no LLM)", () => {
  beforeEach(() => {
    // Ensure no API key is set for these tests
    vi.restoreAllMocks();
    vi.spyOn(llmClient, "hasLlm").mockReturnValue(false);
  });

  it("returns aiEnhanced: false when no LLM is available", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send(validTriageBody);

    expect(res.status).toBe(200);
    expect(res.body.aiEnhanced).toBe(false);
    expect(res.body.riskLevel).toBeDefined();
    expect(res.body.confidence).toBeDefined();
    expect(res.body.reasoning).toBeDefined();
    expect(res.body.recommendedAction).toBeDefined();
    expect(res.body.followUpGuidance).toBeDefined();
  });

  it("returns correct deterministic result when no LLM (SELF_CARE)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send(validTriageBody);

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("SELF_CARE");
    expect(res.body.aiEnhanced).toBe(false);
  });

  it("returns correct deterministic result when no LLM (EMERGENCY)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({
        chiefComplaint: "Sharp chest pain radiating to left arm",
        age: 55,
        symptoms: [
          {
            description: "Crushing chest pressure",
            severity: 9,
            duration: "30 minutes",
            bodyArea: "chest",
            associatedSymptoms: ["sweating", "nausea", "shortness of breath"],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("EMERGENCY");
    expect(res.body.aiEnhanced).toBe(false);
  });

  it("returns 400 on validation errors", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed.");
    expect(res.body.details).toBeInstanceOf(Array);
  });

  it("validates chiefComplaint is required", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({ age: 30, symptoms: [] });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("chiefComplaint"))).toBe(true);
  });

  it("validates age is required", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({ chiefComplaint: "Test", symptoms: [] });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("age"))).toBe(true);
  });

  it("validates age range", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({ chiefComplaint: "Test", age: 200, symptoms: [] });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("age"))).toBe(true);
  });

  it("validates symptom fields", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({
        chiefComplaint: "Test",
        age: 30,
        symptoms: [{ description: "", severity: 15, duration: "", bodyArea: "", associatedSymptoms: [] }],
      });

    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

// ─── Tests with LLM available ──────────────────────────────────────────────────

describe("POST /api/triage/enhanced — with LLM", () => {
  const mockEnhancedResult = {
    riskLevel: "URGENT",
    confidence: 0.85,
    reasoning: "AI-enhanced reasoning: elevated BP combined with headache warrants urgent evaluation.",
    recommendedAction: "Seek urgent care within 4 hours for blood pressure management and headache evaluation.",
    followUpGuidance: "Monitor BP at home. Return to ER if headache worsens or vision changes occur.",
    aiNotes: "The combination of headache and elevated BP may indicate hypertensive urgency.",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(llmClient, "hasLlm").mockReturnValue(true);
    vi.spyOn(llmClient, "enhanceTriageResult").mockImplementation(async (result) => {
      // Simulate AI escalation from ROUTINE to URGENT
      return {
        riskLevel: mockEnhancedResult.riskLevel as "URGENT",
        confidence: mockEnhancedResult.confidence,
        reasoning: mockEnhancedResult.reasoning,
        recommendedAction: mockEnhancedResult.recommendedAction,
        followUpGuidance: mockEnhancedResult.followUpGuidance,
      };
    });
  });

  it("returns aiEnhanced: true when LLM is available", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send(validTriageBody);

    expect(res.status).toBe(200);
    expect(res.body.aiEnhanced).toBe(true);
  });

  it("uses AI-enhanced result when LLM escalates", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({
        chiefComplaint: "Headache with dizziness",
        age: 45,
        symptoms: [
          {
            description: "Throbbing headache",
            severity: 6,
            duration: "6 hours",
            bodyArea: "head",
            associatedSymptoms: ["dizziness"],
          },
        ],
        vitals: { systolicBP: 155, diastolicBP: 95 },
      });

    expect(res.status).toBe(200);
    expect(res.body.aiEnhanced).toBe(true);
    expect(res.body.riskLevel).toBe("URGENT"); // AI escalated
    expect(res.body.reasoning).toContain("AI-enhanced");
  });

  it("includes aiEnhanced flag in response", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send(validTriageBody);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("aiEnhanced");
    expect(typeof res.body.aiEnhanced).toBe("boolean");
  });
});

// ─── Risk level never downgraded ───────────────────────────────────────────────

describe("POST /api/triage/enhanced — risk level safety", () => {
  it("does not downgrade risk level when AI tries to downgrade", async () => {
    vi.restoreAllMocks();
    vi.spyOn(llmClient, "hasLlm").mockReturnValue(true);
    vi.spyOn(llmClient, "enhanceTriageResult").mockImplementation(async (result) => {
      // AI tries to downgrade from EMERGENCY to ROUTINE — should be rejected
      return {
        riskLevel: "ROUTINE" as const,
        confidence: 0.3,
        reasoning: "AI incorrectly thinks this is routine",
        recommendedAction: "Rest at home",
        followUpGuidance: "Monitor",
      };
    });

    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({
        chiefComplaint: "Sharp chest pain with shortness of breath",
        age: 60,
        symptoms: [
          {
            description: "Crushing chest pain",
            severity: 10,
            duration: "20 minutes",
            bodyArea: "chest",
            associatedSymptoms: ["shortness of breath", "sweating"],
          },
        ],
      });

    expect(res.status).toBe(200);
    // The deterministic engine would classify this as EMERGENCY (chest pain red flag)
    expect(res.body.riskLevel).toBe("EMERGENCY");
    expect(res.body.aiEnhanced).toBe(true);
  });

  it("preserves EMERGENCY from deterministic engine even with AI", async () => {
    vi.restoreAllMocks();
    vi.spyOn(llmClient, "hasLlm").mockReturnValue(true);
    vi.spyOn(llmClient, "enhanceTriageResult").mockImplementation(async (result) => {
      // AI agrees — confirms EMERGENCY
      return { ...result, confidence: 0.95 };
    });

    const app = makeApp();
    const res = await request(app)
      .post("/api/triage/enhanced")
      .send({
        chiefComplaint: "I can't breathe",
        age: 40,
        symptoms: [
          {
            description: "Severe difficulty breathing",
            severity: 10,
            duration: "15 minutes",
            bodyArea: "chest",
            associatedSymptoms: ["wheezing"],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("EMERGENCY");
    expect(res.body.aiEnhanced).toBe(true);
  });
});
