// GamePointAgent wire contracts — single source of truth (ADR-007).
// Consumed by: overlay (direct import), Edge Functions (synced copy via
// scripts/sync-edge.mjs), Rust dispatch crate (serde mirror, fixture-parity tested).
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

const uuid = z.string().uuid();
const hex64 = z.string().regex(/^[0-9a-f]{64}$/, 'blake3 hex digest');

export const RoiKind = z.enum(['hud', 'minimap', 'tooltip', 'dialog', 'dense_text', 'other']);

export const RoiDescriptor = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  kind: RoiKind,
});

export const HotkeyIntent = z.enum(['assist', 'explain', 'recap']);

export const LocalObservables = z.object({
  process_name: z.string().max(256),
  window_title: z.string().max(512),
  title_slug_hint: z.string().max(128).nullable(),
  vision_fallback: z.boolean(), // true when process/window match failed and vision must identify
});

export const AssistRequest = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  session_id: uuid,
  title_id: uuid,
  ts_client_monotonic_ms: z.number().int().nonnegative(),
  frame_b64: z.string().min(1).max(8_000_000), // JPEG/WebP, base64 (ADR-006)
  frame_width: z.number().int().positive().max(16_384),
  frame_height: z.number().int().positive().max(16_384),
  roi_descriptors: z.array(RoiDescriptor).max(8),
  audio_opus_bytes: z.null(),      // ADR-003: frame-only v1.0, structurally enforced
  audio_duration_ms: z.literal(0), // ADR-003
  hotkey_intent: HotkeyIntent,
  local_observables: LocalObservables,
  blake3: hex64, // digest of raw (pre-base64) frame bytes
  // A4: optional client-supplied correlation id + client build tag. Server generates
  // request_id when absent, so pre-A4 clients (incl. the Rust dispatch mirror) stay valid.
  request_id: uuid.optional(),
  client_version: z.string().max(64).optional(),
});

export const SourceTier = z.enum(['verified', 'mixed', 'policy', 'none']);

export const CoachingResponse = z
  .object({
    advice_text: z.string().min(1).max(2_000),
    recommended_action: z.string().min(1).max(300),
    evidence_ids: z.array(uuid).max(16),
    confidence: z.number().min(0).max(1),
    source_tier: SourceTier,
    not_verified: z.boolean(),
    latency_ms: z.number().int().nonnegative().optional(),
    // A4: correlation id survives the full loop — response body, coaching_responses
    // row, Realtime broadcast, HUD state. Optional: pre-A4 rows stay valid.
    request_id: uuid.optional(),
  })
  // Truth bar (§1.3): a claim carries evidence or is explicitly not verified.
  .refine((r) => r.evidence_ids.length > 0 || r.not_verified, {
    message: 'truth bar: evidence_ids required unless not_verified=true',
  });

export const AdviceOutcome = z.enum(['ok', 'degraded', 'refused_advantage', 'error']);

export const AdviceEventTelemetry = z.object({
  session_id: uuid,
  title_id: uuid,
  mode: z.string().max(32),
  model: z.string().max(128),
  latency_ms: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cost_usd_micros: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  outcome: AdviceOutcome,
});

export const AssistBudget = z.object({
  maxInputTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  maxImagePixels: z.number().int().positive(),
  maxRois: z.number().int().positive(),
  maxRetrievalChunks: z.number().int().positive(),
  maxLatencyMs: z.number().int().positive(),
  maxCostUsdMicros: z.number().int().positive(),
  escalationAllowed: z.boolean(),
});

export type RoiDescriptor = z.infer<typeof RoiDescriptor>;
export type HotkeyIntent = z.infer<typeof HotkeyIntent>;
export type LocalObservables = z.infer<typeof LocalObservables>;
export type AssistRequest = z.infer<typeof AssistRequest>;
export type SourceTier = z.infer<typeof SourceTier>;
export type CoachingResponse = z.infer<typeof CoachingResponse>;
export type AdviceOutcome = z.infer<typeof AdviceOutcome>;
export type AdviceEventTelemetry = z.infer<typeof AdviceEventTelemetry>;
export type AssistBudget = z.infer<typeof AssistBudget>;

