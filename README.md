# Astrata Health — AI-Powered Clinical Triage Assistant

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/derrickseagle-dev/AI-Clinical-Triage-Assistant)
[![Tests](https://img.shields.io/badge/tests-117%20passing-brightgreen)](https://github.com/derrickseagle-dev/AI-Clinical-Triage-Assistant)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**Multimodal AI triage that puts patient safety first.** Built by first responders. Designed for clinical teams.

---

## Overview

Astrata Health ingests patient symptoms through **text, voice, images (rashes, wounds, etc.), and device vitals** (wearables, glucometers, BP cuffs) and produces a unified risk assessment in seconds. The engine prioritizes cases by urgency and recommends evidence-based next steps — reducing wait times, preventing missed escalations, and cutting clinician workload.

Most AI triage systems are black boxes. Ours is not. Every risk level is traceable to a specific clinical rule. When the AI layer is active, it operates under a hard constraint: **it can only escalate risk — never downgrade it.** This is the anti-Babylon design.

### Why it matters

- **Multimodal** — competitors (Ada, Buoy, Infermedica, K Health) are text-only. We handle images, voice transcripts, and device vitals alongside symptom text.
- **Safety-first** — deterministic rules engine with an optional LLM layer that cannot override clinical judgment.
- **Enterprise-ready** — white-label infrastructure for telehealth platforms and urgent care networks, not a consumer app.
- **Clinician-in-the-loop** — every recommendation is reviewed by a human. We are CDS, not autonomous triage.

---

## Clinical Safety Philosophy

> *"Take the time to do it right. Prioritize health and safety over every other concern. Patients are the priority regardless of status, wealth, or fame."* — Astrata Health Charter

### Two-layer architecture

```
┌──────────────────────────────────────────────────┐
│                 DETERMINISTIC ENGINE               │
│  ┌────────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │ Emergency  │ │ Pediatric│ │ Mental Health / │ │
│  │ Red Flags  │ │ Red Flags│ │ Overdose / Meds  │ │
│  └────────────┘ └──────────┘ └─────────────────┘ │
│  ┌──────────┐ ┌──────────────┐                    │
│  │  Vitals  │ │Urgency/ Self-│                    │
│  │Assessment│ │  Care Rules  │                    │
│  └──────────┘ └──────────────┘                    │
│                                                    │
│  42+ clinical rules. Every decision is traceable.  │
└───────────────────────┬────────────────────────────┘
                        │  determinisitic result
                        ▼
┌──────────────────────────────────────────────────┐
│            LLM ENHANCEMENT (optional)              │
│                                                    │
│  Claude reviews the case for clinical nuance.      │
│  ⚠ HARD CONSTRAINT: Escalate only. Never downgrade.│
│  Falls back gracefully when no API key is present. │
│  10-second timeout. Defense-in-depth guardrails.   │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
               Clinician Dashboard
```

The deterministic engine always wins. The LLM can add clinical context and flag things the rules missed, but it can never reduce urgency. If the rules say `EMERGENCY`, the LLM cannot return `URGENT`. This is enforced in two places: the prompt-level instruction and a post-response guardrail that rejects downgrades.

---

## Architecture

```
                    PATIENT INTAKE
                   (text · voice · images · vitals)
                          │
                          ▼
              ┌───────────────────────┐
              │   MULTIMODAL API       │
              │  POST /api/intake/*    │
              │  POST /api/triage      │
              └───────────┬────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   TRIAGE ENGINE        │
              │  Deterministic rules   │
              │  7 categories          │
              │  42+ clinical rules    │
              │  4 urgency levels      │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  LLM ENHANCEMENT        │
              │  Anthropic Claude       │
              │  Escalate-only policy   │
              │  Graceful fallback      │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  NEON POSTGRES          │
              │  triage_cases table     │
              │  In-memory fallback     │
              └───────────┬────────────┘
                          │
                          ▼
                CLINICIAN DASHBOARD
              (risk-badged queue, sorted by urgency)
```

---

## Monorepo Structure

```
ai-clinical-triage-assistant/
├── packages/
│   ├── frontend/          # Vite + React 18 + Tailwind CSS v4 + TypeScript
│   │   └── src/
│   │       ├── components/   # Patient intake wizard, clinician dashboard
│   │       └── ...
│   └── backend/           # Express + TypeScript (ES modules)
│       └── src/
│           ├── triage/       # Deterministic triage engine
│           ├── routes/       # API route handlers
│           ├── llm/          # Anthropic Claude client
│           ├── db/           # Neon Postgres schema + connection
│           └── index.ts      # Express server entry point
├── package.json           # Workspace root (npm workspaces)
└── tsconfig.base.json     # Shared TypeScript config
```

---

## Quickstart

```bash
# Clone and install
git clone https://github.com/derrickseagle-dev/AI-Clinical-Triage-Assistant.git
cd AI-Clinical-Triage-Assistant
npm install

# Start both frontend (port 3000) and backend (port 3001)
npm run dev

# Build for production
npm run build

# Run the full test suite (117 tests)
npm test -w packages/backend

# Start production server
npm start
```

---

## API Reference

All endpoints are prefixed with `/api`. The backend runs on port `3001` by default (configurable via `PORT`).

### Health Check

```
GET /api/health
```

**Response** `200 OK`
```json
{ "status": "ok" }
```

---

### Standard Triage

```
POST /api/triage
```

Submit a text-based triage case and receive a risk assessment. Runs the deterministic engine only (no LLM).

**Request Body** (JSON)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chiefComplaint` | string | ✅ | Primary reason for seeking care |
| `age` | number | ✅ | Patient age in years (0–130) |
| `symptoms` | array | ✅ | One or more symptom objects (may be empty) |
| `symptoms[].description` | string | ✅ | Free-text symptom description |
| `symptoms[].severity` | number | ✅ | Pain/severity 1–10 |
| `symptoms[].duration` | string | ✅ | Duration (e.g. "2 hours", "3 days") |
| `symptoms[].bodyArea` | string | ✅ | Body area affected |
| `symptoms[].associatedSymptoms` | string[] | ✅ | Array of associated symptoms (may be empty) |
| `vitals` | object | ❌ | Vital signs (all fields optional) |
| `vitals.heartRate` | number | ❌ | BPM (0–300) |
| `vitals.systolicBP` | number | ❌ | mmHg (0–300) |
| `vitals.diastolicBP` | number | ❌ | mmHg (0–200) |
| `vitals.temperatureF` | number | ❌ | °F (70–115) |
| `vitals.oxygenSaturation` | number | ❌ | % (0–100) |
| `vitals.bloodGlucose` | number | ❌ | mg/dL (0–1000) |

**Response** `200 OK`
```json
{
  "id": "a1b2c3d4-...",
  "createdAt": "2026-07-18T21:00:00.000Z",
  "riskLevel": "URGENT",
  "confidence": 0.85,
  "reasoning": "Patient reports severe pain (severity ≥ 8). ...",
  "recommendedAction": "Seek urgent care within 24 hours...",
  "followUpGuidance": "Schedule a telehealth or in-person visit within 24 hours..."
}
```

---

### LLM-Enhanced Triage

```
POST /api/triage/enhanced
```

Same input format as `POST /api/triage`. Runs the deterministic engine, then (when an Anthropic API key is available) passes the result through Claude for clinical nuance. AI can only escalate or confirm — **never downgrade**.

**Request Body:** Identical to `POST /api/triage`.

**Response** `200 OK`
```json
{
  "id": "a1b2c3d4-...",
  "createdAt": "2026-07-18T21:00:00.000Z",
  "riskLevel": "EMERGENCY",
  "confidence": 0.95,
  "reasoning": "Chest pain may indicate myocardial infarction...",
  "recommendedAction": "Call 911 or go to the nearest emergency room...",
  "followUpGuidance": "Do not delay — seek emergency care now...",
  "aiEnhanced": true
}
```

- `aiEnhanced` is `true` when LLM was used, `false` when it fell back to deterministic-only.
- If no API key is configured, the endpoint returns the deterministic result with `aiEnhanced: false`.

---

### Multimodal Intake: Triage

```
POST /api/intake/triage
```

Full multimodal endpoint. Accepts symptom text, images, voice transcripts, and device vitals in a single `multipart/form-data` request.

**Form Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chiefComplaint` | string | ✅ | Primary reason for seeking care |
| `age` | string | ✅ | Patient age in years |
| `symptoms` | string (JSON) | ✅ | JSON array of symptom objects |
| `vitals` | string (JSON) | ❌ | JSON object of vital signs |
| `audioTranscript` | string | ❌ | Voice-to-text transcription |
| `images` | file[] | ❌ | Up to 10 image files (JPEG, PNG, WebP, max 10 MB each) |

**Response** `200 OK`
```json
{
  "id": "a1b2c3d4-...",
  "createdAt": "2026-07-18T21:00:00.000Z",
  "riskLevel": "ROUTINE",
  "confidence": 0.7,
  "reasoning": "...",
  "recommendedAction": "...",
  "followUpGuidance": "...",
  "images": [
    {
      "filename": "abc123.jpg",
      "originalName": "rash.jpg",
      "size": 245760,
      "mimeType": "image/jpeg",
      "path": "/uploads/abc123.jpg"
    }
  ],
  "audioTranscript": "I've had this rash for three days..."
}
```

---

### Multimodal Intake: Image Upload

```
POST /api/intake/image
```

Upload images for analysis. Accepts JPEG, PNG, and WebP (max 10 MB each, up to 10 files).

**Form Fields**
| Field | Type | Description |
|-------|------|-------------|
| `images` | file[] | Image files |

**Response** `201 Created`
```json
{
  "files": [
    {
      "filename": "abc123.jpg",
      "originalName": "rash.jpg",
      "size": 245760,
      "mimeType": "image/jpeg",
      "path": "/uploads/abc123.jpg"
    }
  ]
}
```

---

### Multimodal Intake: Vitals Validation

```
POST /api/intake/vitals
```

Validate and normalize vital signs from devices or self-report. Returns validated vitals with optional out-of-range warnings.

**Request Body** (JSON)
| Field | Type | Description |
|-------|------|-------------|
| `heartRate` | number | BPM |
| `systolicBP` | number | mmHg |
| `diastolicBP` | number | mmHg |
| `temperatureF` | number | °F |
| `oxygenSaturation` | number | % |
| `bloodGlucose` | number | mg/dL |

All fields are optional — only provided values are validated and returned.

**Response** `200 OK`
```json
{
  "vitals": {
    "heartRate": 88,
    "systolicBP": 132,
    "temperatureF": 98.9,
    "oxygenSaturation": 97
  },
  "warnings": ["heartRate is outside typical range (50–100 bpm)."]
}
```

---

### Triage History

```
GET /api/triage/history
```

Returns the 50 most recent triage cases (requires `DATABASE_URL`; returns empty array with in-memory fallback).

**Response** `200 OK`
```json
[
  {
    "id": "a1b2c3d4-...",
    "chiefComplaint": "sharp chest pain radiating to left arm",
    "age": 52,
    "result": {
      "riskLevel": "EMERGENCY",
      "confidence": 0.95,
      "reasoning": "Chest pain may indicate myocardial infarction...",
      "recommendedAction": "Call 911 or go to the nearest emergency room...",
      "followUpGuidance": "Do not delay — seek emergency care now..."
    },
    "createdAt": "2026-07-18T21:00:00.000Z"
  }
]
```

---

## Triage Engine Details

### Risk Categories

Seven assessment categories run in priority order. Within each tier, the first matching rule wins:

| Priority | Category | Description |
|----------|----------|-------------|
| 1 | **Emergency Red Flags** | Chest pain, difficulty breathing, severe bleeding, stroke, anaphylaxis, sepsis, DVT/PE, ectopic pregnancy, testicular torsion, aortic dissection, meningitis, severe burns, electrical injury, near-drowning |
| 2 | **Pediatric Red Flags** | Infant fever, lethargy, seizures, dehydration, respiratory distress, non-blanching rash, inconsolable crying, floppy tone (age < 18 only) |
| 3 | **Mental Health Crisis** | Suicidal ideation, self-harm, psychosis/hallucinations, severe agitation |
| 3b | **Overdose & Poisoning** | Known/suspected overdose, opioid toxidrome, toxic ingestion, carbon monoxide, alcohol poisoning |
| 3c | **Medication Interactions** | 10 dangerous drug combinations (warfarin+NSAIDs, ACEi+potassium, SSRI+MAOI, opioid+benzo, etc.) + polypharmacy detection |
| 4 | **Vitals Assessment** | O₂ saturation, blood pressure, heart rate, temperature, blood glucose — each with critical/urgent/routine thresholds |
| 5 | **Urgency & Self-Care** | Severe pain (≥8), high fever + confusion, suspected fracture, persistent symptoms >3 days, moderate pain, minor burns |

### Urgency Levels

| Level | Meaning | Response |
|-------|---------|----------|
| `EMERGENCY` | Life-threatening — immediate action required | Call 911. Do not delay. |
| `URGENT` | Requires prompt medical attention | Seek care within 4–24 hours. |
| `ROUTINE` | Needs evaluation but not time-sensitive | Schedule an appointment at your convenience. |
| `SELF_CARE` | Mild and self-limiting | Rest, hydrate, monitor. Seek care if symptoms worsen. |

### Never-Downgrade Principle

The engine flows top-to-bottom through the seven categories. Once a risk level is set — especially `EMERGENCY` — no subsequent rule can lower it. A `ROUTINE` finding from vitals won't override an `EMERGENCY` from red flags. The LLM enhancement layer reinforces this with prompt-level instructions and a post-response guardrail that rejects any downgrade attempt.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vite 5, React 18, Tailwind CSS v4, TypeScript |
| **Backend** | Express 4, TypeScript, ES modules |
| **AI / LLM** | Anthropic Claude (Haiku), `@anthropic-ai/sdk` |
| **Database** | Neon serverless Postgres (`@neondatabase/serverless`) |
| **Image Handling** | Multer (multipart uploads, JPEG/PNG/WebP) |
| **Testing** | Vitest, Supertest (117 tests) |
| **Package Manager** | npm workspaces (monorepo) |

---

## Environment Variables

| Variable | Required | Fallback | Description |
|----------|----------|----------|-------------|
| `DATABASE_URL` | ❌ | In-memory mode | Neon Postgres connection string. Without it, the API returns empty history and doesn't persist cases. |
| `ANTHROPIC_API_KEY` | ❌ | Deterministic-only | Anthropic API key for LLM-enhanced triage. Without it, `/api/triage/enhanced` returns the deterministic result. |
| `PORT` | ❌ | `3001` | Backend server port. |

**File-based fallback for `ANTHROPIC_API_KEY`:** If the environment variable is not set, the LLM client checks for a key file at `packages/backend/.anthropic_key`. This is convenient for local development — just drop your key in that file (it's gitignored).

**File-based fallback for `DATABASE_URL`:** If the environment variable is not set, the DB helper checks for a URL file at `packages/backend/.db_url`.

---

## Testing

```bash
# Run all backend tests
npm test -w packages/backend

# Run a specific test file
npx vitest run src/triage/engine.test.ts
```

### Test coverage (117 tests, all passing)

| Test File | Count | What it covers |
|-----------|-------|----------------|
| `src/triage/engine.test.ts` | 81 | Emergency red flags, pediatric rules, mental health crisis, overdose/poisoning, medication interactions (10 combos + polypharmacy), vitals assessment, urgency patterns, confidence calculation, never-downgrade enforcement |
| `src/routes/intake.test.ts` | 23 | Image upload validation, vitals validation (all fields + warnings), multimodal intake endpoint (validation errors, successful submission, audio transcript, image metadata) |
| `src/routes/triage-enhanced.test.ts` | 13 | LLM fallback behavior, risk-level safety guardrails, AI escalation, validation parity with standard triage |

---

## Deployment

### Backend

```bash
npm run build -w packages/backend
npm start
```

The production server runs on port `3001` (or `PORT` if set). It serves the API only — the frontend is a separate static build.

### Frontend

```bash
npm run build -w packages/frontend
```

Produces static assets in `packages/frontend/dist/`. Serve with any static file server or CDN. In development, `npm run dev` starts both frontend (port 3000) and backend (port 3001) with hot reload.

### Database

Provision a Neon Postgres database and set `DATABASE_URL`. The schema auto-migrates on server start (idempotent `CREATE TABLE IF NOT EXISTS`). The server starts regardless — if the database is unavailable, it runs with in-memory fallback and logs a warning.

---

## Regulatory

- **Phase 1 (non-device CDS):** Text + voice symptom assessment with transparent reasoning qualifies as non-device Clinical Decision Support under the 21st Century Cures Act Section 3060.
- **Phase 2 (potential device):** Image and device-vitals analysis may require FDA 510(k) clearance. Budget accordingly.
- **HIPAA:** Audit logging, encryption at rest and in transit, and a BAA-ready LLM gateway (AWS Bedrock or Anthropic enterprise tier) are required before production deployment with real PHI.
- **Positioning:** This is Clinical Decision Support — not autonomous triage. Clinicians review every recommendation.

---

## License

MIT. See [LICENSE](./LICENSE) for details.

---

## Contact

Astrata Health — Built by first responders, for clinical teams.

For enterprise inquiries, design partnerships, or integration questions, reach out through [our website](https://astrata.health) or open an issue on this repository.

---

*"Patients are the priority regardless of status, wealth, or fame."*
