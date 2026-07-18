import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { intakeRouter } from "./intake.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const UPLOADS_DIR = resolve("packages/backend/uploads");

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api", intakeRouter);
  return app;
}

function cleanupUploads(): void {
  if (existsSync(UPLOADS_DIR)) {
    const files = readdirSync(UPLOADS_DIR);
    for (const f of files) {
      try { unlinkSync(resolve(UPLOADS_DIR, f)); } catch { /* ignore */ }
    }
  }
}

// ─── One-time cleanup before and after ─────────────────────────────────────────

beforeEach(() => {
  cleanupUploads();
});

afterAll(() => {
  cleanupUploads();
});

// ─── 1. POST /api/intake/image ─────────────────────────────────────────────────

describe("POST /api/intake/image", () => {
  it("uploads a single JPEG image and returns metadata", async () => {
    const app = makeApp();
    // Create a minimal valid JPEG (just 1x1 pixel for test)
    const testImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM" +
      "DQ4OEQ4PERAREREMDg4WEBIRExMUExYTEhQVFBQUFP/bAEMBAwQEBQQFCQUFCRQNCw0UFRQUFBQUFBQU" +
      "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/CABEIAQABAwMBIgACEQEDEQH/xAAU" +
      "AAEAAAAAAAAAAAAAAAAAAAAI/9oACAEBAAAAAP8A/8QAFAEBAAAAAAAAAAAAAAAAAAAACf/aAAgBAhAA" +
      "AAD/AK//xAAUEAEAAAAAAAAAAAAAAAAAAAAI/9oACAEDEAAAAA/AP/xAAUEAEAAAAAAAAAAAAAAAAAAAAI" +
      "/9oACAEBAAE/AH//2Q==",
      "base64"
    );

    const res = await request(app)
      .post("/api/intake/image")
      .attach("images", testImage, { filename: "test.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].originalName).toBe("test.jpg");
    expect(res.body.files[0].mimeType).toBe("image/jpeg");
    expect(res.body.files[0].size).toBeGreaterThan(0);
    expect(res.body.files[0].path).toMatch(/^\/uploads\/[a-f0-9-]+\.jpg$/);
    expect(res.body.files[0].filename).toMatch(/^[a-f0-9-]+\.jpg$/);
  });

  it("uploads multiple images", async () => {
    const app = makeApp();
    const testImage = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM" +
      "DQ4OEQ4PERAREREMDg4WEBIRExMUExYTEhQVFBQUFP/bAEMBAwQEBQQFCQUFCRQNCw0UFRQUFBQUFBQU" +
      "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/CABEIAQABAwMBIgACEQEDEQH/xAAU" +
      "AAEAAAAAAAAAAAAAAAAAAAAI/9oACAEBAAAAAP8A/8QAFAEBAAAAAAAAAAAAAAAAAAAACf/aAAgBAhAA" +
      "AAD/AK//xAAUEAEAAAAAAAAAAAAAAAAAAAAI/9oACAEDEAAAAA/AP/xAAUEAEAAAAAAAAAAAAAAAAAAAAI" +
      "/9oACAEBAAE/AH//2Q==",
      "base64"
    );

    const res = await request(app)
      .post("/api/intake/image")
      .attach("images", testImage, { filename: "one.jpg", contentType: "image/jpeg" })
      .attach("images", testImage, { filename: "two.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.files).toHaveLength(2);
    expect(res.body.files[0].originalName).toBe("one.jpg");
    expect(res.body.files[1].originalName).toBe("two.png");
  });

  it("rejects missing files", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/intake/image");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("At least one image file is required");
  });

  it("rejects unsupported file types", async () => {
    const app = makeApp();
    const textFile = Buffer.from("not an image");
    const res = await request(app)
      .post("/api/intake/image")
      .attach("images", textFile, { filename: "doc.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Unsupported image type");
  });
});

// ─── 2. POST /api/intake/vitals ────────────────────────────────────────────────

describe("POST /api/intake/vitals", () => {
  it("validates and returns normal vitals", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/vitals")
      .send({
        heartRate: 72,
        systolicBP: 120,
        diastolicBP: 80,
        temperatureF: 98.6,
        oxygenSaturation: 98,
        bloodGlucose: 95,
      });

    expect(res.status).toBe(200);
    expect(res.body.vitals.heartRate).toBe(72);
    expect(res.body.vitals.systolicBP).toBe(120);
    expect(res.body.vitals.diastolicBP).toBe(80);
    expect(res.body.vitals.temperatureF).toBe(98.6);
    expect(res.body.vitals.oxygenSaturation).toBe(98);
    expect(res.body.vitals.bloodGlucose).toBe(95);
    expect(res.body.warnings).toBeUndefined();
  });

  it("returns warnings for out-of-range vitals", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/vitals")
      .send({
        heartRate: 45,
        oxygenSaturation: 90,
      });

    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeDefined();
    expect(res.body.warnings.length).toBeGreaterThan(0);
    // heartRate 45 is below warnMin of 50
    const hrWarning = res.body.warnings.find((w: string) => w.includes("heartRate"));
    expect(hrWarning).toBeDefined();
    // O2 90 is below warnMin of 95
    const o2Warning = res.body.warnings.find((w: string) => w.includes("oxygenSaturation"));
    expect(o2Warning).toBeDefined();
  });

  it("rejects invalid vitals values", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/vitals")
      .send({
        heartRate: 500,
        oxygenSaturation: 150,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed.");
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("rejects non-numeric values", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/vitals")
      .send({
        heartRate: "fast",
      });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toContain("must be a number");
  });

  it("accepts partial vitals (only some fields)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/vitals")
      .send({
        heartRate: 80,
        temperatureF: 99.1,
      });

    expect(res.status).toBe(200);
    expect(res.body.vitals.heartRate).toBe(80);
    expect(res.body.vitals.temperatureF).toBe(99.1);
    expect(res.body.vitals.systolicBP).toBeUndefined();
    expect(res.body.vitals.oxygenSaturation).toBeUndefined();
  });

  it("accepts empty body", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/vitals")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.vitals).toEqual({});
  });
});

