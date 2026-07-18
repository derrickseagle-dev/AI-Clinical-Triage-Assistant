# AI Clinical Triage Assistant

AI-powered multimodal clinical triage platform by **Astrata Health**.

## Overview

The AI Clinical Triage Assistant ingests patient symptoms via text, voice, images (rashes, wounds, etc.), and device vitals (wearables, glucometers, BP cuffs) into a unified risk assessment engine. It prioritizes cases by urgency and recommends evidence-based next steps — reducing wait times, preventing missed escalations, and cutting clinician workload.

Built with healthcare governance (HIPAA, SOC 2) and ROI reporting as first-class features.

## Monorepo Structure

```
packages/
├── frontend/   — Vite + React + TypeScript (clinician dashboard & patient intake)
└── backend/    — Node.js + Express + TypeScript (API, triage engine)
```

## Getting Started

```bash
npm install
npm run dev     # starts both frontend and backend
npm run build   # builds both packages
```

## API

- `GET /api/health` — health check endpoint
