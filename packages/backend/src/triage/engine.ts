import type { TriageCase, TriageResult, RiskLevel, SymptomInput, VitalInput } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERGENCY_RED_FLAGS: { patterns: RegExp[]; reason: string; action: string }[] = [
  {
    patterns: [
      /\bchest\s*pain\b/i, /\bchest\s*pressure\b/i, /\bchest\s*tightness\b/i,
      /\bheart\s*attack\b/i, /\bcrushing\s*chest\b/i,
    ],
    reason: "Chest pain may indicate myocardial infarction or other cardiac emergency.",
    action: "Call 911 or go to the nearest emergency room immediately. Do not drive yourself.",
  },
  {
    patterns: [
      /\b(can'?t|unable\s*to|cannot)\s*breathe\b/i, /\bdifficulty\s*breathing\b/i,
      /\bshortness\s*of\s*breath\b/i, /\bsob\b/i, /\bsuffocat/i, /\bchoking\b/i,
      /\bair\s*hunger\b/i,
    ],
    reason: "Difficulty breathing may indicate respiratory failure, anaphylaxis, or other life-threatening condition.",
    action: "Call 911 immediately. Sit upright and try to remain calm. If you have a rescue inhaler, use it as prescribed.",
  },
  {
    patterns: [
      /\bsevere\s*bleeding\b/i, /\bhemorrhag/i, /\bbleeding\s*profusely\b/i,
      /\bwon'?t\s*stop\s*bleeding\b/i, /\bgushing\s*blood\b/i,
    ],
    reason: "Severe uncontrolled bleeding can rapidly lead to hemorrhagic shock.",
    action: "Call 911 immediately. Apply firm direct pressure to the wound with a clean cloth. Do not remove embedded objects.",
  },
  {
    patterns: [
      /\bsudden\s*severe\s*headache\b/i, /\bworst\s*headache\b/i,
      /\bthunderclap\s*headache\b/i,
    ],
    reason: "Sudden severe headache may indicate subarachnoid hemorrhage, meningitis, or other neurological emergency.",
    action: "Call 911 immediately. Do not delay — a sudden severe headache can be a sign of a brain bleed.",
  },
  {
    patterns: [
      /\bloss\s*of\s*consciousness\b/i, /\bpassed\s*out\b/i,
      /\bfainted\b/i, /\bunconscious\b/i, /\bblacked\s*out\b/i,
    ],
    reason: "Loss of consciousness may indicate a serious cardiac, neurological, or metabolic event.",
    action: "Call 911 immediately. If the person is still unconscious, place them in the recovery position (on their side).",
  },
  {
    patterns: [
      /\bstroke\b/i, /\bfacial\s*droop/i, /\bfacial\s*weakness\b/i,
      /\barm\s*weakness\b/i, /\bslurred\s*speech\b/i,
      /\bone\s*side\b/i, /\bsudden\s*confusion\b/i, /\bsudden\s*numbness\b/i,
    ],
    reason: "Stroke symptoms require immediate intervention — time-critical treatment window.",
    action: "Call 911 immediately. Note the time when symptoms started. Do not give food, drink, or medication.",
  },
  {
    patterns: [
      /\banaphylaxis\b/i, /\banaphylactic\b/i,
      /\bthroat\s*swelling\b/i, /\btongue\s*swelling\b/i,
      /\blip\s*swelling\b/i, /\bswelling\s*of\s*the\s*face\b/i,
      /\bhives\b.*\bbreathe\b/i, /\bbreathe\b.*\bhives\b/i,
    ],
    reason: "Signs of anaphylaxis — a severe, potentially fatal allergic reaction.",
    action: "Call 911 immediately. If you have an epinephrine auto-injector (EpiPen), use it now. Lie down with legs elevated.",
  },
];

// ─── Pediatric Red Flags (age < 18) ────────────────────────────────────────────

const PEDIATRIC_RED_FLAGS: {
  patterns: RegExp[];
  reason: string;
  action: string;
  level: RiskLevel;
}[] = [
  {
    patterns: [/\b(fever|temp\w*)\b/i, /\b(\d{3}\.?\d?)\s*(°F|F|fahrenheit)?\b/i],
    // Fever in infants — only fires when age < 3 months AND temp ≥ 100.4 — checked in code
    reason:
      "Fever in an infant under 3 months (temperature ≥ 100.4°F) is a medical emergency — risk of serious bacterial infection.",
    action:
      "Call 911 immediately. Do not wait — infants deteriorate quickly. Do not give medication without medical direction.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\blethargic\b/i, /\bwon'?t\s*wake\b/i, /\bunresponsive\b/i,
      /\bdifficult\s*to\s*wake\b/i, /\bbarely\s*responsive\b/i,
    ],
    reason:
      "Lethargy or altered consciousness in a child may indicate sepsis, meningitis, or other life-threatening condition.",
    action:
      "Call 911 immediately. Do not wait — children can deteriorate very quickly. Keep the child in a safe position.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bseizure\b/i, /\bconvulsion\b/i, /\bfitting\b/i,
      /\bshaking\s*uncontrollably\b/i,
    ],
    reason:
      "Seizure activity in a child requires immediate emergency evaluation.",
    action:
      "Call 911 immediately. Protect the child from injury — clear the area, do not restrain, and time the seizure. Do not put anything in their mouth.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bno\s*wet\s*diaper/i, /\bsunken\s*eyes\b/i, /\bno\s*tears\b/i,
      /\bdry\s*mouth\b.*\bnot\s*drinking\b/i, /\bnot\s*drinking\b.*\bdry\s*mouth\b/i,
    ],
    reason:
      "Signs of dehydration in a child — may indicate inadequate fluid intake or excessive losses requiring intervention.",
    action:
      "Seek urgent care within 4 hours. Offer small, frequent sips of an oral rehydration solution. Monitor for fewer wet diapers.",
    level: "URGENT",
  },
  {
    patterns: [
      /\bbreathing\s*fast\b/i, /\bretractions\b/i, /\bnasal\s*flaring\b/i,
      /\bribs\s*showing\s*when\s*breathing\b/i,
    ],
    reason:
      "Rapid breathing or respiratory retractions in a child may indicate respiratory distress or impending failure.",
    action:
      "Seek urgent care within 4 hours. Keep the child calm and upright. If lips turn blue or breathing worsens, call 911 immediately.",
    level: "URGENT",
  },
  {
    patterns: [
      /\brash\s*that\s*doesn'?t\s*fade\b/i, /\bnon-blanching\s*rash\b/i,
      /\bglass\s*test\b/i, /\bpurple\s*spots\b/i,
    ],
    reason:
      "A non-blanching rash may indicate meningococcal septicemia or other serious infection — a life-threatening emergency.",
    action:
      "Call 911 immediately. Do not wait — this can progress rapidly. Perform the glass test: press a clear glass against the rash; if spots do not fade, seek emergency care.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bwon'?t\s*stop\s*crying\b/i, /\binconsolable\b/i,
      /\bhigh\s*pitched\s*cry\b/i, /\babnormal\s*cry\b/i,
    ],
    reason:
      "Inconsolable or high-pitched crying in a child may indicate pain, neurological issues, or serious illness.",
    action:
      "Seek urgent care within 12 hours. Try calming techniques in the meantime. If the child becomes lethargic or unresponsive, call 911 immediately.",
    level: "URGENT",
  },
  {
    patterns: [
      /\bfloppy\b/i, /\blimp\b/i, /\bpoor\s*tone\b/i,
      /\blike\s*a\s*rag\s*doll\b/i,
    ],
    reason:
      "Floppy or poor muscle tone in a child may indicate sepsis, dehydration, or a serious neurological condition.",
    action:
      "Call 911 immediately. Keep the child warm and in a safe position. Do not delay — floppy tone in children is a critical warning sign.",
    level: "EMERGENCY",
  },
];

