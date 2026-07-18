import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { TriageResult, TriageCase } from "../triage/types.js";

// ─── API Key Resolution ──────────────────────────────────────────────────────

let _apiKey: string | null | undefined = undefined;

function getApiKey(): string | null {
  if (_apiKey !== undefined) return _apiKey;

  // 1. Check env var
  if (process.env.ANTHROPIC_API_KEY) {
    _apiKey = process.env.ANTHROPIC_API_KEY;
    return _apiKey;
  }

  // 2. Check file at packages/backend/.anthropic_key
  const keyFilePath = resolve("packages/backend/.anthropic_key");
  if (existsSync(keyFilePath)) {
    try {
      const key = readFileSync(keyFilePath, "utf-8").trim();
      if (key) {
        _apiKey = key;
        return _apiKey;
      }
    } catch {
      // fall through
    }
  }

  _apiKey = null;
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Returns true if an Anthropic API key is configured and available. */
export function hasLlm(): boolean {
  return getApiKey() !== null;
}

/** The risk level ordering — higher index = higher severity. */
const RISK_ORDER: Record<string, number> = {
  SELF_CARE: 0,
  ROUTINE: 1,
  URGENT: 2,
  EMERGENCY: 3,
};

/**
 * Enhances a deterministic TriageResult with AI clinical reasoning.
 *
 * When no API key is available, returns the original result unchanged.
 * Never downgrades the risk level — only escalates or confirms.
 * Times out after 10 seconds, returning the original result on timeout.
 */
export async function enhanceTriageResult(
  result: TriageResult,
  triageCase: TriageCase,
): Promise<TriageResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return result;
  }

  try {
    // Dynamic import to avoid loading the SDK when not needed
    const { default: Anthropic } = await import("@anthropic-ai/sdk");

    const anthropic = new Anthropic({ apiKey });

    const prompt = buildEnhancementPrompt(result, triageCase);

    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        system:
          "You are a clinical reasoning assistant for a triage system. " +
          "Review the deterministic triage output and provide additional clinical context. " +
          "NEVER downgrade the risk level — you may only escalate or confirm. " +
          "Your output must be valid JSON matching the specified format exactly.",
        messages: [{ role: "user", content: prompt }],
      }),
      10_000,
    );

    // Parse the AI response
    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    const aiResult = parseAiResponse(content);

    if (!aiResult) {
      // Failed to parse — return original with a note
      return {
        ...result,
        reasoning: result.reasoning + " [AI enhancement unavailable — could not parse LLM response]",
      };
    }

    // Enforce: AI must never downgrade risk level
    const originalIndex = RISK_ORDER[result.riskLevel] ?? -1;
    const aiIndex = RISK_ORDER[aiResult.riskLevel] ?? -1;

    if (aiIndex < originalIndex) {
      // AI tried to downgrade — reject and use original with notes
      return {
        ...result,
        reasoning:
          result.reasoning +
          " [AI noted: " +
          (aiResult.aiNotes || "no additional concerns") +
          " — risk level preserved at " +
          result.riskLevel +
          "]",
        followUpGuidance:
          aiResult.followUpGuidance && aiResult.followUpGuidance !== result.followUpGuidance
            ? result.followUpGuidance + " | AI follow-up note: " + aiResult.followUpGuidance
            : result.followUpGuidance,
      };
    }

    // AI escalated or confirmed — merge results
    return {
      riskLevel: aiResult.riskLevel as TriageResult["riskLevel"],
      confidence: aiResult.confidence ?? result.confidence,
      reasoning: aiResult.reasoning || result.reasoning,
      recommendedAction: aiResult.recommendedAction || result.recommendedAction,
      followUpGuidance: aiResult.followUpGuidance || result.followUpGuidance,
    };
  } catch (err) {
    // Any error (timeout, network, parse, etc.) — return original result
    console.error("[llm] Enhancement failed:", (err as Error).message);
    return result;
  }
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildEnhancementPrompt(result: TriageResult, triageCase: TriageCase): string {
  const symptomsText = triageCase.symptoms
    .map(
      (s) =>
        `- ${s.description} (severity: ${s.severity}/10, duration: ${s.duration}, body area: ${s.bodyArea}${
          s.associatedSymptoms.length > 0 ? ", associated: " + s.associatedSymptoms.join(", ") : ""
        })`,
    )
    .join("\n");

  const vitalsText = triageCase.vitals
    ? Object.entries(triageCase.vitals)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "None provided";

  return `## Patient Case

**Chief Complaint:** ${triageCase.chiefComplaint}
**Age:** ${triageCase.age}

**Symptoms:**
${symptomsText || "None"}

**Vitals:**
${vitalsText}

## Deterministic Triage Result

**Risk Level:** ${result.riskLevel}
**Confidence:** ${result.confidence}
**Reasoning:** ${result.reasoning}
**Recommended Action:** ${result.recommendedAction}
**Follow-up Guidance:** ${result.followUpGuidance}

## Instructions

Review this triage assessment for clinical nuance. Consider:

1. Are there red flags the deterministic engine may have missed?
2. Does the combination of symptoms + vitals + age suggest a different urgency?
3. Is there anything in the chief complaint or symptoms that warrants escalation?

**CRITICAL RULE:** You MUST NOT downgrade the risk level. You may only escalate or confirm the current level.

Return a JSON object with these fields (no other text):
{
  "riskLevel": "EMERGENCY" | "URGENT" | "ROUTINE" | "SELF_CARE",
  "confidence": <number 0-1>,
  "reasoning": "<clinical reasoning summary>",
  "recommendedAction": "<actionable next step>",
  "followUpGuidance": "<follow-up instructions>",
  "aiNotes": "<any additional clinical observations the deterministic engine may have missed>"
}`;
}

// ─── Response Parser ─────────────────────────────────────────────────────────

interface AiEnhancementResult {
  riskLevel: string;
  confidence?: number;
  reasoning?: string;
  recommendedAction?: string;
  followUpGuidance?: string;
  aiNotes?: string;
}

function parseAiResponse(content: string): AiEnhancementResult | null {
  try {
    // Try to find JSON in the response — the model may wrap it in markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Validate required fields
    const validRiskLevels = ["EMERGENCY", "URGENT", "ROUTINE", "SELF_CARE"];
    if (!parsed.riskLevel || typeof parsed.riskLevel !== "string" || !validRiskLevels.includes(parsed.riskLevel)) {
      return null;
    }

    return {
      riskLevel: parsed.riskLevel,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
      recommendedAction: typeof parsed.recommendedAction === "string" ? parsed.recommendedAction : undefined,
      followUpGuidance: typeof parsed.followUpGuidance === "string" ? parsed.followUpGuidance : undefined,
      aiNotes: typeof parsed.aiNotes === "string" ? parsed.aiNotes : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Timeout Helper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM request timed out after ${ms}ms`)), ms),
    ),
  ]);
}
