// Inference router (WP-4): model cascade, Advantage-Check post-filter, cost circuit
// breaker, prompt assembly. Pure logic — no I/O — so the Deno Edge Function stays a
// thin adapter and everything here is node-testable (audit A5).
import {
  ADVANTAGE_REFUSAL,
  AssistRequest,
  CoachingResponse,
} from 'contracts';

export interface ModelAliases {
  primary: string;    // e.g. gpt-5-nano (env: VISION_MODEL_PRIMARY)
  escalation: string; // e.g. gpt-5.4-mini (env: VISION_MODEL_ESCALATION)
  fallback: string;   // e.g. gemini-2.5-flash-lite (env: VISION_MODEL_FALLBACK)
}

export const ESCALATION_CONFIDENCE_THRESHOLD = 0.55;

/** Cascade rule: escalate only on low confidence or a dense-text ROI. */
export function shouldEscalate(
  confidence: number,
  request: Pick<AssistRequest, 'roi_descriptors'>,
  escalationAllowed: boolean,
): boolean {
  if (!escalationAllowed) return false;
  const denseText = request.roi_descriptors.some((r) => r.kind === 'dense_text');
  return confidence < ESCALATION_CONFIDENCE_THRESHOLD || denseText;
}

/**
 * Rolling-mean cost circuit breaker (§WP-4). When the rolling mean per-assist cost
 * exceeds the ceiling, the router flips primary → fallback until the window recovers.
 */
export class CostCircuitBreaker {
  private readonly window: number[] = [];
  private readonly ceilingUsdMicros: number;
  private readonly windowSize: number;
  constructor(ceilingUsdMicros: number, windowSize = 50) {
    if (ceilingUsdMicros <= 0) throw new Error('ceiling must be positive');
    this.ceilingUsdMicros = ceilingUsdMicros;
    this.windowSize = windowSize;
  }
  record(costUsdMicros: number): void {
    this.window.push(Math.max(0, costUsdMicros));
    if (this.window.length > this.windowSize) this.window.shift();
  }
  get rollingMeanUsdMicros(): number {
    if (this.window.length === 0) return 0;
    return this.window.reduce((a, b) => a + b, 0) / this.window.length;
  }
  get tripped(): boolean {
    return this.window.length > 0 && this.rollingMeanUsdMicros > this.ceilingUsdMicros;
  }
  pickPrimary(aliases: ModelAliases): { model: string; tripped: boolean } {
    return this.tripped
      ? { model: aliases.fallback, tripped: true }
      : { model: aliases.primary, tripped: false };
  }
}

// Advantage Check post-filter (§1.1.2). The prompt already constrains the model; this
// is the independent second wall. Patterns target live-opponent sensory augmentation
// (positions/health/loadout through occlusion), not macro coaching vocabulary.
const OPPONENT_TERMS =
  '(?:enem(?:y|ies)|opponent(?:s)?|attacker(?:s)?|player(?:s)? on the other team)';
const ADVANTAGE_PATTERNS: RegExp[] = [
  new RegExp(`${OPPONENT_TERMS}[^.!?]{0,60}\\b(?:behind|through|inside)\\b[^.!?]{0,40}\\b(?:wall|smoke|fog|door|cover)`, 'i'),
  new RegExp(`\\b(?:is|are|currently|now)\\s+(?:at|in|on|holding|rotating\\s+to)\\b[^.!?]{0,40}\\b(?:site|spawn|flank|position)\\b[^.!?]{0,40}${OPPONENT_TERMS}`, 'i'),
  new RegExp(`${OPPONENT_TERMS}[^.!?]{0,60}\\b(?:is|are|currently|now)\\s+(?:at|in|on|behind|holding|flanking|rotating|pushing|camping|one[- ]shot|low\\s+(?:hp|health))\\b`, 'i'),
  new RegExp(`\\b(?:exact|precise|real[- ]?time)\\s+(?:location|position|coordinates?)\\b[^.!?]{0,60}${OPPONENT_TERMS}`, 'i'),
  new RegExp(`${OPPONENT_TERMS}[^.!?]{0,40}\\b(?:hp|health|shield|ult(?:imate)?|economy|loadout)\\s+(?:is|are|at)\\b`, 'i'),
];

export function violatesAdvantageCheck(adviceText: string, pvpFlagged: boolean): boolean {
  if (!pvpFlagged) return false;
  return ADVANTAGE_PATTERNS.some((p) => p.test(adviceText));
}

/** Apply the post-filter: PvP-flagged violations become the policy refusal. */
export function enforceAdvantageCheck(
  response: CoachingResponse,
  pvpFlagged: boolean,
): { response: CoachingResponse; refused: boolean } {
  if (violatesAdvantageCheck(response.advice_text, pvpFlagged)) {
    return { response: ADVANTAGE_REFUSAL, refused: true };
  }
  return { response, refused: false };
}

/**
 * Prompt assembly ordered for provider prompt caching: the stable prefix (policy,
 * schema, ontology) precedes all volatile per-request content, byte-identical across
 * requests for a given title+mode.
 */
export interface PromptSections {
  stablePrefix: string;
  volatile: string;
}

export function buildPrompt(args: {
  titleSlug: string;
  mode: string;
  pvpFlagged: boolean;
  retrievedChunks: { chunk_id: string; chunk: string; trust_tier: number }[];
  intent: string;
  observables: { window_title: string; vision_fallback: boolean };
}): PromptSections {
  const stablePrefix = [
    'You are GamePointAgent, a screen-vision game coach. You give decision-support only.',
    'HARD CONSTRAINTS (non-negotiable):',
    '1. Never reveal live opponent information the player could not perceive themselves (positions, health, loadouts through walls/fog/smoke). If asked, refuse.',
    '2. Every factual claim must cite a provided evidence chunk id in evidence_ids, or the response must set not_verified=true and prefix advice_text with "Not verified:".',
    '3. Respond ONLY with JSON matching the CoachingResponse schema: {advice_text, recommended_action, evidence_ids, confidence, source_tier, not_verified}.',
    '4. Coach decisions: builds, rotations, timers, macro strategy, resource use. Be specific and brief.',
    `Title: ${args.titleSlug}. Coaching mode: ${args.mode}. PvP-flagged: ${args.pvpFlagged}.`,
  ].join('\n');

  const evidence = args.retrievedChunks
    .map((c) => `[${c.chunk_id}] (trust ${c.trust_tier}) ${c.chunk}`)
    .join('\n');

  const volatile = [
    `Player intent: ${args.intent}.`,
    args.observables.vision_fallback
      ? 'Title identification came from vision fallback — confirm the game from the frame before advising.'
      : `Foreground window: ${args.observables.window_title}.`,
    evidence ? `Evidence chunks:\n${evidence}` : 'Evidence chunks: none retrieved — respond not_verified.',
    'The current game frame is attached. Advise on the single most valuable decision now.',
  ].join('\n');

  return { stablePrefix, volatile };
}

export { defaultFixtureBudget } from 'contracts';
export type { AssistBudget } from 'contracts';