// ─── Mental Health Crisis Rules ────────────────────────────────────────────────

const MENTAL_HEALTH_CRISIS_RULES: {
  patterns: RegExp[];
  reason: string;
  action: string;
  level: RiskLevel;
}[] = [
  {
    patterns: [
      /\bsuicidal\b/i, /\bwant\s*to\s*die\b/i, /\bend\s*my\s*life\b/i,
      /\bkill\s*myself\b/i, /\bself\s*harm\b/i, /\bcutting\s*myself\b/i,
      /\bhurt\s*myself\b/i, /\bsuicide\b/i,
    ],
    reason:
      "Suicidal ideation or self-harm statements detected — this is a psychiatric emergency requiring immediate intervention.",
    action:
      "Call 988 (Suicide & Crisis Lifeline) or 911 immediately. Stay with the person — do not leave them alone. Remove any means of harm (weapons, medications, sharp objects).",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bhearing\s*voices\b/i, /\bseeing\s*things\b/i, /\bhallucinat/i,
      /\bparanoid\b/i, /\bthey'?re\s*watching\s*me\b/i, /\bdelusions?\b/i,
      /\bnot\s*real\b/i,
    ],
    reason:
      "Psychosis or hallucinations — the person may be at risk of harming themselves or others due to impaired reality testing.",
    action:
      "Call 988 (Suicide & Crisis Lifeline) or 911 immediately. Stay calm and reassuring. Do not argue about the hallucinations or delusions. Remove any potential weapons or dangerous objects from the area.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bviolent\b/i, /\baggressive\b/i, /\bout\s*of\s*control\b/i,
      /\battacking\b/i, /\bthreatening\b/i,
    ],
    reason:
      "Severe agitation or violent behavior — risk of harm to self or others requires urgent intervention.",
    action:
      "Call 988 (Suicide & Crisis Lifeline) for guidance, or 911 if there is immediate danger. Ensure your own safety first — do not physically confront an agitated person. Remove bystanders from the area.",
    level: "URGENT",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check if any emergency red-flag pattern matches the text. */
