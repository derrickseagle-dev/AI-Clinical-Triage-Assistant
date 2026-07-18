import { Router, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import type { TriageCase, SymptomInput, VitalInput } from "../triage/types.js";
import { assessRisk } from "../triage/engine.js";

// ─── Uploads directory ─────────────────────────────────────────────────────────

const UPLOADS_DIR = resolve("packages/backend/uploads");

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Allowed image types ───────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Multer storage ────────────────────────────────────────────────────────────

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uuid = randomUUID();
    const ext = extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${uuid}${ext}`);
  },
});

function createImageUploader() {
  return multer({
    storage: imageStorage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`));
      }
    },
  });
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const intakeRouter = Router();

// ─── 1. POST /intake/image ─────────────────────────────────────────────────────

intakeRouter.post("/intake/image", (req: Request, res: Response) => {
  const upload = createImageUploader().array("images", 10);

  upload(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? `Upload error: ${err.message}`
        : err.message;
      res.status(400).json({ error: message });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: "At least one image file is required." });
      return;
    }

    const uploaded = files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      mimeType: f.mimetype,
      path: `/uploads/${f.filename}`,
    }));

    res.status(201).json({ files: uploaded });
  });
});

// ─── 2. POST /intake/vitals ────────────────────────────────────────────────────

intakeRouter.post("/intake/vitals", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate each vital field
  function validateNumber(
    key: string,
    min: number,
    max: number,
    unit: string,
    warnMin?: number,
    warnMax?: number,
  ): number | undefined {
    const val = body[key];
    if (val === undefined || val === null) return undefined;
    if (typeof val !== "number" || Number.isNaN(val)) {
      errors.push(`${key} must be a number.`);
      return undefined;
    }
    if (val < min || val > max) {
      errors.push(`${key} must be between ${min} and ${max} ${unit}.`);
      return undefined;
    }
    if ((warnMin !== undefined && val < warnMin) || (warnMax !== undefined && val > warnMax)) {
      warnings.push(`${key} is outside typical range (${warnMin ?? min}–${warnMax ?? max} ${unit}).`);
    }
    return val as number;
  }

  const heartRate = validateNumber("heartRate", 20, 300, "bpm", 50, 100);
  const systolicBP = validateNumber("systolicBP", 50, 300, "mmHg", 90, 140);
  const diastolicBP = validateNumber("diastolicBP", 30, 200, "mmHg", 60, 90);
  const temperatureF = validateNumber("temperatureF", 85, 110, "°F", 97, 99.5);
  const oxygenSaturation = validateNumber("oxygenSaturation", 0, 100, "%", 95, 100);
  const bloodGlucose = validateNumber("bloodGlucose", 0, 1000, "mg/dL", 70, 140);

  if (errors.length > 0) {
    res.status(400).json({ error: "Validation failed.", details: errors });
    return;
  }

  const vitals: VitalInput = {};
  if (heartRate !== undefined) vitals.heartRate = heartRate;
  if (systolicBP !== undefined) vitals.systolicBP = systolicBP;
  if (diastolicBP !== undefined) vitals.diastolicBP = diastolicBP;
  if (temperatureF !== undefined) vitals.temperatureF = temperatureF;
  if (oxygenSaturation !== undefined) vitals.oxygenSaturation = oxygenSaturation;
  if (bloodGlucose !== undefined) vitals.bloodGlucose = bloodGlucose;

  res.json({
    vitals,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
});

// ─── 3. POST /intake/triage ────────────────────────────────────────────────────

intakeRouter.post("/intake/triage", (req: Request, res: Response) => {
  const upload = createImageUploader().array("images", 10);

  upload(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? `Upload error: ${err.message}`
        : err.message;
      res.status(400).json({ error: message });
      return;
    }

    const body = req.body as Record<string, string>;
    const files = req.files as Express.Multer.File[] | undefined;
    const errors: string[] = [];

    // ── Validate chiefComplaint ──
    const chiefComplaintRaw = body.chiefComplaint;
    if (!chiefComplaintRaw || typeof chiefComplaintRaw !== "string" || chiefComplaintRaw.trim().length === 0) {
      errors.push("chiefComplaint is required and must be a non-empty string.");
    }

    // ── Validate age ──
    const ageRaw = body.age;
    let age: number | undefined;
    if (ageRaw === undefined || ageRaw === null || ageRaw === "") {
      errors.push("age is required.");
    } else {
      age = Number(ageRaw);
      if (Number.isNaN(age) || !Number.isFinite(age) || age < 0 || age > 130) {
        errors.push("age must be a number between 0 and 130.");
        age = undefined;
      }
    }

    // ── Validate symptoms (JSON string) ──
    let symptoms: SymptomInput[] | undefined;
    const symptomsRaw = body.symptoms;
    if (!symptomsRaw || typeof symptomsRaw !== "string") {
      errors.push("symptoms is required and must be a JSON string.");
    } else {
      try {
        const parsed = JSON.parse(symptomsRaw);
        if (!Array.isArray(parsed)) {
          errors.push("symptoms must be a JSON array.");
        } else {
          symptoms = parsed;
          for (let i = 0; i < symptoms!.length; i++) {
            const s = symptoms![i];
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
      } catch {
        errors.push("symptoms contains invalid JSON.");
      }
    }

    // ── Validate vitals (JSON string, optional) ──
    let vitals: VitalInput | undefined;
    const vitalsRaw = body.vitals;
    if (vitalsRaw !== undefined && vitalsRaw !== null && vitalsRaw !== "") {
      try {
        const parsed = JSON.parse(vitalsRaw);
        if (typeof parsed !== "object" || parsed === null) {
          errors.push("vitals must be a JSON object.");
        } else {
          vitals = parsed;
          const v = vitals!;
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
      } catch {
        errors.push("vitals contains invalid JSON.");
      }
    }

    // ── Validate audioTranscript (optional) ──
    const audioTranscript = body.audioTranscript || undefined;

    // ── If validation errors, bail out ──
    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed.", details: errors });
      return;
    }

    // ── Build chief complaint (append audioTranscript if provided) ──
    let chiefComplaint = chiefComplaintRaw!.trim();
    if (audioTranscript && audioTranscript.trim().length > 0) {
      chiefComplaint = `${chiefComplaint} | Voice transcript: ${audioTranscript.trim()}`;
    }

    // ── Construct TriageCase ──
    const triageCase: TriageCase = {
      chiefComplaint,
      age: age!,
      symptoms: (symptoms || []).map((s) => ({
        description: s.description.trim(),
        severity: s.severity,
        duration: s.duration.trim(),
        bodyArea: s.bodyArea.trim(),
        associatedSymptoms: s.associatedSymptoms || [],
      })),
      vitals,
    };

    // ── Run triage engine ──
    const triageResult = assessRisk(triageCase);

    // ── Build response ──
    const uploadedImages = (files || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      mimeType: f.mimetype,
      path: `/uploads/${f.filename}`,
    }));

    res.json({
      ...triageResult,
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
      audioTranscript: audioTranscript || undefined,
    });
  });
});