export const defaultFixtureBudget: AssistBudget = AssistBudget.parse({
  maxInputTokens: 1200,
  maxOutputTokens: 120,
  maxImagePixels: 786_432,
  maxRois: 2,
  maxRetrievalChunks: 4,
  maxLatencyMs: 1500,
  maxCostUsdMicros: 500,
  escalationAllowed: false,
});

/** Degraded response used on any inference failure — never a crash (§1.2). */
export const NO_ADVICE_THIS_FRAME: CoachingResponse = CoachingResponse.parse({
  advice_text: 'Not verified: no advice this frame.',
  recommended_action: 'none',
  evidence_ids: [],
  confidence: 0,
  source_tier: 'none',
  not_verified: true,
});

/** Refusal issued when the Advantage Check post-filter trips (§1.1.2). */
export const ADVANTAGE_REFUSAL: CoachingResponse = CoachingResponse.parse({
  advice_text:
    'GamePointAgent coaches decisions — it never calls out live opponent information you could not perceive yourself. Ask about builds, rotations, or macro strategy instead.',
  recommended_action: 'none',
  evidence_ids: [],
  confidence: 1,
  source_tier: 'policy',
  not_verified: true,
});

// --- Assist error taxonomy (A4) ----------------------------------------------
// Deterministic machine-readable codes for every non-200 assist outcome. The
// human-readable `error` field is preserved for pre-taxonomy clients.
export const AssistErrorCode = z.enum([
  'AUTH_REQUIRED',
  'INVALID_REQUEST',
  'SESSION_NOT_OWNED',
  'TITLE_NOT_ELIGIBLE',
  'RATE_LIMITED',
  'METHOD_NOT_ALLOWED',
]);

export const AssistErrorBody = z.object({
  error_code: AssistErrorCode,
  error: z.string(),
  request_id: uuid,
});

export type AssistErrorCode = z.infer<typeof AssistErrorCode>;
export type AssistErrorBody = z.infer<typeof AssistErrorBody>;

// --- Session config handoff: web -> overlay (A3) ------------------------------
// The overlay never invents its own session. The authenticated web app exports a
// versioned, Zod-validated config bound to a real `sessions` row; the overlay
// refuses anything malformed and runs fixture mode only when unconfigured.
export const SESSION_CONFIG_VERSION = 1 as const;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (data.length % 4)) % 4);
  const binary = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Structural refusal: server credentials must never enter a client-side config. */
export function looksLikeServerSecret(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(fromBase64Url(parts[1])) as { role?: string };
      if (payload.role === 'service_role') return true;
    } catch {
      // not a decodable JWT — fall through
    }
  }
  return false;
}

export const SessionConfig = z.object({
  config_version: z.literal(SESSION_CONFIG_VERSION),
  session_id: uuid,
  title_id: uuid,
  title_slug: z.string().min(1).max(128),
  supabase_url: z.string().url().startsWith('https://'),
  publishable_key: z
    .string()
    .min(20)
    .max(512)
    .refine((k) => !looksLikeServerSecret(k), {
      message: 'server secrets must never enter a client session config',
    }),
  assist_endpoint: z.string().url().startsWith('https://'),
  issued_at: z.string().datetime(),
});

export type SessionConfig = z.infer<typeof SessionConfig>;

/** Encode a validated config for transport (URL param / clipboard). Throws on invalid input. */
export function encodeSessionConfig(config: SessionConfig): string {
  return toBase64Url(JSON.stringify(SessionConfig.parse(config)));
}

export type DecodedSessionConfig =
  | { ok: true; config: SessionConfig }
  | { ok: false; error: string };

/** Decode + validate a transported config. Never throws — malformed input is a refusal, not a crash. */
export function decodeSessionConfig(encoded: string): DecodedSessionConfig {
  try {
    const parsed = SessionConfig.safeParse(JSON.parse(fromBase64Url(encoded)));
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
    }
    return { ok: true, config: parsed.data };
  } catch {
    return { ok: false, error: 'config payload is not valid base64url JSON' };
  }
}