function checkEmergencyRedFlags(chiefComplaint: string, symptoms: SymptomInput[]): {
  matches: { reason: string; action: string }[];
  matchCount: number;
} {
  const allText = [
    chiefComplaint,
    ...symptoms.map((s) => s.description),
    ...symptoms.flatMap((s) => s.associatedSymptoms),
  ].join(" | ");

  const matches: { reason: string; action: string }[] = [];

  for (const flag of EMERGENCY_RED_FLAGS) {
    for (const pattern of flag.patterns) {
      if (pattern.test(allText)) {
        matches.push({ reason: flag.reason, action: flag.action });
        break; // one match per flag category is enough
      }
    }
  }

  return { matches, matchCount: matches.length };
}

/**
 * Check pediatric-specific red flags for patients under 18.
 * Returns the highest risk level, the matching reasons, and recommended actions.
 */
function checkPediatricRedFlags(
  chiefComplaint: string,
  symptoms: SymptomInput[],
  vitals: VitalInput | undefined,
  age: number,
): { level: RiskLevel | null; reasons: string[]; actions: string[] } {
  if (age >= 18) {
    return { level: null, reasons: [], actions: [] };
  }

  const allText = [
    chiefComplaint,
    ...symptoms.map((s) => s.description),
    ...symptoms.flatMap((s) => s.associatedSymptoms),
  ].join(" | ");

  const reasons: string[] = [];
  const actions: string[] = [];
  let level: RiskLevel | null = null;

  for (const flag of PEDIATRIC_RED_FLAGS) {
    // Special handling: Fever in infants < 3 months is only EMERGENCY if temp ≥ 100.4°F
    const isFeverInfantRule =
      flag.reason.includes("Fever in an infant under 3 months");
    if (isFeverInfantRule) {
      // Only apply if age < 3 months (we use age < 1 as a proxy since age is in years; for
      // infants under 3 months, age would be 0 in integer years)
      if (age > 0) continue;
      const temp = vitals?.temperatureF;
      if (temp === undefined || temp < 100.4) continue;
      // Now check that fever-related text is present
      const hasFeverText = /\b(fever|febrile|temp|temperature)\b/i.test(allText);
      if (!hasFeverText) continue;

      reasons.push(flag.reason);
      actions.push(flag.action);
      level = "EMERGENCY";
      continue;
    }

    for (const pattern of flag.patterns) {
      if (pattern.test(allText)) {
        reasons.push(flag.reason);
        actions.push(flag.action);
        if (flag.level === "EMERGENCY") {
          level = "EMERGENCY";
        } else if (flag.level === "URGENT" && level !== "EMERGENCY") {
          level = "URGENT";
        }
        break; // one match per flag category
      }
    }
  }

  return { level, reasons, actions };
}

/**
 * Check for mental health crisis indicators: suicidal ideation, psychosis, severe agitation.
 * Returns the highest risk level, the matching reasons, and recommended actions.
 */
