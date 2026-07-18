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
  {
    patterns: [
      /(?=.*\bfever\b)(?=.*\bconfus)(?=.*\b(shak|rigor))/i,
      /\bpossible\s*sepsis\b/i, /\bseptic\b/i, /\brigors\b/i,
      /\bsepsis\b/i,
    ],
    reason: "Possible sepsis — a life-threatening systemic infection requiring immediate treatment.",
    action: "Call 911 immediately. Sepsis is a medical emergency that worsens rapidly. Note the time symptoms started.",
  },
  {
    patterns: [
      /(?=.*\bswollen\s*leg\b)(?=.*\bpain\b)(?=.*\bshortness\s*of\s*breath\b)/i,
      /\bdeep\s*vein\s*thrombosis\b/i, /\bpulmonary\s*embolism\b/i,
      /\bblood\s*clot\b/i,
    ],
    reason: "Possible deep vein thrombosis or pulmonary embolism — a life-threatening condition.",
    action: "Call 911 immediately. Do not massage the affected leg. Keep the leg elevated if possible.",
  },
  {
    patterns: [
      /\bectopic\b/i,
      /(?=.*\bsharp\s*abdominal\s*pain\b)(?=.*\bvaginal\s*bleeding\b)/i,
    ],
    reason: "Possible ectopic pregnancy — a life-threatening condition requiring emergency surgery.",
    action: "Call 911 immediately. Ectopic pregnancy can cause life-threatening internal bleeding.",
  },
  {
    patterns: [
      /\btesticular\s*pain\b/i, /\btesticle\s*pain\b/i,
      /\bswollen\s*testicle\b/i, /\btorsion\b/i,
    ],
    reason: "Possible testicular torsion — a time-sensitive surgical emergency.",
    action: "Call 911 or go to the nearest emergency room immediately. Testicular torsion requires surgery within hours to save the testicle.",
  },
  {
    patterns: [
      /(?=.*\b(tearing|ripping)\s*pain\b)(?=.*\b(chest|back)\b)/i,
      /\baortic\s*dissection\b/i,
    ],
    reason: "Possible aortic dissection — a life-threatening tear in the aorta requiring emergency surgery.",
    action: "Call 911 immediately. Aortic dissection is a surgical emergency. Keep the patient calm and still.",
  },
  {
    patterns: [
      /(?=.*\bstiff\s*neck\b)(?=.*\bfever\b)(?=.*\bheadache\b)/i,
      /\bmeningitis\b/i,
      /(?=.*\bcan'?t\s*touch\s*chin\s*to\s*chest\b)(?=.*\bfever\b)/i,
    ],
    reason: "Possible meningitis — a life-threatening infection of the brain and spinal cord.",
    action: "Call 911 immediately. Meningitis can progress rapidly. Note if the patient has difficulty with bright lights.",
  },
  {
    patterns: [
      /\bsevere\s*burn\b/i, /\bthird\s*degree\b/i,
      /\bburned\s*face\b/i, /\bburn\s*on\s*hands\b/i,
      /\blarge\s*burn\b/i, /\belectrical\s*burn\b/i,
    ],
    reason: "Severe burn requiring emergency evaluation and treatment.",
    action: "Call 911 immediately. Cool the burn with cool (not cold) running water for at least 20 minutes. Do not apply ice, butter, or ointments. Cover loosely with a clean, dry cloth.",
  },
  {
    patterns: [
      /\belectrocuted\b/i, /\belectric\s*shock\b/i,
      /\blightning\s*strike\b/i, /\bstruck\s*by\s*lightning\b/i,
    ],
    reason: "Electrical injury or lightning strike — risk of cardiac arrhythmia, burns, and internal damage.",
    action: "Call 911 immediately. Do not touch the person if they are still in contact with the electrical source. Turn off the power source if safe to do so.",
  },
  {
    patterns: [
      /\bdrowning\b/i, /\bnearly\s*drowned\b/i,
      /\binhaled\s*water\b/i, /\bsubmerged\b/i,
    ],
    reason: "Near-drowning incident — risk of secondary drowning and respiratory failure.",
    action: "Call 911 immediately. Even if the person seems recovered, delayed complications can be fatal. Keep the person warm and monitor breathing.",
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

// ─── Medication Interaction Rules ────────────────────────────────────────────

const MEDICATION_INTERACTION_RULES: {
  patterns: RegExp[];
  reason: string;
  action: string;
  level: RiskLevel;
}[] = [
  // Warfarin/Coumadin + Aspirin/NSAIDs → EMERGENCY (bleeding risk)
  {
    patterns: [
      /(?=.*\b(warfarin|coumadin|jantoven)\b)(?=.*\b(aspirin|nsaid|ibuprofen|naproxen|diclofenac|meloxicam|celecoxib|indomethacin|ketorolac|advil|motrin|aleve)\b)/i,
    ],
    reason:
      "Dangerous combination: Warfarin (Coumadin) with aspirin/NSAID — high risk of severe bleeding including GI hemorrhage and intracranial bleeding.",
    action:
      "Seek emergency care immediately. Do not take additional doses of either medication. This combination significantly increases bleeding risk. Call 911 if any signs of bleeding: blood in stool, vomiting blood, severe headache, unusual bruising.",
    level: "EMERGENCY",
  },
  // ACE inhibitors + Potassium supplements/spironolactone → URGENT (hyperkalemia)
  {
    patterns: [
      new RegExp(
        "(?=.*\\b(lisinopril|enalapril|ramipril|captopril|benazepril|quinapril|fosinopril|moexipril|perindopril|trandolapril|ace\\s*inhibitor|zestril|vasotec|altace|accupril|monopril|univasc)\\b)" +
        "(?=.*\\b(potassium|klor-con|k-dur|kalydeco|spironolactone|aldactone)\\b)",
        "i",
      ),
    ],
    reason:
      "Dangerous combination: ACE inhibitor with potassium supplements or spironolactone — risk of life-threatening hyperkalemia (dangerously high potassium).",
    action:
      "Seek urgent care within 24 hours. Request an electrolyte panel and ECG. Do not take additional potassium supplements. Watch for muscle weakness, palpitations, or numbness/tingling.",
    level: "URGENT",
  },
  // SSRIs + MAOIs → EMERGENCY (serotonin syndrome)
  {
    patterns: [
      /(?=.*\b(fluoxetine|sertraline|paroxetine|citalopram|escitalopram|fluvoxamine|ssri|prozac|zoloft|paxil|celexa|lexapro|luvox)\b)(?=.*\b(phenelzine|tranylcypromine|isocarboxazid|selegiline|maoi|nardil|parnate|marplan|emsam)\b)/i,
    ],
    reason:
      "Dangerous combination: SSRI antidepressant with MAOI — risk of serotonin syndrome, a potentially fatal condition causing hyperthermia, muscle rigidity, seizures, and death.",
    action:
      "Call 911 immediately. Serotonin syndrome is a medical emergency. Do not take any additional doses of either medication. Inform emergency responders of both medications.",
    level: "EMERGENCY",
  },
  // Opioids + Benzodiazepines → EMERGENCY (respiratory depression)
  {
    patterns: [
      /(?=.*\b(morphine|oxycodone|hydrocodone|fentanyl|codeine|tramadol|hydromorphone|oxymorphone|methadone|buprenorphine|percocet|vicodin|oxycontin|dilaudid|opioid|narcotic)\b)(?=.*\b(diazepam|lorazepam|alprazolam|clonazepam|temazepam|midazolam|chlordiazepoxide|oxazepam|benzodiazepine|benzo|valium|ativan|xanax|klonopin|restoril)\b)/i,
    ],
    reason:
      "Dangerous combination: Opioid with benzodiazepine — severe risk of respiratory depression, coma, and death. The FDA has issued a black box warning for this combination.",
    action:
      "Call 911 immediately. This combination can cause fatal respiratory depression. Do not take any additional doses. If breathing is slow or shallow (fewer than 8 breaths per minute), this is a medical emergency.",
    level: "EMERGENCY",
  },
  // Metformin + Contrast dye / kidney issues → URGENT (lactic acidosis)
  {
    patterns: [
      /(?=.*\b(metformin|glucophage|fortamet|riomet)\b)(?=.*\b(contrast|dye|ct\s*scan|angiogram|ivp|kidney\s*(problem|issue|disease|failure)|renal|ckd|creatinine)\b)/i,
    ],
    reason:
      "Dangerous combination: Metformin with contrast dye or kidney impairment — risk of lactic acidosis, a rare but potentially fatal metabolic condition.",
    action:
      "Seek urgent care within 24 hours if contrast was recently administered. Hold metformin and contact the prescribing physician immediately. Watch for muscle pain, weakness, trouble breathing, stomach pain, or feeling cold.",
    level: "URGENT",
  },
  // Lithium + NSAIDs/diuretics → URGENT (lithium toxicity)
  {
    patterns: [
      /(?=.*\b(lithium|lithobid|eskalith)\b)(?=.*\b(ibuprofen|naproxen|aspirin|diclofenac|meloxicam|nsaid|furosemide|lasix|hctz|hydrochlorothiazide|chlorthalidone|diuretic|water\s*pill|advil|motrin|aleve)\b)/i,
    ],
    reason:
      "Dangerous combination: Lithium with NSAIDs or diuretics — risk of lithium toxicity causing confusion, tremor, seizures, and permanent kidney damage.",
    action:
      "Seek urgent care within 24 hours. Request an immediate lithium level check. Watch for tremor, confusion, slurred speech, excessive thirst, nausea, or diarrhea. Do not stop lithium abruptly — consult prescribing physician.",
    level: "URGENT",
  },
  // Digoxin + clarithromycin/erythromycin → URGENT
  {
    patterns: [
      /(?=.*\b(digoxin|lanoxin|digitalis)\b)(?=.*\b(clarithromycin|erythromycin|biaxin|ery-tab)\b)/i,
    ],
    reason:
      "Dangerous combination: Digoxin with clarithromycin or erythromycin — these antibiotics can drastically increase digoxin levels, causing digoxin toxicity (nausea, vision changes, dangerous arrhythmias).",
    action:
      "Seek urgent care within 24 hours. Request a digoxin level check. Watch for nausea, vomiting, vision changes (yellow or green halos around lights), confusion, or irregular heartbeat.",
    level: "URGENT",
  },
  // Statins + grapefruit / certain antifungals → ROUTINE (rhabdomyolysis)
  {
    patterns: [
      /(?=.*\b(atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|fluvastatin|pitavastatin|lipitor|crestor|zocor|statin)\b)(?=.*\b(grapefruit|ketoconazole|itraconazole|fluconazole|voriconazole|posaconazole|antifungal|nizoral|sporanox|diflucan|vfend)\b)/i,
    ],
    reason:
      "Drug interaction: Statin combined with grapefruit or azole antifungal — increased risk of muscle damage (rhabdomyolysis) from elevated statin blood levels.",
    action:
      "Schedule a routine appointment to review medications. Avoid grapefruit and grapefruit juice entirely. Watch for unexplained muscle pain, tenderness, weakness, or dark-colored urine. Contact your physician promptly if these occur.",
    level: "ROUTINE",
  },
  // Alcohol + metronidazole / disulfiram-like reaction → URGENT
  {
    patterns: [
      /(?=.*\b(alcohol|drinking|drunk|beer|wine|liquor|vodka|whiskey|ethanol)\b)(?=.*\b(metronidazole|flagyl|tinidazole|disulfiram|antabuse)\b)/i,
    ],
    reason:
      "Dangerous combination: Alcohol with metronidazole (Flagyl) — can cause a severe disulfiram-like reaction: flushing, nausea, vomiting, rapid heart rate, and dangerous drop in blood pressure.",
    action:
      "Seek urgent care within 24 hours if symptoms are present. Stop alcohol consumption immediately. This reaction can be severe and last for hours. Do not consume alcohol for at least 48 hours after the last dose of metronidazole.",
    level: "URGENT",
  },
  // Multiple CNS depressants (benzos + alcohol + opioids) → EMERGENCY
  {
    patterns: [
      /(?=.*\b(diazepam|lorazepam|alprazolam|clonazepam|temazepam|midazolam|benzo|valium|ativan|xanax|klonopin|restoril)\b)(?=.*\b(alcohol|drinking|drunk|beer|wine|liquor|vodka|whiskey|ethanol)\b)(?=.*\b(opioid|morphine|oxycodone|hydrocodone|fentanyl|codeine|tramadol|percocet|vicodin|oxycontin|dilaudid|narcotic|heroin)\b)/i,
    ],
    reason:
      "Multiple CNS depressants detected: benzodiazepine + alcohol + opioid — extreme risk of fatal respiratory depression, coma, and death. Synergistic CNS depression multiplies the danger.",
    action:
      "Call 911 immediately. This is a life-threatening combination. If the person is not breathing or breathing slowly (fewer than 8 breaths per minute), begin rescue breathing if trained. Do not leave the person alone. Turn them on their side to prevent choking.",
    level: "EMERGENCY",
  },
];

// ─── Overdose / Poisoning Rules ──────────────────────────────────────────────

const OVERDOSE_POISONING_RULES: {
  patterns: RegExp[];
  reason: string;
  action: string;
  level: RiskLevel;
}[] = [
  {
    patterns: [
      /\boverdose\b/i, /\boverdosed\b/i, /\btook\s*too\s*many\b/i,
      /\btoo\s*much\s*medication\b/i, /\btoo\s*many\s*pills\b/i,
      /\baccidental\s*ingestion\b/i,
    ],
    reason: "Known or suspected overdose detected.",
    action: "Call 911 immediately. Call Poison Control (1-800-222-1222). Do NOT induce vomiting. Collect the container/label if safe to do so.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bpinpoint\s*pupils\b/i, /\btiny\s*pupils\b/i,
    ],
    reason: "Pinpoint pupils with possible drug context — potential opioid overdose.",
    action: "Call 911 immediately. Call Poison Control (1-800-222-1222). Do NOT induce vomiting. Collect the container/label if safe to do so.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bdrank\s*bleach\b/i, /\bswallowed\s*cleaner\b/i, /\bate\s*poison\b/i,
      /\bingested\s*chemical\b/i, /\bdrank\s*gasoline\b/i, /\btook\s*rat\s*poison\b/i,
    ],
    reason: "Toxic ingestion detected — corrosive or poisonous substance.",
    action: "Call 911 immediately. Call Poison Control (1-800-222-1222). Do NOT induce vomiting. Collect the container/label if safe to do so.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\bcarbon\s*monoxide\b/i, /\bCO\s*poisoning\b/i, /\bexhaust\s*fumes\b/i,
      /\bgarage\s*with\s*car\s*running\b/i,
    ],
    reason: "Possible carbon monoxide poisoning — life-threatening.",
    action: "Call 911 immediately. Get to fresh air immediately. Call Poison Control (1-800-222-1222). Do NOT induce vomiting.",
    level: "EMERGENCY",
  },
  {
    patterns: [
      /\balcohol\s*poisoning\b/i,
      /(?=.*\bdrank\s*too\s*much\s*alcohol\b)(?=.*\b(unconscious|won'?t\s*wake)\b)/i,
    ],
    reason: "Alcohol poisoning — risk of respiratory depression and death.",
    action: "Call 911 immediately. Call Poison Control (1-800-222-1222). Do NOT induce vomiting. Keep the person on their side to prevent choking.",
    level: "EMERGENCY",
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

/**
 * Check for overdose or poisoning indicators: known/suspected overdose,
 * opioid toxidrome, toxic ingestion, carbon monoxide, alcohol poisoning.
 * Returns the highest risk level, the matching reasons, and recommended actions.
 */
function checkOverdosePoisoning(
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

  for (const rule of OVERDOSE_POISONING_RULES) {
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

  // Additional combined check: "not breathing" with drug context (opioid toxidrome)
  if (!level || level !== "EMERGENCY") {
    const hasNotBreathing = /\bnot\s*breathing\b/i.test(allText);
    const hasDrugContext = /\b(heroin|opioid|fentanyl|pills?\b.*\btook|drug|overdose|narcan)\b/i.test(allText);
    if (hasNotBreathing && hasDrugContext) {
      reasons.push("Respiratory depression with drug context — potential opioid overdose.");
      actions.push("Call 911 immediately. Call Poison Control (1-800-222-1222). Do NOT induce vomiting. Collect the container/label if safe to do so.");
      level = "EMERGENCY";
    }
  }

  return { level, reasons, actions };
}

/**
 * Check for dangerous medication interactions from patient-reported medication lists.
 * Searches the chief complaint and symptom descriptions for known dangerous drug
 * combinations and also checks for polypharmacy (3+ medication mentions).
 *
 * Returns the highest risk level, the matching reasons, and recommended actions.
 */
function checkMedicationInteractions(
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

  // ── Check known dangerous combinations ──
  for (const rule of MEDICATION_INTERACTION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(allText)) {
        reasons.push(rule.reason);
        actions.push(rule.action);
        if (rule.level === "EMERGENCY") {
          level = "EMERGENCY";
        } else if (rule.level === "URGENT" && level !== "EMERGENCY") {
          level = "URGENT";
        } else if (rule.level === "ROUTINE" && !level) {
          level = "ROUTINE";
        }
        break; // one match per rule category
      }
    }
  }

  // ── Polypharmacy check: detect 3+ medication mentions ──
  // Match common drug suffixes: -pril, -olol, -statin, -pine, -pam, -lam, -cin,
  // -zole, -ide, -sone, -vir, -mab, -tinib, -mine, -bital, -done, -one, -formin, etc.
  if (!level || level !== "EMERGENCY") {
    // Suffix-based drug detection pattern
    const drugSuffixPattern =
      /\b\w*(pril|olol|statin|pine|sartan|pam|lam|zole|vir|mab|tinib|mine|bital|done|sone|sart|formin|gabapentin|prazole|tidine|cycline|micin|floxacin|glitazone|gliptin|dipine|afil|pramine|triptan|zodone|tidone|barbital|phan|phine|orphan)\b/i;

    const drugMentions = new Set<string>();

    // Find drug-like words in the text
    const words = allText.split(/[\s|,;.!?()]+/);
    for (const word of words) {
      const lower = word.toLowerCase();
      if (drugSuffixPattern.test(lower) && lower.length > 3) {
        drugMentions.add(lower);
      }
    }

    if (drugMentions.size >= 3) {
      reasons.push(
        "Polypharmacy detected: 3 or more medication-like terms mentioned. A comprehensive medication review is recommended to check for interactions, duplications, and deprescribing opportunities.",
      );
      actions.push(
        "Schedule a medication review appointment. Bring all current medications (including OTC, supplements, and herbals) to the visit. Do not stop any prescribed medications without consulting your physician.",
      );
      if (!level) {
        level = "ROUTINE";
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
 * 3b. Overdose / poisoning detection                     → EMERGENCY / URGENT
 * 3c. Medication interaction detection                   → EMERGENCY / URGENT / ROUTINE
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

  // ── Step 3b: Overdose / poisoning detection ──
  const overdoseAssessment = checkOverdosePoisoning(chiefComplaint, symptoms);
  if (overdoseAssessment.reasons.length > 0) {
    allReasons.push(...overdoseAssessment.reasons);
    allActions.push(...overdoseAssessment.actions);
    if (
      overdoseAssessment.level === "EMERGENCY" ||
      (overdoseAssessment.level === "URGENT" && riskLevel !== "EMERGENCY")
    ) {
      riskLevel = overdoseAssessment.level;
    }
  }

  // ── Step 3c: Medication interaction detection ──
  const medInteractionAssessment = checkMedicationInteractions(chiefComplaint, symptoms);
  if (medInteractionAssessment.reasons.length > 0) {
    allReasons.push(...medInteractionAssessment.reasons);
    allActions.push(...medInteractionAssessment.actions);
    if (
      medInteractionAssessment.level === "EMERGENCY" ||
      (medInteractionAssessment.level === "URGENT" && riskLevel !== "EMERGENCY") ||
      (medInteractionAssessment.level === "ROUTINE" && riskLevel === "SELF_CARE")
    ) {
      riskLevel = medInteractionAssessment.level;
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

  // ── Burn severity scaling (non-severe burns) ──
  // Only applies if no emergency red flag already caught the burn
  if (riskLevel !== "EMERGENCY") {
    const allTextBurn = [
      chiefComplaint,
      ...symptoms.map((s) => s.description),
      ...symptoms.flatMap((s) => s.associatedSymptoms),
    ].join(" | ");
    const hasBurnMention = /\b(burn|scald)\b/i.test(allTextBurn);
    if (hasBurnMention) {
      const isMinorBurn = /\b(small\s*burn|minor\s*burn)\b/i.test(allTextBurn);
      if (isMinorBurn) {
        if (riskLevel === "SELF_CARE") {
          riskLevel = "ROUTINE";
        }
        allReasons.push("Minor burn reported — treatable at home but should be evaluated if signs of infection develop.");
        allActions.push("Run cool water over the burn for at least 10 minutes. Apply aloe vera or burn ointment. Cover with a sterile, non-stick bandage. Seek care if redness spreads, blisters form, or pain worsens.");
      } else {
        // Non-minor burn → URGENT (unless already EMERGENCY or URGENT)
        if (riskLevel !== "URGENT") {
          riskLevel = "URGENT";
        }
        allReasons.push("Burn or scald reported — requires professional evaluation for depth and extent.");
        allActions.push("Seek urgent care for burn evaluation. Cool the burn with cool (not cold) running water for at least 20 minutes. Do not apply ice, butter, or ointments. Cover loosely with a clean, dry cloth.");
      }
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
