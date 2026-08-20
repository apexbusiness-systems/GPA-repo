// GamePointAgent voice agent — local-only TTS output + closed-vocabulary, push-to-talk STT input.
// WP-6 (docs/governance/contract-audit-v1.2.md). Governed by ADR-010.
//
// Hard invariants this module must never violate:
//  - No background/passive listening: recognition only runs while the caller holds it open
//    (start() ... stop()), never on a timer or wake-word.
//  - No persistence: voice consent lives in OverlayState.voice (in-memory, state.ts), never in
//    PersistedSettings (the only slice written to localStorage).
//  - No wire-contract change: recognized intents map onto the existing HotkeyIntent enum
//    already carried by AssistRequest. audio_opus_bytes stays z.null() always — raw audio never
//    leaves this module; only a matched intent (or nothing, on no-match) does.
//  - No new cloud vendor by default: TTS uses window.speechSynthesis (OS voices via the
//    WebView2/Chromium engine). STT uses the browser SpeechRecognition API, feature-flagged off
//    (ENABLE_VOICE_INPUT) until verified local-only on real Windows hardware — see ADR-010.

import type { HotkeyIntent } from 'contracts';

// --- TTS (output) --------------------------------------------------------------------

export interface SpeechSynthesisLike {
  speak(utterance: { text: string; rate?: number; pitch?: number }): void;
  cancel(): void;
}

/**
 * Speaks `text` iff voice output is enabled, consented, and not muted. Cancels any
 * in-flight utterance first — advice is frame-cadenced (one per response), never queued,
 * so a new response always interrupts rather than stacking behind an old one.
 * Pure with respect to its inputs (the SpeechSynthesisLike is injected) — testable without a DOM.
 */
export function speakAdvice(
  synth: SpeechSynthesisLike | null,
  text: string,
  opts: { enabled: boolean; muted: boolean },
): boolean {
  if (!opts.enabled || opts.muted || !synth || !text) return false;
  synth.cancel();
  synth.speak({ text, rate: 1, pitch: 1 });
  return true;
}

export function browserSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const synth = window.speechSynthesis;
  return {
    speak: ({ text, rate, pitch }) => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (rate) utterance.rate = rate;
      if (pitch) utterance.pitch = pitch;
      synth.speak(utterance);
    },
    cancel: () => synth.cancel(),
  };
}

// --- STT (input): closed-vocabulary intent matching, never open dictation -------------

/**
 * GamePointAgent's request model is structured (HotkeyIntent), not conversational — AssistRequest
 * has no free-text query field. Voice input therefore recognizes a small, fixed phrase set and
 * maps it to the same three intents a hotkey press already sends. Anything that doesn't match
 * fails closed: no request is built, no tokens are spent, no assist-budget circuit is touched.
 */
const INTENT_PHRASES: Record<HotkeyIntent, readonly string[]> = {
  assist: ['assist', 'help', 'what should i do', "what's next", 'advice'],
  explain: ['explain', 'why', 'explain that'],
  recap: ['recap', 'summarize', 'what happened'],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word/whole-phrase match only — "recaps"/"recapture" must never match "recap",
 * and "anywhere" must never match "why". A naive substring check would defeat the point
 * of a closed vocabulary by accepting unintended words that merely contain a phrase. */
function containsWholePhrase(normalized: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(normalized);
}

export function matchVoiceIntent(transcript: string): HotkeyIntent | null {
  const normalized = transcript.trim().toLowerCase().replace(/[.?!]/g, '');
  if (!normalized) return null;
  for (const [intent, phrases] of Object.entries(INTENT_PHRASES) as [
    HotkeyIntent,
    readonly string[],
  ][]) {
    if (phrases.some((phrase) => containsWholePhrase(normalized, phrase))) {
      return intent;
    }
  }
  return null;
}

export interface RecognizerLike {
  start(): void;
  stop(): void;
  onresult: ((transcript: string) => void) | null;
  onerror: ((message: string) => void) | null;
}

/**
 * UNVERIFIED (ADR-010 §Consequences): whether the installed WebView2 runtime's
 * SpeechRecognition backend processes audio on-device or via a cloud speech service is not
 * verifiable from this sandbox (no Windows host available to test against). Defaults to false
 * so no build ships live STT to a real user until JR confirms local-only behavior on actual
 * Windows/WebView2 hardware, per ADR-010. Flip only after that verification.
 */
export const ENABLE_VOICE_INPUT = false as const;

export function browserSpeechRecognizer(): RecognizerLike | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition ??
    null;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.continuous = false; // one utterance per hold — never continuous/background
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const wrapper: RecognizerLike = {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    onresult: null,
    onerror: null,
  };
  recognition.onresult = (event: any) => {
    const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
    wrapper.onresult?.(transcript);
  };
  recognition.onerror = (event: any) => {
    wrapper.onerror?.(String(event?.error ?? 'unknown'));
  };
  return wrapper;
}
