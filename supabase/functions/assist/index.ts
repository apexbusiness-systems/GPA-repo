// POST /assist — frame payload in, coaching JSON out (WP-4).
// Flow: JWT → Zod parse → title gate → embed → retrieval → cascade → post-filter →
// telemetry → coaching_responses insert (Broadcast pushes to session:{id}).
// All decision logic lives in _shared/router.ts (synced from packages/router, node-tested).
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  AssistRequest,
  CoachingResponse,
  NO_ADVICE_THIS_FRAME,
  type AssistErrorCode,
} from '../_shared/contracts.ts';
import {
  buildPrompt,
  CostCircuitBreaker,
  enforceAdvantageCheck,
  shouldEscalate,
  type ModelAliases,
} from '../_shared/router.ts';
import { preflight, json } from '../_shared/cors.ts';

// A4 error taxonomy: every non-200 carries a deterministic code + request_id.
// The human-readable `error` field is preserved for pre-taxonomy clients.
function refuse(
  req: Request,
  status: number,
  code: AssistErrorCode,
  message: string,
  requestId: string,
): Response {
  return json(
    req,
    status,
    { error_code: code, error: message, request_id: requestId },
    { 'x-gp-request-id': requestId },
  );
}

// --- Hybrid provider registry (ADR-009) --------------------------------------
// Model aliases are provider-prefixed ("groq:<model>", "gemini:<model>",
// "openai:<model>"); un-prefixed aliases resolve to openai for back-compat.
// Cross-provider fallback keeps the loop alive when one vendor fails.
interface ModelProvider {
  baseUrl: string;
  key: string | undefined;
}

const PROVIDERS: Record<string, ModelProvider> = {
  groq: {
    baseUrl: Deno.env.get('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1',
    key: Deno.env.get('GROQ_API_KEY'),
  },
  gemini: {
    baseUrl: Deno.env.get('GEMINI_BASE_URL') ??
      'https://generativelanguage.googleapis.com/v1beta/openai',
    key: Deno.env.get('GEMINI_API_KEY'),
  },
  openai: {
    baseUrl: Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
    key: Deno.env.get('OPENAI_API_KEY'),
  },
};

// Adaptive provider health (ADR-009): a provider that hard-fails (network, 429,
// 5xx) is skipped for a cooldown window, then automatically retried — failover
// is instant during an outage and recovery needs no operator action. In-memory
// per isolate: worst case after a cold start is one probe request per provider.
const PROVIDER_COOLDOWN_MS = Number(Deno.env.get('PROVIDER_COOLDOWN_MS') ?? 120_000);
const providerDownUntil = new Map<string, number>();

function providerHealthy(name: string): boolean {
  return (providerDownUntil.get(name) ?? 0) <= Date.now();
}

function noteProviderFailure(name: string, status: number | null): void {
  // Only outage signals trip the cooldown; 4xx config errors (bad model name,
  // bad request) are alias-level problems, not vendor outages.
  if (status === null || status === 429 || status >= 500) {
    providerDownUntil.set(name, Date.now() + PROVIDER_COOLDOWN_MS);
    console.error('provider_cooldown', { provider: name, ms: PROVIDER_COOLDOWN_MS });
  }
}

function resolveModel(alias: string): { provider: ModelProvider; model: string; name: string } {
  const idx = alias.indexOf(':');
  if (idx === -1) return { provider: PROVIDERS.openai, model: alias, name: 'openai' };
  const name = alias.slice(0, idx);
  return { provider: PROVIDERS[name] ?? PROVIDERS.openai, model: alias.slice(idx + 1), name };
}

const aliases: ModelAliases = {
  primary: Deno.env.get('VISION_MODEL_PRIMARY') ?? 'groq:meta-llama/llama-4-scout-17b-16e-instruct',
  escalation: Deno.env.get('VISION_MODEL_ESCALATION') ?? 'gemini:gemini-2.5-flash',
  fallback: Deno.env.get('VISION_MODEL_FALLBACK') ?? 'gemini:gemini-flash-lite-latest',
};
const breaker = new CostCircuitBreaker(
  Number(Deno.env.get('COST_BREAKER_USD_MICROS') ?? 500),
);

const responseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['advice_text', 'recommended_action', 'evidence_ids', 'confidence', 'source_tier', 'not_verified'],
  properties: {
    advice_text: { type: 'string' },
    recommended_action: { type: 'string' },
    evidence_ids: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
    source_tier: { enum: ['verified', 'mixed', 'policy', 'none'] },
    not_verified: { type: 'boolean' },
  },
} as const;

interface ModelResult {
  response: CoachingResponse | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
}