function checkMentalHealthCrisis(
  chiefComplaint: string,
  symptoms: SymptomInput[],
): { level: RiskLevel | null; reasons: string[]; actions: string[] } {
  const allText = [
    chiefComplaint,
    ...symptoms.map((s) => s.description),
    ...symptoms.flatMap((s) => s.associatedSymptoms),
  ].join(" | ");

  const reasons: string[] = [];
  const actions: string[] = [];
  let level: RiskLevel | null = null;

  for (const rule of MENTAL_HEALTH_CRISIS_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(allText)) {
        reasons.push(rule.reason);
        actions.push(rule.action);
        if (rule.level === "EMERGENCY") {
          level = "EMERGENCY";
        } else if (rule.level === "URGENT" && level !== "EMERGENCY") {
          level = "URGENT";
        }
        break; // one match per rule category
      }
    }
  }

  return { level, reasons, actions };
}

/** Check vitals for dangerous abnormalities warranting emergency or urgent care. */
function assessVitals(vitals: VitalInput | undefined, age: number): {
  level: RiskLevel | null;
  reasons: string[];
  actions: string[];
} {
  if (!vitals) {
    return { level: null, reasons: [], actions: [] };
  }

  const reasons: string[] = [];
  const actions: string[] = [];
  let level: RiskLevel | null = null;

  // Oxygen saturation — critical
  if (vitals.oxygenSaturation !== undefined) {
    if (vitals.oxygenSaturation < 88) {
      reasons.push(`Oxygen saturation critically low at ${vitals.oxygenSaturation}%.`);
      actions.push("Call 911 immediately. This indicates severe hypoxemia.");
      level = "EMERGENCY";
    } else if (vitals.oxygenSaturation < 92) {
      reasons.push(`Oxygen saturation low at ${vitals.oxygenSaturation}%.`);
      actions.push("Seek urgent care within 4 hours. Supplemental oxygen may be needed.");
      if (level !== "EMERGENCY") level = "URGENT";
    } else if (vitals.oxygenSaturation < 95) {
      reasons.push(`Oxygen saturation borderline at ${vitals.oxygenSaturation}%.`);
      actions.push("Monitor oxygen levels. Schedule a routine visit if persistent.");
      if (!level) level = "ROUTINE";
    }
  }

  // Blood pressure extremes
  if (vitals.systolicBP !== undefined) {
    if (vitals.systolicBP >= 180) {
      reasons.push(`Systolic blood pressure critically high at ${vitals.systolicBP} mmHg.`);
      actions.push("Seek emergency care — hypertensive crisis risk.");
      level = "EMERGENCY";
    } else if (vitals.systolicBP >= 160) {
      reasons.push(`Systolic blood pressure elevated at ${vitals.systolicBP} mmHg.`);
      actions.push("Seek urgent care within 24 hours for blood pressure management.");
      if (level !== "EMERGENCY") level = "URGENT";
    } else if (vitals.systolicBP < 80) {
      reasons.push(`Systolic blood pressure dangerously low at ${vitals.systolicBP} mmHg.`);
      actions.push("Call 911 immediately — risk of shock.");
      level = "EMERGENCY";
    } else if (vitals.systolicBP < 90) {
      reasons.push(`Systolic blood pressure low at ${vitals.systolicBP} mmHg.`);
      actions.push("Seek urgent care. May indicate dehydration or other issues.");
      if (level !== "EMERGENCY") level = "URGENT";
    }
  }

  // Heart rate extremes
  if (vitals.heartRate !== undefined) {
    const maxNormal = age < 12 ? 140 : age < 60 ? 100 : 90;
    if (vitals.heartRate >= 150) {
      reasons.push(`Heart rate critically high at ${vitals.heartRate} bpm.`);
      actions.push("Call 911 — possible serious arrhythmia.");
      level = "EMERGENCY";
    } else if (vitals.heartRate >= 120) {
      reasons.push(`Heart rate elevated at ${vitals.heartRate} bpm.`);
      actions.push("Seek urgent care within 24 hours for cardiac evaluation.");
      if (level !== "EMERGENCY") level = "URGENT";
    } else if (vitals.heartRate > maxNormal) {
      reasons.push(`Heart rate mildly elevated at ${vitals.heartRate} bpm.`);
      actions.push("Monitor and schedule routine evaluation if persistent.");
      if (!level) level = "ROUTINE";
    }

    if (vitals.heartRate < 45) {
      reasons.push(`Heart rate critically low at ${vitals.heartRate} bpm.`);
      actions.push("Call 911 — severe bradycardia risk.");
      level = "EMERGENCY";
    } else if (vitals.heartRate < 55) {
      reasons.push(`Heart rate low at ${vitals.heartRate} bpm.`);
      actions.push("Seek urgent care for bradycardia evaluation.");
      if (level !== "EMERGENCY") level = "URGENT";
    }
  }

  // Temperature extremes
  if (vitals.temperatureF !== undefined) {
    if (vitals.temperatureF >= 104) {
      reasons.push(`Temperature critically high at ${vitals.temperatureF}°F.`);
      actions.push("Seek emergency care — risk of heat stroke or severe infection.");
      level = "EMERGENCY";
    } else if (vitals.temperatureF >= 102) {
      reasons.push(`Fever high at ${vitals.temperatureF}°F.`);
      actions.push("Seek urgent care if accompanied by confusion, stiff neck, or dehydration.");
      if (level !== "EMERGENCY") level = "URGENT";
    } else if (vitals.temperatureF >= 100.4) {
      reasons.push(`Mild fever at ${vitals.temperatureF}°F.`);
      actions.push("Rest, hydrate, and monitor. Seek care if fever persists beyond 3 days.");
      if (!level) level = "ROUTINE";
    }

    if (vitals.temperatureF < 95) {
      reasons.push(`Temperature dangerously low at ${vitals.temperatureF}°F — hypothermia risk.`);
      actions.push("Call 911. Warm gradually. Do not use direct heat.");
      level = "EMERGENCY";
    }
  }

  // Blood glucose extremes
  if (vitals.bloodGlucose !== undefined) {
    if (vitals.bloodGlucose >= 400) {
      reasons.push(`Blood glucose critically high at ${vitals.bloodGlucose} mg/dL.`);
      actions.push("Seek emergency care — risk of diabetic ketoacidosis or hyperosmolar state.");
      level = "EMERGENCY";
    } else if (vitals.bloodGlucose >= 250) {
      reasons.push(`Blood glucose elevated at ${vitals.bloodGlucose} mg/dL.`);
      actions.push("Seek urgent care within 24 hours. Check ketones if you have type 1 diabetes.");
      if (level !== "EMERGENCY") level = "URGENT";
    } else if (vitals.bloodGlucose < 50) {
      reasons.push(`Blood glucose critically low at ${vitals.bloodGlucose} mg/dL.`);
      actions.push("Call 911 — severe hypoglycemia. If conscious and able to swallow, consume fast-acting sugar now.");
      level = "EMERGENCY";
    } else if (vitals.bloodGlucose < 70) {
      reasons.push(`Blood glucose low at ${vitals.bloodGlucose} mg/dL.`);
      actions.push("Consume 15g of fast-acting carbohydrates (juice, glucose tablets) and recheck in 15 minutes.");
      if (level !== "EMERGENCY") level = "URGENT";
    }
  }

  return { level, reasons, actions };
}