// ─── 3. POST /api/intake/triage ────────────────────────────────────────────────

describe("POST /api/intake/triage", () => {
  const testImage = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM" +
    "DQ4OEQ4PERAREREMDg4WEBIRExMUExYTEhQVFBQUFP/bAEMBAwQEBQQFCQUFCRQNCw0UFRQUFBQUFBQU" +
    "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/CABEIAQABAwMBIgACEQEDEQH/xAAU" +
    "AAEAAAAAAAAAAAAAAAAAAAAI/9oACAEBAAAAAP8A/8QAFAEBAAAAAAAAAAAAAAAAAAAACf/aAAgBAhAA" +
    "AAD/AK//xAAUEAEAAAAAAAAAAAAAAAAAAAAI/9oACAEDEAAAAA/AP/xAAUEAEAAAAAAAAAAAAAAAAAAAAI" +
    "/9oACAEBAAE/AH//2Q==",
    "base64"
  );

  const validSymptoms = JSON.stringify([
    {
      description: "Sharp chest pain",
      severity: 8,
      duration: "2 hours",
      bodyArea: "chest",
      associatedSymptoms: ["shortness of breath", "sweating"],
    },
  ]);

  it("returns a valid TriageResult for a complete multimodal submission", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Sharp chest pain radiating to left arm")
      .field("age", "55")
      .field("symptoms", validSymptoms)
      .field("vitals", JSON.stringify({ heartRate: 110, systolicBP: 160, oxygenSaturation: 94 }))
      .field("audioTranscript", "Ive been having this pain for about 2 hours and it's getting worse")
      .attach("images", testImage, { filename: "rash.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBeDefined();
    expect(res.body.confidence).toBeGreaterThan(0);
    expect(res.body.reasoning).toBeDefined();
    expect(res.body.recommendedAction).toBeDefined();
    expect(res.body.followUpGuidance).toBeDefined();
    // Should have image info
    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0].path).toMatch(/^\/uploads\//);
    // Should have audioTranscript
    expect(res.body.audioTranscript).toContain("Ive been having this pain");
  });

  it("returns EMERGENCY for chest pain red flag", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "I have crushing chest pain")
      .field("age", "60")
      .field("symptoms", JSON.stringify([
        {
          description: "Crushing chest pain",
          severity: 10,
          duration: "30 minutes",
          bodyArea: "chest",
          associatedSymptoms: ["shortness of breath"],
        },
      ]));

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("EMERGENCY");
  });

  it("returns SELF_CARE for mild symptoms", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Mild headache")
      .field("age", "30")
      .field("symptoms", JSON.stringify([
        {
          description: "Dull frontal headache",
          severity: 2,
          duration: "2 hours",
          bodyArea: "head",
          associatedSymptoms: [],
        },
      ]));

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("SELF_CARE");
  });

  it("appends audioTranscript to chiefComplaint context", async () => {
    const app = makeApp();
    // Use chest pain with a transcript to confirm it's in the text flow
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Chest discomfort")
      .field("age", "45")
      .field("symptoms", JSON.stringify([
        {
          description: "Tightness in chest",
          severity: 9,
          duration: "1 hour",
          bodyArea: "chest",
          associatedSymptoms: ["difficulty breathing"],
        },
      ]))
      .field("audioTranscript", "I also feel dizzy and my left arm is numb");

    expect(res.status).toBe(200);
    expect(res.body.audioTranscript).toContain("dizzy");
    // The transcript should have been folded into the chief complaint for assessment
    expect(res.body.riskLevel).toBe("EMERGENCY"); // chest pain + difficulty breathing = EMERGENCY
  });

  // ─── Validation errors ──────────────────────────────────────────────────────

  it("returns 400 when chiefComplaint is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("age", "30")
      .field("symptoms", validSymptoms);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("chiefComplaint"))).toBe(true);
  });

  it("returns 400 when age is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Headache")
      .field("symptoms", validSymptoms);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("age"))).toBe(true);
  });

  it("returns 400 when age is out of range", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Headache")
      .field("age", "200")
      .field("symptoms", validSymptoms);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("age"))).toBe(true);
  });

  it("returns 400 when symptoms is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Headache")
      .field("age", "30");

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("symptoms"))).toBe(true);
  });

  it("returns 400 when symptoms is invalid JSON", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Headache")
      .field("age", "30")
      .field("symptoms", "{bad json}");

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("invalid JSON"))).toBe(true);
  });

  it("returns 400 when symptoms array has invalid entry", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Headache")
      .field("age", "30")
      .field("symptoms", JSON.stringify([
        { description: "", severity: 15, duration: "", bodyArea: "", associatedSymptoms: [] },
      ]));

    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("returns 400 when vitals is invalid JSON", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Headache")
      .field("age", "30")
      .field("symptoms", validSymptoms)
      .field("vitals", "not json");

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: string) => d.includes("invalid JSON"))).toBe(true);
  });

  it("works without optional vitals and images", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Mild headache")
      .field("age", "30")
      .field("symptoms", JSON.stringify([
        {
          description: "Dull headache",
          severity: 2,
          duration: "2 hours",
          bodyArea: "head",
          associatedSymptoms: [],
        },
      ]));

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("SELF_CARE");
    expect(res.body.images).toBeUndefined();
    expect(res.body.audioTranscript).toBeUndefined();
  });

  it("works with empty vitals string", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/intake/triage")
      .field("chiefComplaint", "Mild headache")
      .field("age", "30")
      .field("symptoms", validSymptoms)
      .field("vitals", "");

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBeDefined();
  });
});