async function callVisionModel(
  modelAlias: string,
  stablePrefix: string,
  volatile: string,
  frameB64: string,
): Promise<ModelResult> {
  const started = performance.now();
  const { provider, model, name } = resolveModel(modelAlias);
  if (!provider.key || !providerHealthy(name)) {
    console.error('model_provider_skipped', { model: modelAlias, cooling: providerHealthy(name) === false });
    return { response: null, model: modelAlias, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
  }
  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${provider.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      // Stable prefix first → provider prompt caching; volatile content last.
      messages: [
        { role: 'system', content: stablePrefix },
        {
          role: 'user',
          content: [
            { type: 'text', text: volatile },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frameB64}`, detail: 'low' } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'coaching_response', strict: true, schema: responseJsonSchema },
      },
      max_tokens: Number(Deno.env.get('ASSIST_MAX_OUTPUT_TOKENS') ?? 120),
    }),
    });
  } catch {
    noteProviderFailure(name, null); // network-level outage
    return { response: null, model: modelAlias, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
  }
  if (!res.ok) {
    noteProviderFailure(name, res.status);
    console.error('model_call_failed', { model: modelAlias, status: res.status, ms: performance.now() - started });
    return { response: null, model: modelAlias, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
  }
  providerDownUntil.delete(name); // healthy again on any success
  const body = await res.json();
  const usage = body.usage ?? {};
  const parsed = CoachingResponse.safeParse(
    JSON.parse(body.choices?.[0]?.message?.content ?? 'null'),
  );
  return {
    response: parsed.success ? parsed.data : null,
    model: modelAlias,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    // Micro-USD accounting from env-configured per-token rates (vendor prices drift; ADR-004).
    costUsdMicros: Math.round(
      (usage.prompt_tokens ?? 0) * Number(Deno.env.get('COST_INPUT_MICROS_PER_TOKEN') ?? 0.05) +
        (usage.completion_tokens ?? 0) * Number(Deno.env.get('COST_OUTPUT_MICROS_PER_TOKEN') ?? 0.4),
    ),
  };
}

// Embeddings must match vector(1536) in 003_embeddings.sql; providers are tried in
// order and any failure degrades to null (retrieval simply returns no chunks).
const EMBEDDING_MODELS: Record<string, { model: string; dimensions?: number }> = {
  gemini: { model: Deno.env.get('GEMINI_EMBEDDING_MODEL') ?? 'gemini-embedding-001', dimensions: 1536 },
  openai: { model: Deno.env.get('TEXT_EMBEDDING_MODEL') ?? 'text-embedding-3-small' },
};

async function embedQuery(text: string): Promise<number[] | null> {
  const order = (Deno.env.get('EMBEDDINGS_PROVIDER_ORDER') ?? 'gemini,openai').split(',');
  for (const name of order) {
    const pname = name.trim();
    const provider = PROVIDERS[pname];
    const spec = EMBEDDING_MODELS[pname];
    if (!provider?.key || !spec || !providerHealthy(pname)) continue;
    try {
      const res = await fetch(`${provider.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { authorization: `Bearer ${provider.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: spec.model, input: text, ...(spec.dimensions ? { dimensions: spec.dimensions } : {}) }),
      });
      if (!res.ok) {
        noteProviderFailure(pname, res.status);
        continue;
      }
      const embedding = (await res.json()).data?.[0]?.embedding ?? null;
      if (Array.isArray(embedding) && embedding.length === 1536) return embedding;
    } catch {
      noteProviderFailure(pname, null); // unreachable — cool down, try the next
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  // A4: correlation id exists before any decision so every refusal is traceable.
  let requestId: string = crypto.randomUUID();
  if (req.method !== 'POST') {
    return refuse(req, 405, 'METHOD_NOT_ALLOWED', 'method not allowed', requestId);
  }
  const started = performance.now();

  // 1. Auth: user JWT required.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const db = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: authError } = await db.auth.getUser(jwt);
  if (authError || !userData?.user) {
    return refuse(req, 401, 'AUTH_REQUIRED', 'authentication required', requestId);
  }

  // 2. Validate payload at the boundary.
  const parsed = AssistRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return refuse(req, 400, 'INVALID_REQUEST', 'invalid assist request', requestId);
  }
  const request = parsed.data;
  // Client-supplied correlation id wins so the desktop service can trace end to end.
  requestId = request.request_id ?? requestId;
  const clientVersion = request.client_version ?? null;

  // 3. Session ownership + title gate (compliance is a query, not a convention).
  const { data: session } = await db
    .from('sessions')
    .select('id, user_id')
    .eq('id', request.session_id)
    .single();
  if (!session || session.user_id !== userData.user.id) {
    return refuse(req, 403, 'SESSION_NOT_OWNED', 'session not owned by caller', requestId);
  }

  // A4 rate limit: sliding 60s window per user across all their sessions.
  // Cheap relational count — no new infrastructure, no new dependency.
  const ratePerMin = Number(Deno.env.get('ASSIST_RATE_LIMIT_PER_MIN') ?? 12);
  const { count: recentCount } = await db
    .from('advice_events')
    .select('id, sessions!inner(user_id)', { count: 'exact', head: true })
    .eq('sessions.user_id', userData.user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());
  if ((recentCount ?? 0) >= ratePerMin) {
    // No telemetry row on purpose: rate-limited rejects must not grow the very
    // table the limiter counts, or a saturated user could never recover.
    return refuse(req, 429, 'RATE_LIMITED', 'assist rate limit reached — try again shortly', requestId);
  }
  const { data: title } = await db
    .from('titles')
    .select('id, slug, runtime_eligible, compliance_status, pvp_flagged')
    .eq('id', request.title_id)
    .single();

  const telemetry = async (outcome: string, model: string, extra: Partial<Record<string, number>> = {}) => {
    await db.from('advice_events').insert({
      session_id: request.session_id,
      title_id: title?.id ?? null,
      request_id: requestId,
      client_version: clientVersion,
      mode: request.hotkey_intent,
      model,
      latency_ms: Math.round(performance.now() - started),
      input_tokens: extra.inputTokens ?? 0,
      output_tokens: extra.outputTokens ?? 0,
      cost_usd_micros: extra.costUsdMicros ?? 0,
      confidence: extra.confidence ?? 0,
      outcome,
    });
  };

  if (!title || !title.runtime_eligible || title.compliance_status !== 'cleared') {
    await telemetry('error', 'none');
    return refuse(
      req,
      403,
      'TITLE_NOT_ELIGIBLE',
      'This title has not passed the GamePointAgent compliance gate for live coaching.',
      requestId,
    );
  }

  const deliver = async (
    response: CoachingResponse,
    outcome: string,
    model: string,
    usage: Partial<Record<string, number>>,
  ) => {
    const final = {
      ...response,
      latency_ms: Math.round(performance.now() - started),
      request_id: requestId, // A4: correlation survives body, row, broadcast, HUD
    };
    await db.from('coaching_responses').insert({
      session_id: request.session_id,
      title_id: title.id,
      ...final,
    });
    await telemetry(outcome, model, { ...usage, confidence: response.confidence });
    return json(req, 200, final, { 'x-gp-request-id': requestId });
  };

  try {
    // 4. Embed intent context → 5. retrieval (in-process; same relational-first SQL).
    const queryText = `${title.slug} ${request.hotkey_intent} ${request.roi_descriptors.map((r) => r.kind).join(' ')}`;
    const embedding = await embedQuery(queryText);
    let chunks: { chunk_id: string; chunk: string; trust_tier: number }[] = [];
    if (embedding) {
      const { data } = await db.rpc('retrieval_candidates', {
        p_title_id: title.id,
        p_categories: null,
        p_query_embedding: embedding,
        p_limit: Number(Deno.env.get('ASSIST_MAX_RETRIEVAL_CHUNKS') ?? 4),
      });
      chunks = data ?? [];
    }

    // 6. Prompt (stable prefix first) → 7. cascade with cost breaker.
    const { stablePrefix, volatile } = buildPrompt({
      titleSlug: title.slug,
      mode: request.hotkey_intent,
      pvpFlagged: title.pvp_flagged,
      retrievedChunks: chunks,
      intent: request.hotkey_intent,
      observables: request.local_observables,
    });

    const { model: primaryModel, tripped } = breaker.pickPrimary(aliases);
    if (tripped) console.error('cost_breaker_tripped', { rolling: breaker.rollingMeanUsdMicros });

    let result = await callVisionModel(primaryModel, stablePrefix, volatile, request.frame_b64);
    if (result.response === null) {
      // Retry once on the same alias (§1.2).
      result = await callVisionModel(primaryModel, stablePrefix, volatile, request.frame_b64);
    }
    if (result.response === null && aliases.fallback !== primaryModel) {
      // ADR-009 hybrid resilience: a full provider outage fails over to the
      // other vendor before degrading to NO_ADVICE.
      const spent = result;
      result = await callVisionModel(aliases.fallback, stablePrefix, volatile, request.frame_b64);
      result.costUsdMicros += spent.costUsdMicros;
    }
    if (
      result.response !== null &&
      !tripped &&
      shouldEscalate(result.response.confidence, request, (Deno.env.get('ASSIST_ESCALATION_ALLOWED') ?? 'false') === 'true')
    ) {
      const escalated = await callVisionModel(aliases.escalation, stablePrefix, volatile, request.frame_b64);
      if (escalated.response !== null) {
        escalated.costUsdMicros += result.costUsdMicros;
        escalated.inputTokens += result.inputTokens;
        escalated.outputTokens += result.outputTokens;
        result = escalated;
      }
    }
    breaker.record(result.costUsdMicros);

    if (result.response === null) {
      // Pre-existing defect (caught by deno check): ModelResult is not a numeric
      // record — pass the usage fields explicitly.
      return await deliver(NO_ADVICE_THIS_FRAME, 'degraded', result.model, {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsdMicros: result.costUsdMicros,
      });
    }

    // 8. Advantage Check post-filter — the second wall (§1.1.2).
    const { response, refused } = enforceAdvantageCheck(result.response, title.pvp_flagged);
    return await deliver(response, refused ? 'refused_advantage' : 'ok', result.model, {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsdMicros: result.costUsdMicros,
    });
  } catch (err) {
    console.error('assist_unhandled', { name: (err as Error).name }); // no content logged
    await telemetry('error', 'none');
    return json(req, 200, { ...NO_ADVICE_THIS_FRAME, request_id: requestId }, { 'x-gp-request-id': requestId });
  }
});