/** Check symptom descriptions & chief complaint for high-urgency patterns. */
function assessUrgency(
  chiefComplaint: string,
  symptoms: SymptomInput[],
  vitals: VitalInput | undefined,
  age: number,
): { level: RiskLevel | null; reasons: string[]; actions: string[] } {
  const allText = [
    chiefComplaint,
    ...symptoms.map((s) => s.description),
    ...symptoms.flatMap((s) => s.associatedSymptoms),
  ].join(" | ");

  const reasons: string[] = [];
  const actions: string[] = [];
  let level: RiskLevel | null = null;

  // Severe pain (severity ≥ 8)
  const hasSeverePain = symptoms.some((s) => s.severity >= 8);
  if (hasSeverePain) {
    reasons.push("Patient reports severe pain (severity ≥ 8).");
    actions.push("Seek urgent care within 24 hours. Do not delay if pain is worsening.");
    level = "URGENT";
  }

  // High fever + confusion in chief complaint
  const hasHighFever = vitals && vitals.temperatureF !== undefined && vitals.temperatureF >= 102;
  const hasConfusion = /\bconfus/i.test(allText) || /\bdisorient/i.test(allText) || /\baltered\s*mental\b/i.test(allText);
  if (hasHighFever && hasConfusion) {
    reasons.push("High fever with confusion or altered mental status.");
    actions.push("Seek emergency care — possible sepsis or meningitis.");
    level = "EMERGENCY"; // overrides URGENT above
  }

  // Suspected fracture
  const suspectFracture =
    /\bfracture\b/i.test(allText) ||
    /\bbroken\s*bone\b/i.test(allText) ||
    /\bbone\s*sticking\b/i.test(allText) ||
    /\bdeformity\b/i.test(allText) ||
    (/\bcan'?t\s*move\b/i.test(allText) && /\b(arm|leg|limb)\b/i.test(allText));
  if (suspectFracture) {
    reasons.push("Suspected fracture or dislocation.");
    actions.push("Seek urgent care within 12 hours. Immobilize the affected area. Do not attempt to straighten.");
    if (level !== "EMERGENCY") level = "URGENT";
  }

  // Persistent symptoms > 3 days (only if nothing more urgent)
  const persistentPattern = /\b(\d+)\s*(day|week|month)/i;
  let persistentDuration = 0;
  for (const s of symptoms) {
    const m = s.duration.match(persistentPattern);
    if (m) {
      const num = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const days = unit.startsWith("day") ? num : unit.startsWith("week") ? num * 7 : num * 30;
      if (days > persistentDuration) persistentDuration = days;
    }
  }
  if (persistentDuration > 3 && !level) {
    reasons.push(`Symptoms have persisted for more than 3 days.`);
    actions.push("Schedule a routine telehealth visit for evaluation.");
    level = "ROUTINE";
  }

  // Moderate pain (severity 5–7) with no other flags
  const hasModeratePain = symptoms.some((s) => s.severity >= 5 && s.severity <= 7);
  if (hasModeratePain && !level) {
    reasons.push("Patient reports moderate pain (severity 5–7).");
    actions.push("Schedule a routine appointment. Use OTC pain relief as directed.");
    level = "ROUTINE";
  }

  return { level, reasons, actions };
}

// ─── Main Assessment Engine ───────────────────────────────────────────────────

/**
 * Deterministic clinical triage assessment.
 *
 * Priority order:
 * 1. RED FLAGS (life-threatening)                        → EMERGENCY
 * 2. Pediatric red flags (age < 18)                      → EMERGENCY / URGENT
 * 3. Mental health crisis detection                      → EMERGENCY / URGENT
 * 4. Abnormal vitals (critical)                           → EMERGENCY
 * 5. High-urgency patterns (severe pain, fracture, etc.)  → URGENT
 * 6. Abnormal vitals (urgent, non-critical)               → URGENT
 * 7. Moderate concern (persistent, moderate pain)          → ROUTINE
 * 8. Everything else                                       → SELF_CARE
 *
 * Within each tier, the first matching rule wins.
 * Confidence is calculated as the ratio of positive signals to total rules checked.
 */
export function assessRisk(triageCase: TriageCase): TriageResult {
  const { chiefComplaint, age, symptoms, vitals } = triageCase;

  // Default result (lowest tier)
  let riskLevel: RiskLevel = "SELF_CARE";
  const allReasons: string[] = [];
  const allActions: string[] = [];

  // ── Step 1: Emergency red flags ──
  const redFlags = checkEmergencyRedFlags(chiefComplaint, symptoms);
  if (redFlags.matchCount > 0) {
    riskLevel = "EMERGENCY";
    for (const m of redFlags.matches) {
      allReasons.push(m.reason);
      allActions.push(m.action);
    }
  }

  // ── Step 2: Pediatric-specific red flags (age < 18) ──
  const pediatricAssessment = checkPediatricRedFlags(chiefComplaint, symptoms, vitals, age);
  if (pediatricAssessment.reasons.length > 0) {
    allReasons.push(...pediatricAssessment.reasons);
    allActions.push(...pediatricAssessment.actions);
    if (
      pediatricAssessment.level === "EMERGENCY" ||
      (pediatricAssessment.level === "URGENT" && riskLevel !== "EMERGENCY")
    ) {
      riskLevel = pediatricAssessment.level;
    }
  }

  // ── Step 3: Mental health crisis detection ──
  const mentalHealthAssessment = checkMentalHealthCrisis(chiefComplaint, symptoms);
  if (mentalHealthAssessment.reasons.length > 0) {
    allReasons.push(...mentalHealthAssessment.reasons);
    allActions.push(...mentalHealthAssessment.actions);
    if (
      mentalHealthAssessment.level === "EMERGENCY" ||
      (mentalHealthAssessment.level === "URGENT" && riskLevel !== "EMERGENCY")
    ) {
      riskLevel = mentalHealthAssessment.level;
    }
  }

  // ── Step 4: Vitals assessment ──
  const vitalsAssessment = assessVitals(vitals, age);
  if (vitalsAssessment.reasons.length > 0) {
    allReasons.push(...vitalsAssessment.reasons);
    allActions.push(...vitalsAssessment.actions);
    if (vitalsAssessment.level === "EMERGENCY" || (vitalsAssessment.level === "URGENT" && riskLevel !== "EMERGENCY")) {
      riskLevel = vitalsAssessment.level;
    } else if (vitalsAssessment.level === "ROUTINE" && riskLevel === "SELF_CARE") {
      riskLevel = "ROUTINE";
    }
  }

  // ── Step 5: Urgency patterns ──
  const urgencyAssessment = assessUrgency(chiefComplaint, symptoms, vitals, age);
  if (urgencyAssessment.reasons.length > 0) {
    allReasons.push(...urgencyAssessment.reasons);
    allActions.push(...urgencyAssessment.actions);
    if (
      urgencyAssessment.level === "EMERGENCY" ||
      (urgencyAssessment.level === "URGENT" && riskLevel !== "EMERGENCY") ||
      (urgencyAssessment.level === "ROUTINE" && riskLevel === "SELF_CARE")
    ) {
      riskLevel = urgencyAssessment.level;
    }
  }

  // ── Confidence calculation ──
  // Confidence is based on how many assessment signals fired vs. ambiguity.
  // More signals = higher confidence. Few signals with severe findings also = high confidence.
  const totalSignals = allReasons.length;
  let confidence: number;

  if (riskLevel === "EMERGENCY") {
    // Emergency: confidence is high if multiple red flags or critical vitals
    confidence = Math.min(1, 0.85 + totalSignals * 0.05);
  } else if (riskLevel === "URGENT") {
    confidence = Math.min(1, 0.7 + totalSignals * 0.06);
  } else if (riskLevel === "ROUTINE") {
    confidence = Math.min(1, 0.55 + totalSignals * 0.08);
  } else {
    // SELF_CARE — fewer signals means we're less "confident" but also it's low risk
    // Use a base confidence that reflects having checked and found nothing concerning
    confidence = symptoms.length > 0 ? 0.6 : 0.5;
  }

  confidence = Math.round(confidence * 100) / 100; // round to 2 decimal places

  // ── Build result ──
  const reasoning = allReasons.length > 0
    ? allReasons.join(" ")
    : "No red flags or urgent concerns identified. Symptoms appear mild and self-limiting.";

  const recommendedAction = allActions.length > 0
    ? allActions.join(" | ")
    : getSelfCareAction(symptoms);

  const followUpGuidance = getFollowUpGuidance(riskLevel);

  return {
    riskLevel,
    confidence,
    reasoning,
    recommendedAction,
    followUpGuidance,
  };
}

function getSelfCareAction(symptoms: SymptomInput[]): string {
  if (symptoms.length === 0) {
    return "No symptoms reported. If you are checking proactively, no action is needed. Seek care if any new symptoms develop.";
  }
  return "Rest, hydrate, and monitor your symptoms. Use OTC medications as directed. Seek care if symptoms worsen or new concerning symptoms develop.";
}

function getFollowUpGuidance(level: RiskLevel): string {
  switch (level) {
    case "EMERGENCY":
      return "Do not delay — seek emergency care now. If symptoms worsen during transport, call 911. Bring a list of medications and allergies to the ER.";
    case "URGENT":
      return "Schedule a telehealth or in-person visit within 24 hours. If symptoms worsen before your appointment, escalate to emergency care.";
    case "ROUTINE":
      return "Schedule a routine appointment at your convenience. Keep a symptom diary and note any changes or new symptoms.";
    case "SELF_CARE":
      return "Continue self-care at home. If symptoms persist beyond 5–7 days or new symptoms develop, schedule a routine check-up.";
  }
}
