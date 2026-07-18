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
});
