import { useState, useRef, type FormEvent, type ChangeEvent, type DragEvent } from "react";
import type { TriageResult } from "../types";
import RiskBadge from "./RiskBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SymptomEntry {
  id: string;
  description: string;
  severity: number;
  durationValue: string;
  durationUnit: "hours" | "days" | "weeks";
  bodyArea: string;
  associatedSymptoms: string;
}

interface VitalsData {
  heartRate: string;
  systolicBP: string;
  diastolicBP: string;
  temperature: string;
  oxygenSaturation: string;
  bloodGlucose: string;
}

interface StepErrors {
  chiefComplaint?: string;
  age?: string;
  symptoms?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BODY_AREAS = [
  "Head", "Chest", "Abdomen", "Back",
  "Left Arm", "Right Arm", "Left Leg", "Right Leg",
  "Neck", "Pelvis", "Skin", "General",
];

const DURATION_LABELS: Record<SymptomEntry["durationUnit"], string> = {
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SEVERITY_LABELS: Record<number, string> = {
  1: "Mild",
  2: "Mild",
  3: "Mild",
  4: "Moderate",
  5: "Moderate",
  6: "Moderate",
  7: "Severe",
  8: "Severe",
  9: "Very Severe",
  10: "Worst Imaginable",
};

function newSymptom(): SymptomEntry {
  return {
    id: crypto.randomUUID(),
    description: "",
    severity: 5,
    durationValue: "",
    durationUnit: "days",
    bodyArea: "",
    associatedSymptoms: "",
  };
}

function emptyVitals(): VitalsData {
  return {
    heartRate: "",
    systolicBP: "",
    diastolicBP: "",
    temperature: "",
    oxygenSaturation: "",
    bloodGlucose: "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientIntake() {
  // Wizard step: 1, 2, 3, or 4 (results)
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  // Step 1 state
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [age, setAge] = useState("");
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([newSymptom()]);
  const [stepErrors, setStepErrors] = useState<StepErrors>({});

  // Step 2 state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Step 3 state
  const [vitals, setVitals] = useState<VitalsData>(emptyVitals());

  // Results state
  const [result, setResult] = useState<TriageResult | null>(null);

  // ─── Step 1: Validation ──────────────────────────────────────────────────

  function validateStep1(): boolean {
    const e: StepErrors = {};

    if (!chiefComplaint.trim()) {
      e.chiefComplaint = "Please describe what's wrong.";
    }

    if (!age.trim() || isNaN(Number(age)) || Number(age) < 0 || Number(age) > 130) {
      e.age = "Please enter a valid age (0–130).";
    }

    const validSymptoms = symptoms.filter(
      (s) => s.description.trim() && s.bodyArea
    );
    if (validSymptoms.length === 0) {
      e.symptoms = "Add at least one symptom with a description and body area.";
    }

    setStepErrors(e);
    return Object.keys(e).length === 0;
  }

  // ─── Step 1: Symptom helpers ─────────────────────────────────────────────

  function addSymptom() {
    setSymptoms((prev) => [...prev, newSymptom()]);
  }

  function removeSymptom(id: string) {
    setSymptoms((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== id);
    });
  }

  function updateSymptom(id: string, patch: Partial<SymptomEntry>) {
    setSymptoms((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  // ─── Step 2: Image helpers ───────────────────────────────────────────────

  function processFiles(files: FileList | null) {
    if (!files) return;
    setImageError("");

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(files)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setImageError("Only JPEG, PNG, and WebP images are accepted.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setImageError("Each image must be under 10MB.");
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    if (newFiles.length > 0) {
      setImageFiles((prev) => [...prev, ...newFiles]);
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }

  // ─── Step 3: Simulate device reading ─────────────────────────────────────

  function simulateVitals() {
    setVitals({
      heartRate: String(Math.floor(Math.random() * 40) + 60), // 60–99
      systolicBP: String(Math.floor(Math.random() * 40) + 110), // 110–149
      diastolicBP: String(Math.floor(Math.random() * 20) + 70), // 70–89
      temperature: (36.1 + Math.random() * 1.5).toFixed(1), // 36.1–37.6 °C
      oxygenSaturation: String(Math.floor(Math.random() * 5) + 95), // 95–99%
      bloodGlucose: String(Math.floor(Math.random() * 60) + 80), // 80–139 mg/dL
    });
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setServerError("");

    try {
      const formData = new FormData();
      formData.append("chiefComplaint", chiefComplaint.trim());
      formData.append("age", age.trim());

      // Build symptoms array (filter to valid ones only)
      const validSymptoms = symptoms
        .filter((s) => s.description.trim() && s.bodyArea)
        .map((s) => ({
          description: s.description.trim(),
          severity: s.severity,
          duration: `${s.durationValue} ${s.durationUnit}`,
          bodyArea: s.bodyArea,
          associatedSymptoms: s.associatedSymptoms
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }));
      formData.append("symptoms", JSON.stringify(validSymptoms));

      // Build vitals object (only non-empty fields)
      const vitalsObj: Record<string, number> = {};
      if (vitals.heartRate) vitalsObj.heartRate = Number(vitals.heartRate);
      if (vitals.systolicBP) vitalsObj.systolicBP = Number(vitals.systolicBP);
      if (vitals.diastolicBP) vitalsObj.diastolicBP = Number(vitals.diastolicBP);
      if (vitals.temperature) vitalsObj.temperature = Number(vitals.temperature);
      if (vitals.oxygenSaturation) vitalsObj.oxygenSaturation = Number(vitals.oxygenSaturation);
      if (vitals.bloodGlucose) vitalsObj.bloodGlucose = Number(vitals.bloodGlucose);
      if (Object.keys(vitalsObj).length > 0) {
        formData.append("vitals", JSON.stringify(vitalsObj));
      }

      // Append images
      for (const file of imageFiles) {
        formData.append("images", file);
      }

      const res = await fetch("/api/intake/triage", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error || `Request failed with status ${res.status}`;
        const details = data?.details ? `: ${data.details.join("; ")}` : "";
        setServerError(msg + details);
        setStep(1); // Go back to first step on error
        return;
      }

      setResult(data as TriageResult);
      setStep(4); // Show results
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setStep(1);
    setChiefComplaint("");
    setAge("");
    setSymptoms([newSymptom()]);
    setStepErrors({});
    setImageFiles([]);
    setImagePreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setImageError("");
    setVitals(emptyVitals());
    setResult(null);
    setServerError("");
  }

  // ─── Shared styles ───────────────────────────────────────────────────────

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
  const errorClass = "mt-1 text-sm text-red-600";

  // ─── Step indicator ──────────────────────────────────────────────────────

  function StepIndicator() {
    if (step === 4) return null;
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                s === step
                  ? "bg-blue-600 text-white shadow-md"
                  : s < step
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                s === step ? "text-blue-700" : s < step ? "text-green-600" : "text-gray-400"
              }`}
            >
              {s === 1 ? "Symptoms" : s === 2 ? "Images" : "Vitals"}
            </span>
            {s < 3 && (
              <div
                className={`mx-1 h-0.5 w-8 sm:w-12 rounded ${
                  s < step ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <StepIndicator />

      {/* ── Step 1: Symptoms ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Tell us what's wrong</h2>
            <p className="text-gray-500 mt-1">
              Describe your symptoms so we can assess your situation.
            </p>
          </div>

          {/* Chief Complaint */}
          <div>
            <label htmlFor="chiefComplaint" className={labelClass}>
              What brings you in today? <span className="text-red-500">*</span>
            </label>
            <input
              id="chiefComplaint"
              type="text"
              className={inputClass}
              placeholder="e.g. Sharp chest pain, difficulty breathing"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
            {stepErrors.chiefComplaint && (
              <p className={errorClass}>{stepErrors.chiefComplaint}</p>
            )}
          </div>

          {/* Age */}
          <div>
            <label htmlFor="age" className={labelClass}>
              Age <span className="text-red-500">*</span>
            </label>
            <input
              id="age"
              type="number"
              min={0}
              max={130}
              className={inputClass}
              placeholder="e.g. 45"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            {stepErrors.age && <p className={errorClass}>{stepErrors.age}</p>}
          </div>

          {/* Symptoms */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={labelClass}>
                Symptoms <span className="text-red-500">*</span>
              </span>
              <button
                type="button"
                onClick={addSymptom}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                + Add symptom
              </button>
            </div>

            <div className="space-y-4">
              {symptoms.map((symptom, idx) => (
                <div
                  key={symptom.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">
                      Symptom {idx + 1}
                    </span>
                    {symptoms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSymptom(symptom.id)}
                        className="text-sm text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. Sharp chest pain, headache"
                      value={symptom.description}
                      onChange={(e) =>
                        updateSymptom(symptom.id, { description: e.target.value })
                      }
                    />
                  </div>

                  {/* Severity */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-600">
                        Severity
                      </label>
                      <span className="text-sm font-semibold text-blue-700">
                        {symptom.severity} &mdash; {SEVERITY_LABELS[symptom.severity]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={symptom.severity}
                      onChange={(e) =>
                        updateSymptom(symptom.id, {
                          severity: Number(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>Mild</span>
                      <span>Worst Imaginable</span>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Duration
                      </label>
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        placeholder="e.g. 2"
                        value={symptom.durationValue}
                        onChange={(e) =>
                          updateSymptom(symptom.id, {
                            durationValue: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Unit
                      </label>
                      <select
                        className={inputClass}
                        value={symptom.durationUnit}
                        onChange={(e) =>
                          updateSymptom(symptom.id, {
                            durationUnit: e.target.value as SymptomEntry["durationUnit"],
                          })
                        }
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                    </div>
                  </div>

                  {/* Body Area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Body Area
                    </label>
                    <select
                      className={inputClass}
                      value={symptom.bodyArea}
                      onChange={(e) =>
                        updateSymptom(symptom.id, { bodyArea: e.target.value })
                      }
                    >
                      <option value="">Select area...</option>
                      {BODY_AREAS.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Associated Symptoms */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Associated symptoms{" "}
                      <span className="text-gray-400 font-normal">
                        (comma-separated)
                      </span>
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. nausea, sweating, dizziness"
                      value={symptom.associatedSymptoms}
                      onChange={(e) =>
                        updateSymptom(symptom.id, {
                          associatedSymptoms: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {stepErrors.symptoms && (
              <p className={errorClass}>{stepErrors.symptoms}</p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Next button */}
          <button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className="w-full rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Next: Add Images
          </button>
        </div>
      )}

      {/* ── Step 2: Images ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Upload images</h2>
            <p className="text-gray-500 mt-1">
              Add photos of visible symptoms like rashes, swelling, or wounds.
            </p>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
          >
            <div className="space-y-2">
              <svg
                className="mx-auto h-10 w-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-base text-gray-600">
                Drag & drop images here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-blue-600 hover:text-blue-800"
                >
                  browse files
                </button>
              </p>
              <p className="text-sm text-gray-400">
                JPEG, PNG, WebP &middot; Max 10MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              multiple
              className="hidden"
              onChange={(e) => processFiles(e.target.files)}
            />
          </div>

          {/* Camera capture */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Take a photo
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => processFiles(e.target.files)}
            />
          </div>

          {/* Image error */}
          {imageError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {imageError}
            </div>
          )}

          {/* Previews */}
          {imagePreviews.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Selected images ({imagePreviews.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={preview}
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-28 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              {imageFiles.length > 0 ? "Next: Vitals" : "Skip"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Vitals ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Vital signs</h2>
            <p className="text-gray-500 mt-1">
              Enter any vitals you have, or skip. All fields are optional.
            </p>
          </div>

          <div className="space-y-4">
            {/* Heart Rate */}
            <div>
              <label htmlFor="heartRate" className={labelClass}>
                Heart Rate{" "}
                <span className="text-gray-400 font-normal">(bpm)</span>
              </label>
              <input
                id="heartRate"
                type="number"
                min={0}
                max={300}
                className={inputClass}
                placeholder="e.g. 72"
                value={vitals.heartRate}
                onChange={(e) =>
                  setVitals((v) => ({ ...v, heartRate: e.target.value }))
                }
              />
            </div>

            {/* Blood Pressure */}
            <div>
              <label className={labelClass}>
                Blood Pressure{" "}
                <span className="text-gray-400 font-normal">(mmHg)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Systolic
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    className={inputClass}
                    placeholder="e.g. 120"
                    value={vitals.systolicBP}
                    onChange={(e) =>
                      setVitals((v) => ({ ...v, systolicBP: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Diastolic
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    className={inputClass}
                    placeholder="e.g. 80"
                    value={vitals.diastolicBP}
                    onChange={(e) =>
                      setVitals((v) => ({ ...v, diastolicBP: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Temperature */}
            <div>
              <label htmlFor="temperature" className={labelClass}>
                Temperature{" "}
                <span className="text-gray-400 font-normal">(°C)</span>
              </label>
              <input
                id="temperature"
                type="number"
                min={30}
                max={45}
                step={0.1}
                className={inputClass}
                placeholder="e.g. 37.0"
                value={vitals.temperature}
                onChange={(e) =>
                  setVitals((v) => ({ ...v, temperature: e.target.value }))
                }
              />
            </div>

            {/* Oxygen Saturation */}
            <div>
              <label htmlFor="oxygenSaturation" className={labelClass}>
                Oxygen Saturation{" "}
                <span className="text-gray-400 font-normal">(%)</span>
              </label>
              <input
                id="oxygenSaturation"
                type="number"
                min={0}
                max={100}
                className={inputClass}
                placeholder="e.g. 98"
                value={vitals.oxygenSaturation}
                onChange={(e) =>
                  setVitals((v) => ({ ...v, oxygenSaturation: e.target.value }))
                }
              />
            </div>

            {/* Blood Glucose */}
            <div>
              <label htmlFor="bloodGlucose" className={labelClass}>
                Blood Glucose{" "}
                <span className="text-gray-400 font-normal">(mg/dL)</span>
              </label>
              <input
                id="bloodGlucose"
                type="number"
                min={0}
                max={600}
                className={inputClass}
                placeholder="e.g. 100"
                value={vitals.bloodGlucose}
                onChange={(e) =>
                  setVitals((v) => ({ ...v, bloodGlucose: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Simulate device */}
          <div className="text-center">
            <button
              type="button"
              onClick={simulateVitals}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              Simulate device reading
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Submitting...
                </span>
              ) : (
                "Submit Assessment"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Results ───────────────────────────────────────────── */}
      {step === 4 && result && (
        <div className="space-y-6">
          <div className="text-center mb-2">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Assessment Complete
            </h2>
            <p className="text-gray-500 mt-1">
              Here's what we found based on your symptoms.
            </p>
          </div>

          {/* Result card */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {chiefComplaint}
                </h3>
                <p className="text-sm text-gray-500">Age: {age}</p>
              </div>
              <RiskBadge level={result.riskLevel} />
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Confidence */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">
                    Confidence
                  </span>
                  <span className="text-sm font-bold text-blue-700">
                    {(result.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${result.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Recommended Action */}
              <div>
                <span className="text-sm font-medium text-gray-600">
                  Recommended Action
                </span>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {result.recommendedAction}
                </p>
              </div>

              {/* Reasoning */}
              <div>
                <span className="text-sm font-medium text-gray-600">
                  Clinical Reasoning
                </span>
                <div className="mt-1 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 border border-gray-200">
                  {result.reasoning}
                </div>
              </div>

              {/* Follow-up */}
              <div>
                <span className="text-sm font-medium text-gray-600">
                  Follow-up Guidance
                </span>
                <p className="mt-1 text-sm text-gray-700">
                  {result.followUpGuidance}
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <strong>Disclaimer:</strong> This is an AI-powered assessment for
            clinical decision support only. It is not a substitute for
            professional medical judgment. If you are experiencing a medical
            emergency, call emergency services immediately.
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={resetAll}
            className="w-full rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Start New Assessment
          </button>
        </div>
      )}
    </div>
  );
}
