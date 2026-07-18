import { describe, it, expect } from "vitest";
import { assessRisk } from "./engine.js";
import type { TriageCase } from "./types.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<TriageCase> = {}): TriageCase {
  const defaults: TriageCase = {
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
    vitals: undefined,
  };
  return { ...defaults, ...overrides, symptoms: overrides.symptoms ?? defaults.symptoms };
}

// ─── Basic classifications ────────────────────────────────────────────────────

describe("assessRisk", () => {
  // ── SELF_CARE ─────────────────────────────────────────────────────────────

  describe("SELF_CARE", () => {
    it("returns SELF_CARE for mild, non-specific symptoms", () => {
      const result = assessRisk(makeCase());
      expect(result.riskLevel).toBe("SELF_CARE");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.recommendedAction).toContain("Rest");
    });

    it("returns SELF_CARE for empty symptoms list", () => {
      const result = assessRisk(
        makeCase({ symptoms: [], chiefComplaint: "General wellness check" }),
      );
      expect(result.riskLevel).toBe("SELF_CARE");
      expect(result.confidence).toBe(0.5);
    });

    it("returns SELF_CARE for mild cold symptoms", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Runny nose and sneezing",
          symptoms: [
            {
              description: "Runny nose",
              severity: 2,
              duration: "1 day",
              bodyArea: "nose",
              associatedSymptoms: ["sneezing", "mild cough"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("SELF_CARE");
    });
  });

  // ── ROUTINE ───────────────────────────────────────────────────────────────

  describe("ROUTINE", () => {
    it("returns ROUTINE for persistent symptoms > 3 days", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Persistent cough",
          symptoms: [
            {
              description: "Dry cough",
              severity: 4,
              duration: "5 days",
              bodyArea: "chest",
              associatedSymptoms: ["fatigue"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("ROUTINE");
    });

    it("returns ROUTINE for moderate pain (severity 5-7)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Knee pain",
          symptoms: [
            {
              description: "Aching knee after running",
              severity: 6,
              duration: "2 days",
              bodyArea: "knee",
              associatedSymptoms: ["swelling"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("ROUTINE");
    });

    it("returns ROUTINE for mild fever with no other flags", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Feeling feverish",
          symptoms: [
            {
              description: "Body aches",
              severity: 4,
              duration: "1 day",
              bodyArea: "whole body",
              associatedSymptoms: ["chills"],
            },
          ],
          vitals: { temperatureF: 100.5 },
        }),
      );
      expect(result.riskLevel).toBe("ROUTINE");
    });
  });

  // ── URGENT ────────────────────────────────────────────────────────────────

  describe("URGENT", () => {
    it("returns URGENT for severe pain (severity ≥ 8)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Severe abdominal pain",
          symptoms: [
            {
              description: "Sharp stabbing abdominal pain",
              severity: 9,
              duration: "4 hours",
              bodyArea: "abdomen",
              associatedSymptoms: ["nausea"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });

    it("returns URGENT for suspected fracture", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I think I broke my arm",
          symptoms: [
            {
              description: "Severe pain and visible deformity in forearm",
              severity: 8,
              duration: "1 hour",
              bodyArea: "arm",
              associatedSymptoms: ["swelling", "bruising"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
      expect(result.recommendedAction).toContain("Immobilize");
    });

    it("returns URGENT for low O2 saturation (88-91%)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Feeling tired and winded after walking",
          symptoms: [
            {
              description: "Getting tired easily with mild exertion",
              severity: 5,
              duration: "1 day",
              bodyArea: "chest",
              associatedSymptoms: [],
            },
          ],
          vitals: { oxygenSaturation: 90 },
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });

    it("returns URGENT for elevated heart rate (120-149)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Heart racing",
          symptoms: [
            {
              description: "Palpitations",
              severity: 5,
              duration: "2 hours",
              bodyArea: "chest",
              associatedSymptoms: [],
            },
          ],
          vitals: { heartRate: 130 },
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });

    it("returns URGENT for high systolic BP (160-179)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Headache and dizziness",
          symptoms: [
            {
              description: "Throbbing headache",
              severity: 6,
              duration: "6 hours",
              bodyArea: "head",
              associatedSymptoms: ["dizziness"],
            },
          ],
          vitals: { systolicBP: 170, diastolicBP: 95 },
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });
  });

  // ── EMERGENCY ────────────────────────────────────────────────────────────

  describe("EMERGENCY", () => {
    it("returns EMERGENCY for chest pain", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Sharp chest pain radiating to left arm",
          symptoms: [
            {
              description: "Crushing chest pressure",
              severity: 9,
              duration: "30 minutes",
              bodyArea: "chest",
              associatedSymptoms: ["sweating", "nausea", "shortness of breath"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("returns EMERGENCY for difficulty breathing", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I can't breathe",
          symptoms: [
            {
              description: "Unable to catch breath, feeling of suffocation",
              severity: 10,
              duration: "15 minutes",
              bodyArea: "chest",
              associatedSymptoms: ["wheezing"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for stroke symptoms (facial droop)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Right side of face is drooping",
          symptoms: [
            {
              description: "Facial droop on right side, slurred speech",
              severity: 8,
              duration: "20 minutes",
              bodyArea: "face",
              associatedSymptoms: ["arm weakness", "confusion"],
            },
          ],
          age: 65,
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for anaphylaxis (throat swelling)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Throat swelling after eating peanuts",
          symptoms: [
            {
              description: "Throat swelling and hives",
              severity: 9,
              duration: "5 minutes",
              bodyArea: "throat",
              associatedSymptoms: ["difficulty breathing", "hives"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for loss of consciousness", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I passed out and hit my head",
          symptoms: [
            {
              description: "Blacked out for about 30 seconds",
              severity: 8,
              duration: "30 seconds",
              bodyArea: "head",
              associatedSymptoms: ["confusion", "dizziness"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for severe bleeding", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Deep cut on leg, won't stop bleeding",
          symptoms: [
            {
              description: "Gushing blood from leg wound, bleeding profusely",
              severity: 9,
              duration: "10 minutes",
              bodyArea: "leg",
              associatedSymptoms: ["dizziness", "pale skin"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for sudden severe headache", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Worst headache of my life, came on suddenly",
          symptoms: [
            {
              description: "Thunderclap headache, sudden severe onset",
              severity: 10,
              duration: "5 minutes",
              bodyArea: "head",
              associatedSymptoms: ["neck stiffness", "nausea"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for high fever with confusion", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Confused and burning up with fever",
          symptoms: [
            {
              description: "Very high fever with disorientation",
              severity: 8,
              duration: "6 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["confusion", "chills"],
            },
          ],
          vitals: { temperatureF: 103 },
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for critically low O2 saturation", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Can barely breathe, lips are blue",
          symptoms: [
            {
              description: "Severe respiratory distress",
              severity: 10,
              duration: "10 minutes",
              bodyArea: "chest",
              associatedSymptoms: ["cyanosis", "confusion"],
            },
          ],
          vitals: { oxygenSaturation: 85 },
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for critically high systolic BP (≥ 180)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Severe headache with nosebleed",
          symptoms: [
            {
              description: "Pounding headache",
              severity: 9,
              duration: "2 hours",
              bodyArea: "head",
              associatedSymptoms: ["nosebleed", "blurred vision"],
            },
          ],
          vitals: { systolicBP: 195, diastolicBP: 110 },
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for critically high heart rate (≥ 150)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Heart racing out of control, feeling faint",
          symptoms: [
            {
              description: "Extremely rapid heartbeat with lightheadedness",
              severity: 9,
              duration: "30 minutes",
              bodyArea: "chest",
              associatedSymptoms: ["dizziness", "chest pain"],
            },
          ],
          vitals: { heartRate: 160 },
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles missing vitals gracefully", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Mild cough",
          symptoms: [
            {
              description: "Occasional dry cough",
              severity: 2,
              duration: "1 day",
              bodyArea: "chest",
              associatedSymptoms: [],
            },
          ],
          vitals: undefined,
        }),
      );
      expect(result.riskLevel).toBe("SELF_CARE");
    });

    it("handles multiple symptoms with mixed severity", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Not feeling well overall",
          symptoms: [
            {
              description: "Mild headache",
              severity: 3,
              duration: "1 day",
              bodyArea: "head",
              associatedSymptoms: [],
            },
            {
              description: "Chest pain with pressure",
              severity: 9,
              duration: "1 hour",
              bodyArea: "chest",
              associatedSymptoms: ["arm pain"],
            },
          ],
        }),
      );
      // Chest pain red flag should dominate
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("handles extreme vitals values at boundaries", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Checkup",
          symptoms: [
            {
              description: "General checkup",
              severity: 1,
              duration: "0 days",
              bodyArea: "whole body",
              associatedSymptoms: [],
            },
          ],
          vitals: {
            heartRate: 44,
            systolicBP: 79,
            oxygenSaturation: 87,
            temperatureF: 94,
            bloodGlucose: 49,
          },
        }),
      );
      // Multiple critical vitals should trigger EMERGENCY
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("is deterministic — same input, same output", () => {
      const input = makeCase({
        chiefComplaint: "Chest pain",
        symptoms: [
          {
            description: "Sharp chest pain",
            severity: 8,
            duration: "1 hour",
            bodyArea: "chest",
            associatedSymptoms: ["sweating"],
          },
        ],
        vitals: { heartRate: 110, systolicBP: 150, oxygenSaturation: 94 },
      });

      const result1 = assessRisk(input);
      const result2 = assessRisk(input);
      const result3 = assessRisk(input);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it("handles empty associated symptoms", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Mild fatigue",
          symptoms: [
            {
              description: "Tiredness",
              severity: 2,
              duration: "2 days",
              bodyArea: "whole body",
              associatedSymptoms: [],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("SELF_CARE");
    });

    it("handles symptoms from chief complaint even when symptoms array is sparse", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I have severe chest pain and difficulty breathing",
          symptoms: [
            {
              description: "Some discomfort",
              severity: 3,
              duration: "a few hours",
              bodyArea: "chest",
              associatedSymptoms: [],
            },
          ],
        }),
      );
      // The chief complaint contains red flags
      expect(result.riskLevel).toBe("EMERGENCY");
    });
  });

  // ── Pediatric Red Flags (age < 18) ────────────────────────────────────────

  describe("pediatric red flags", () => {
    it("returns EMERGENCY for lethargy / unresponsive child", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My child is lethargic and difficult to wake",
          age: 5,
          symptoms: [
            {
              description: "Barely responsive, won't wake up",
              severity: 9,
              duration: "2 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["fever"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for seizure / convulsion in child", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My daughter had a seizure",
          age: 3,
          symptoms: [
            {
              description: "Full body convulsion lasting 2 minutes",
              severity: 9,
              duration: "2 minutes",
              bodyArea: "whole body",
              associatedSymptoms: ["unresponsive", "shaking uncontrollably"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for non-blanching rash in child", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My baby has a rash that doesn't fade with the glass test",
          age: 1,
          symptoms: [
            {
              description: "Purple spots on arms and legs, non-blanching rash",
              severity: 8,
              duration: "3 hours",
              bodyArea: "arms and legs",
              associatedSymptoms: ["fever", "irritable"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for floppy / poor tone in infant", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My baby is floppy like a rag doll",
          age: 0,
          symptoms: [
            {
              description: "Poor muscle tone, limp and floppy",
              severity: 9,
              duration: "1 hour",
              bodyArea: "whole body",
              associatedSymptoms: ["not feeding"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns URGENT for dehydration signs in child", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My toddler has had no wet diaper for 8 hours and a dry mouth",
          age: 2,
          symptoms: [
            {
              description: "No wet diaper all day, sunken eyes, not drinking",
              severity: 7,
              duration: "8 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["dry mouth", "no tears when crying"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
      expect(result.recommendedAction).toContain("urgent");
    });

    it("returns URGENT for rapid breathing / retractions in child", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My son is breathing fast and I can see his ribs when he breathes",
          age: 4,
          symptoms: [
            {
              description: "Nasal flaring and retractions, ribs showing when breathing",
              severity: 7,
              duration: "3 hours",
              bodyArea: "chest",
              associatedSymptoms: ["cough"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });

    it("returns URGENT for inconsolable crying / high-pitched cry", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My infant won't stop crying and has a high pitched cry",
          age: 0,
          symptoms: [
            {
              description: "Inconsolable crying for 4 hours, abnormal high pitched cry",
              severity: 7,
              duration: "4 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["refusing to feed"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });

    it("does NOT apply pediatric rules to adults", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I feel lethargic and floppy today",
          age: 35,
          symptoms: [
            {
              description: "Feeling very tired and weak",
              severity: 5,
              duration: "1 day",
              bodyArea: "whole body",
              associatedSymptoms: [],
            },
          ],
        }),
      );
      // Adult with pediatric-sounding words should NOT trigger pediatric flags
      // Should still be ROUTINE (moderate pain at severity 5) not EMERGENCY
      expect(result.riskLevel).not.toBe("EMERGENCY");
    });
  });

  // ── Mental Health Crisis Detection ──────────────────────────────────────────

  describe("mental health crisis", () => {
    it("returns EMERGENCY for suicidal ideation", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I want to end my life",
          age: 25,
          symptoms: [
            {
              description: "I feel suicidal and want to kill myself",
              severity: 10,
              duration: "3 days",
              bodyArea: "mental",
              associatedSymptoms: ["hopelessness", "not sleeping"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("988");
      expect(result.recommendedAction).toContain("Suicide");
    });

    it("returns EMERGENCY for self-harm statements", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I've been cutting myself",
          age: 17,
          symptoms: [
            {
              description: "Self harm by cutting, I also want to hurt myself more",
              severity: 8,
              duration: "1 week",
              bodyArea: "arms",
              associatedSymptoms: ["depression"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("988");
    });

    it("returns EMERGENCY for psychosis / hallucinations", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I've been hearing voices telling me to do things",
          age: 30,
          symptoms: [
            {
              description: "Hallucinating — seeing things that aren't real",
              severity: 9,
              duration: "2 days",
              bodyArea: "mental",
              associatedSymptoms: ["paranoid", "they're watching me"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("988");
    });

    it("returns EMERGENCY for paranoid delusions", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "The government is tracking me, they're watching me through cameras",
          age: 40,
          symptoms: [
            {
              description: "Paranoid delusions that aren't real",
              severity: 8,
              duration: "1 week",
              bodyArea: "mental",
              associatedSymptoms: ["anxiety", "not sleeping"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("988");
    });

    it("returns URGENT for severe agitation / violent behavior", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My son is out of control and attacking people",
          age: 16,
          symptoms: [
            {
              description: "Violent and threatening others, completely aggressive and out of control",
              severity: 9,
              duration: "2 hours",
              bodyArea: "mental",
              associatedSymptoms: ["rage"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
      expect(result.recommendedAction).toContain("988");
    });

    it("returns URGENT for threatening behavior", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Patient is threatening staff and being aggressive",
          age: 28,
          symptoms: [
            {
              description: "Verbally threatening, physically aggressive posture",
              severity: 7,
              duration: "1 hour",
              bodyArea: "mental",
              associatedSymptoms: ["agitation", "pacing"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
    });

    it("returns EMERGENCY for suicide mention in associated symptoms", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Feeling very down lately",
          age: 22,
          symptoms: [
            {
              description: "Severe depression",
              severity: 8,
              duration: "2 weeks",
              bodyArea: "mental",
              associatedSymptoms: ["suicide thoughts", "can't eat"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("988");
    });
  });

  // ── Overdose / Poisoning Detection ──────────────────────────────────────────

  describe("overdose / poisoning", () => {
    it("returns EMERGENCY for known overdose in chief complaint", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Possible overdose on prescription medication",
          age: 28,
          symptoms: [
            {
              description: "Patient took an overdose of sleeping pills",
              severity: 9,
              duration: "30 minutes",
              bodyArea: "whole body",
              associatedSymptoms: ["drowsy", "confused"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("Poison Control");
      expect(result.recommendedAction).toContain("1-800-222-1222");
    });

    it("returns EMERGENCY for 'took too many pills' pattern", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I took too many pills",
          age: 34,
          symptoms: [
            {
              description: "Took too many painkillers",
              severity: 8,
              duration: "1 hour",
              bodyArea: "whole body",
              associatedSymptoms: ["nausea", "dizziness"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("Do NOT induce vomiting");
    });

    it("returns EMERGENCY for too much medication", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I accidentally took too much medication",
          age: 45,
          symptoms: [
            {
              description: "Took double dose of blood pressure medication by mistake",
              severity: 6,
              duration: "30 minutes",
              bodyArea: "whole body",
              associatedSymptoms: ["lightheaded"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("Poison Control");
    });

    it("returns EMERGENCY for accidental ingestion", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My toddler had an accidental ingestion of cleaning fluid",
          age: 2,
          symptoms: [
            {
              description: "Accidental ingestion of bathroom cleaner",
              severity: 9,
              duration: "5 minutes",
              bodyArea: "mouth",
              associatedSymptoms: ["coughing"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for opioid toxidrome — pinpoint pupils", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My friend has pinpoint pupils and is barely breathing",
          age: 26,
          symptoms: [
            {
              description: "Pinpoint pupils, very drowsy, slow breathing",
              severity: 10,
              duration: "unknown",
              bodyArea: "whole body",
              associatedSymptoms: ["not responsive", "blue lips"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("Poison Control");
    });

    it("returns EMERGENCY for toxic ingestion — drank bleach", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I drank bleach by accident",
          age: 42,
          symptoms: [
            {
              description: "Drank bleach, burning in throat and mouth",
              severity: 10,
              duration: "5 minutes",
              bodyArea: "throat",
              associatedSymptoms: ["vomiting", "pain"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("Do NOT induce vomiting");
    });

    it("returns EMERGENCY for carbon monoxide poisoning", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I think we have carbon monoxide poisoning",
          age: 35,
          symptoms: [
            {
              description: "Headache and nausea, woke up feeling terrible",
              severity: 8,
              duration: "2 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["confusion", "dizziness", "exhaust fumes smell"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("fresh air");
    });

    it("returns EMERGENCY for alcohol poisoning", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My friend has alcohol poisoning",
          age: 21,
          symptoms: [
            {
              description: "Drank too much alcohol and is now unconscious and won't wake",
              severity: 10,
              duration: "1 hour",
              bodyArea: "whole body",
              associatedSymptoms: ["vomiting", "unresponsive"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("side to prevent choking");
    });

    it("returns EMERGENCY for not breathing with drug context (opioid respiratory depression)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "He's not breathing after taking heroin",
          age: 29,
          symptoms: [
            {
              description: "Not breathing, unresponsive after opioid use",
              severity: 10,
              duration: "unknown",
              bodyArea: "whole body",
              associatedSymptoms: ["cyanosis", "pinpoint pupils"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });
  });

  // ── New Emergency Red Flags ──────────────────────────────────────────────────

  describe("new emergency red flags", () => {
    it("returns EMERGENCY for possible sepsis", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Possible sepsis — high fever with confusion and shaking",
          age: 55,
          symptoms: [
            {
              description: "Fever of 103, confused, and shaking with rigors",
              severity: 9,
              duration: "6 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["confusion", "shaking", "fever"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for septic shock mention", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Patient appears septic",
          age: 68,
          symptoms: [
            {
              description: "Low blood pressure, high fever, septic",
              severity: 10,
              duration: "12 hours",
              bodyArea: "whole body",
              associatedSymptoms: ["confusion", "shaking chills"],
            },
          ],
          vitals: { temperatureF: 103.5, systolicBP: 85, heartRate: 125 },
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for blood clot / DVT + shortness of breath", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I have a swollen leg with pain and now shortness of breath",
          age: 45,
          symptoms: [
            {
              description: "Swollen leg, calf pain, sudden shortness of breath",
              severity: 8,
              duration: "2 hours",
              bodyArea: "leg",
              associatedSymptoms: ["chest pain", "difficulty breathing"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for deep vein thrombosis", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I think I have a deep vein thrombosis",
          age: 52,
          symptoms: [
            {
              description: "Painful, warm, swollen calf — possible deep vein thrombosis",
              severity: 7,
              duration: "1 day",
              bodyArea: "leg",
              associatedSymptoms: ["redness", "warmth"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for ectopic pregnancy", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I have sharp abdominal pain with vaginal bleeding, could be ectopic",
          age: 28,
          symptoms: [
            {
              description: "Sharp abdominal pain on one side with vaginal bleeding",
              severity: 9,
              duration: "3 hours",
              bodyArea: "abdomen",
              associatedSymptoms: ["dizziness", "shoulder pain"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for testicular torsion", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Sudden severe testicular pain, possible torsion",
          age: 16,
          symptoms: [
            {
              description: "Severe testicle pain, swollen testicle, torsion",
              severity: 9,
              duration: "2 hours",
              bodyArea: "testicles",
              associatedSymptoms: ["nausea", "vomiting"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("surgery");
    });

    it("returns EMERGENCY for aortic dissection", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I have a tearing pain in my chest going to my back",
          age: 60,
          symptoms: [
            {
              description: "Ripping pain in chest radiating to back — possible aortic dissection",
              severity: 10,
              duration: "30 minutes",
              bodyArea: "chest",
              associatedSymptoms: ["sweating", "dizziness"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for meningitis symptoms (stiff neck + fever + headache)", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I have a stiff neck with fever and a severe headache",
          age: 22,
          symptoms: [
            {
              description: "Stiff neck, fever of 102, pounding headache",
              severity: 9,
              duration: "8 hours",
              bodyArea: "head and neck",
              associatedSymptoms: ["fever", "stiff neck", "headache", "light sensitivity"],
            },
          ],
          vitals: { temperatureF: 102.5 },
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("911");
    });

    it("returns EMERGENCY for meningitis keyword", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I think my child has meningitis",
          age: 8,
          symptoms: [
            {
              description: "Fever and headache, worried about meningitis",
              severity: 8,
              duration: "6 hours",
              bodyArea: "head",
              associatedSymptoms: ["stiff neck", "vomiting"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
    });

    it("returns EMERGENCY for third degree burns", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I have third degree burns on my arm",
          age: 30,
          symptoms: [
            {
              description: "Third degree burn from hot oil, charred skin",
              severity: 10,
              duration: "15 minutes",
              bodyArea: "arm",
              associatedSymptoms: ["severe pain"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("Do not apply ice");
    });

    it("returns EMERGENCY for electrical injury / electrocution", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I was electrocuted by a live wire",
          age: 38,
          symptoms: [
            {
              description: "Electric shock from exposed wire, burnt hand",
              severity: 9,
              duration: "10 minutes",
              bodyArea: "hand",
              associatedSymptoms: ["numbness", "muscle pain"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("electrical source");
    });

    it("returns EMERGENCY for near-drowning", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "My child nearly drowned in the pool",
          age: 4,
          symptoms: [
            {
              description: "Submerged in water for 30 seconds, inhaled water",
              severity: 9,
              duration: "just happened",
              bodyArea: "lungs",
              associatedSymptoms: ["coughing", "short of breath"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("EMERGENCY");
      expect(result.recommendedAction).toContain("delayed complications");
    });

    // ── Burn severity scaling ───────────────────────────────────────────────

    it("returns URGENT for a burn that is not clearly minor", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I burned my hand on the stove",
          age: 35,
          symptoms: [
            {
              description: "Burn on palm from hot pan, blistering",
              severity: 6,
              duration: "30 minutes",
              bodyArea: "hand",
              associatedSymptoms: ["redness", "pain"],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("URGENT");
      expect(result.recommendedAction).toContain("urgent care");
    });

    it("returns ROUTINE for a small minor burn", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "Small burn on finger from touching a hot dish",
          age: 28,
          symptoms: [
            {
              description: "Minor burn on fingertip, small burn",
              severity: 2,
              duration: "1 hour",
              bodyArea: "finger",
              associatedSymptoms: [],
            },
          ],
        }),
      );
      expect(result.riskLevel).toBe("ROUTINE");
      expect(result.recommendedAction).toContain("cool water");
    });

    it("returns URGENT for a scald without minor qualifier", () => {
      const result = assessRisk(
        makeCase({
          chiefComplaint: "I spilled boiling water on my leg",
          age: 40,
          symptoms: [
            {
              description: "Scald from boiling water, large red area on thigh",
              severity: 7,
              duration: "20 minutes",
              bodyArea: "leg",
              associatedSymptoms: ["blistering", "pain"],
            },
          ],
        }),
      );
      // Should be URGENT for scald, not EMERGENCY (no "severe burn" keyword match)
      expect(result.riskLevel).toBe("URGENT");
    });
  });

  // ── Medication Interaction Detection ────────────────────────────────────────

  describe("medication interaction detection", () => {
    describe("specific drug combinations", () => {
      it("returns EMERGENCY for warfarin + aspirin combination", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I take warfarin and also aspirin for headaches",
            symptoms: [
              {
                description: "Been taking coumadin daily and using aspirin for pain relief",
                severity: 5,
                duration: "1 week",
                bodyArea: "whole body",
                associatedSymptoms: ["bruising easily"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("EMERGENCY");
        expect(result.reasoning).toContain("Warfarin");
        expect(result.recommendedAction).toContain("bleeding");
      });

      it("returns EMERGENCY for SSRI + MAOI combination", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I'm on fluoxetine and just started Nardil for depression",
            symptoms: [
              {
                description: "Taking Prozac and phenelzine together, feeling confused and agitated",
                severity: 8,
                duration: "2 days",
                bodyArea: "mental",
                associatedSymptoms: ["fever", "muscle stiffness", "confusion"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("EMERGENCY");
        expect(result.reasoning).toContain("serotonin syndrome");
        expect(result.recommendedAction).toContain("911");
      });

      it("returns EMERGENCY for opioid + benzodiazepine combination", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I took oxycodone and Xanax together and feel very drowsy",
            symptoms: [
              {
                description: "Taking Percocet and alprazolam, breathing feels slow",
                severity: 9,
                duration: "2 hours",
                bodyArea: "whole body",
                associatedSymptoms: ["drowsiness", "slow breathing", "confusion"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("EMERGENCY");
        expect(result.reasoning).toContain("Opioid");
        expect(result.recommendedAction).toContain("respiratory depression");
      });

      it("returns EMERGENCY for multiple CNS depressants (benzo + alcohol + opioid)", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I took Valium with vodka and also some Vicodin",
            symptoms: [
              {
                description: "Drank alcohol and took diazepam and hydrocodone, barely breathing",
                severity: 10,
                duration: "1 hour",
                bodyArea: "whole body",
                associatedSymptoms: ["unresponsive", "shallow breathing"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("EMERGENCY");
        expect(result.reasoning).toContain("CNS depressants");
      });

      it("returns URGENT for lithium + NSAID combination", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I take lithium and have been using ibuprofen for back pain",
            symptoms: [
              {
                description: "On lithium for bipolar and taking Advil daily for back pain, feeling shaky",
                severity: 6,
                duration: "3 days",
                bodyArea: "whole body",
                associatedSymptoms: ["tremor", "confusion", "increased thirst"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("URGENT");
        expect(result.reasoning).toContain("Lithium");
      });

      it("returns URGENT for metformin + contrast dye / kidney issues", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I'm on metformin and had a CT scan with contrast today",
            symptoms: [
              {
                description: "Taking metformin for diabetes, had contrast dye for CT scan, have kidney disease",
                severity: 5,
                duration: "today",
                bodyArea: "whole body",
                associatedSymptoms: ["muscle pain", "weakness"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("URGENT");
        expect(result.reasoning).toContain("Metformin");
      });

      it("returns ROUTINE for statins + grapefruit interaction", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I take Lipitor and drink grapefruit juice every morning",
            symptoms: [
              {
                description: "Taking atorvastatin daily with grapefruit juice, mild muscle aches",
                severity: 3,
                duration: "2 weeks",
                bodyArea: "legs",
                associatedSymptoms: ["mild muscle soreness"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("ROUTINE");
        expect(result.reasoning).toContain("Statin");
      });
    });

    describe("polypharmacy detection", () => {
      it("returns ROUTINE when 3+ medication-like terms are detected", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I'm taking lisinopril, atorvastatin, and metformin daily",
            symptoms: [
              {
                description: "Managing blood pressure with lisinopril, cholesterol with atorvastatin, and diabetes with metformin",
                severity: 2,
                duration: "months",
                bodyArea: "whole body",
                associatedSymptoms: [],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("ROUTINE");
        expect(result.reasoning).toContain("Polypharmacy");
      });

      it("returns ROUTINE for polypharmacy with drug suffixes even in chief complaint alone", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "Reviewing medications: amlodipine, simvastatin, and metoprolol",
            symptoms: [
              {
                description: "Routine medication check",
                severity: 1,
                duration: "0 days",
                bodyArea: "whole body",
                associatedSymptoms: [],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("ROUTINE");
        expect(result.reasoning).toContain("medication review");
      });

      it("returns ROUTINE for polypharmacy with -olol, -pril, and -statin suffixes", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "Taking atenolol, ramipril, and rosuvastatin",
            symptoms: [
              {
                description: "Cardiac medications — beta blocker, ACE inhibitor, and statin",
                severity: 2,
                duration: "ongoing",
                bodyArea: "whole body",
                associatedSymptoms: [],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("ROUTINE");
        expect(result.reasoning).toContain("Polypharmacy");
      });
    });

    describe("negative tests", () => {
      it("returns SELF_CARE when no medications are mentioned", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "Mild headache after a long day",
            symptoms: [
              {
                description: "Dull headache from screen time",
                severity: 2,
                duration: "3 hours",
                bodyArea: "head",
                associatedSymptoms: ["eye strain"],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("SELF_CARE");
        expect(result.reasoning).not.toContain("medication");
      });

      it("does NOT flag a single medication without an interaction partner", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I take lisinopril for blood pressure",
            symptoms: [
              {
                description: "Taking lisinopril 10mg daily for hypertension",
                severity: 1,
                duration: "1 year",
                bodyArea: "whole body",
                associatedSymptoms: [],
              },
            ],
          }),
        );
        // Should not flag any interaction for a single safe medication
        expect(result.riskLevel).toBe("SELF_CARE");
        expect(result.reasoning).not.toContain("interaction");
        expect(result.reasoning).not.toContain("Polypharmacy");
      });

      it("does NOT flag warfarin alone without interacting drug", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I take warfarin as prescribed, checking for routine monitoring",
            symptoms: [
              {
                description: "On Coumadin for AFib, due for INR check",
                severity: 1,
                duration: "ongoing",
                bodyArea: "whole body",
                associatedSymptoms: [],
              },
            ],
          }),
        );
        expect(result.riskLevel).toBe("SELF_CARE");
        expect(result.reasoning).not.toContain("Warfarin");
      });

      it("does NOT flag two safe medications with no known interaction", () => {
        const result = assessRisk(
          makeCase({
            chiefComplaint: "I take lisinopril and metformin for my conditions",
            symptoms: [
              {
                description: "Taking lisinopril for BP and metformin for diabetes, feeling fine",
                severity: 1,
                duration: "ongoing",
                bodyArea: "whole body",
                associatedSymptoms: [],
              },
            ],
          }),
        );
        // Lisinopril + metformin is not a dangerous combination in our rules
        expect(result.riskLevel).toBe("SELF_CARE");
        expect(result.reasoning).not.toContain("Dangerous combination");
      });
    });
  });
});
