import { useState, type FormEvent } from "react";
import type { QueueEntry, TriageResult } from "../types";

interface TriageFormProps {
  onResult: (entry: QueueEntry) => void;
}

interface FormErrors {
  chiefComplaint?: string;
  age?: string;
  symptoms?: string;
  vitals?: string;
}

export default function TriageForm({ onResult }: TriageFormProps) {
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [age, setAge] = useState("");
  const [symptomsText, setSymptomsText] = useState("");
  const [vitalsText, setVitalsText] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const e: FormErrors = {};

    if (!chiefComplaint.trim()) {
      e.chiefComplaint = "Chief complaint is required.";
    }
    if (!age.trim() || isNaN(Number(age)) || Number(age) < 0 || Number(age) > 130) {
      e.age = "Age must be a number between 0 and 130.";
    }
    if (!symptomsText.trim()) {
      e.symptoms = "Symptoms are required.";
    } else {
      try {
        const parsed = JSON.parse(symptomsText);
        if (!Array.isArray(parsed)) {
          e.symptoms = "Symptoms must be a JSON array.";
        }
      } catch {
        e.symptoms = "Invalid JSON for symptoms.";
      }
    }

    if (vitalsText.trim()) {
      try {
        JSON.parse(vitalsText);
      } catch {
        e.vitals = "Invalid JSON for vitals.";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(evt: FormEvent) {
    evt.preventDefault();
    setServerError("");

    if (!validate()) return;

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        chiefComplaint: chiefComplaint.trim(),
        age: Number(age),
        symptoms: JSON.parse(symptomsText),
      };

      if (vitalsText.trim()) {
        body.vitals = JSON.parse(vitalsText);
      }

      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data?.error || `Request failed with status ${res.status}`;
        const details = data?.details ? `: ${data.details.join("; ")}` : "";
        setServerError(msg + details);
        return;
      }

      const result = data as TriageResult;

      const entry: QueueEntry = {
        id: crypto.randomUUID(),
        chiefComplaint: chiefComplaint.trim(),
        age: Number(age),
        result,
        createdAt: new Date().toISOString(),
      };

      onResult(entry);

      // Reset form
      setChiefComplaint("");
      setAge("");
      setSymptomsText("");
      setVitalsText("");
      setErrors({});
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const errorClass = "mt-1 text-xs text-red-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Chief Complaint */}
      <div>
        <label
          htmlFor="chiefComplaint"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Chief Complaint
        </label>
        <input
          id="chiefComplaint"
          type="text"
          className={inputClass}
          placeholder="e.g. sharp chest pain, difficulty breathing"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
        />
        {errors.chiefComplaint && (
          <p className={errorClass}>{errors.chiefComplaint}</p>
        )}
      </div>

      {/* Age */}
      <div>
        <label
          htmlFor="age"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Age
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
        {errors.age && <p className={errorClass}>{errors.age}</p>}
      </div>

      {/* Symptoms (JSON array) */}
      <div>
        <label
          htmlFor="symptoms"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Symptoms <span className="text-gray-400">(JSON array)</span>
        </label>
        <textarea
          id="symptoms"
          rows={4}
          className={inputClass}
          placeholder={'[{"description":"sharp chest pain","severity":8,"duration":"2 hours","bodyArea":"chest","associatedSymptoms":["shortness of breath"]}]'}
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
        />
        {errors.symptoms && <p className={errorClass}>{errors.symptoms}</p>}
      </div>

      {/* Vitals (JSON, optional) */}
      <div>
        <label
          htmlFor="vitals"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Vitals{" "}
          <span className="text-gray-400">(JSON, optional)</span>
        </label>
        <textarea
          id="vitals"
          rows={3}
          className={inputClass}
          placeholder='{"heartRate":88,"systolicBP":140,"oxygenSaturation":98}'
          value={vitalsText}
          onChange={(e) => setVitalsText(e.target.value)}
        />
        {errors.vitals && <p className={errorClass}>{errors.vitals}</p>}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
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
            Assessing...
          </span>
        ) : (
          "Run Triage Assessment"
        )}
      </button>
    </form>
  );
}
