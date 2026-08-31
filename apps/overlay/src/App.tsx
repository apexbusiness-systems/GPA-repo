import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from './tauri-bridge';
import {
  Action,
  confidenceTier,
  initialState,
  loadSettings,
  OverlayState,
  personaLabel,
  Playstyle,
  reduce,
  splitNotVerified,
  useVoiceAgentState,
} from './state';
import { demoScript, FixtureResponseSource, makeResponseSource } from './realtime';
import { resolveBinding } from './config';
import {
  browserSpeechRecognizer,
  browserSpeechSynthesis,
  ENABLE_VOICE_INPUT,
  matchVoiceIntent,
  speakAdvice,
} from './voice-agent';
import { VoiceOrb } from './components/VoiceOrb';
import { CoachCard } from './components/CoachCard';

// --- Screens -----------------------------------------------------------------------

function ConsentScreen({ dispatch }: { dispatch: React.Dispatch<Action> }) {
  const [ofAge, setOfAge] = React.useState(false);
  return (
    <section className="card flow gpa-hud-card max-w-md pointer-events-auto" aria-labelledby="consent-title">
      <h1 id="consent-title" className="gpa-text-primary text-base font-bold">Before GamePointAgent can coach you</h1>
      <p className="metaphor gpa-text-secondary text-xs leading-relaxed">
        GamePointAgent is the coach in your corner: it watches the fight, it never touches the
        controls.
      </p>
      <ul className="plain gpa-text-secondary text-xs">
        <li><strong>What is captured:</strong> your screen, only while capture is on, only when you press the assist hotkey.</li>
        <li><strong>What leaves this device:</strong> a single frame per assist, sent encrypted for analysis, processed in memory and discarded after the answer.</li>
        <li><strong>What is kept:</strong> nothing by default — no frames, no recordings, no chat, no usernames.</li>
        <li><strong>Voice:</strong> off by default. If you turn it on in Settings, GamePointAgent can speak advice aloud and listen only while you hold the talk button — never in the background, and it asks again every session.</li>
        <li><strong>Anti-cheat note:</strong> GamePointAgent never touches game processes, but any third-party overlay can draw a false-positive review on kernel anti-cheat titles. Read the per-title notes before ranked play.</li>
      </ul>
      <label className="check gpa-text-primary text-xs">
        <input type="checkbox" checked={ofAge} onChange={(e) => setOfAge(e.target.checked)} />
        I am 13 or older (required)
      </label>
      <button
        className="primary gpa-target-min"
        disabled={!ofAge}
        onClick={() =>
          dispatch({ type: 'consent/accept', ageGatePassed: ofAge, now: new Date().toISOString() })
        }
      >
        I understand — enable GamePointAgent
      </button>
    </section>
  );
}

function PersonaScreen({ dispatch }: { dispatch: React.Dispatch<Action> }) {
  const options: { value: Playstyle; label: string; hint: string }[] = [
    { value: 'story', label: 'Story', hint: 'Gentle nudges, no spoilers, immersion first' },
    { value: 'mastery', label: 'Mastery', hint: 'Deep mechanics, builds, and why — not just what' },
    { value: 'rank', label: 'Rank', hint: 'Terse, macro-focused calls for climbing' },
  ];
  return (
    <section className="card flow gpa-hud-card max-w-md pointer-events-auto" aria-labelledby="persona-title">
      <h1 id="persona-title" className="gpa-text-primary text-base font-bold">What are you playing for?</h1>
      <p className="muted gpa-text-secondary text-xs">One answer sets tone, depth, and pace everywhere. Change it anytime.</p>
      <div className="persona-grid" role="radiogroup" aria-label="Coaching style">
        {options.map((o) => (
          <button
            key={o.value}
            className="persona-option gpa-target-min"
            onClick={() => dispatch({ type: 'persona/set', playstyle: o.value })}
          >
            <strong>{o.label}</strong>
            <span className="muted text-xs">{o.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AdviceBody({ state }: { state: OverlayState }) {
  const { hud } = state;
  switch (hud.kind) {
    case 'idle':
      return (
        <p className="muted gpa-text-secondary text-xs">
          {state.captureActive
            ? 'Press your assist hotkey at any decision point.'
            : 'Nothing is being watched. Start capture when you are ready.'}
        </p>
      );
    case 'thinking':
      return <p className="muted pulse gpa-text-accent text-xs">Reading the frame…</p>;
    case 'degraded':
      return (
        <p className="muted gpa-text-secondary text-xs">
          No advice this frame — the decision point wasn’t clear. Try again with the relevant
          UI on screen.
        </p>
      );
    case 'refused':
      return (
        <p className="gpa-text-secondary text-xs">
          <span className="badge policy">Coaching only</span> GamePointAgent won’t call out live
          opponent info you couldn’t see yourself. Ask about builds, timers, or strategy instead.
        </p>
      );
    case 'offline':
      return (
        <p className="muted gpa-text-secondary text-xs">
          Offline — {hud.queued} request{hud.queued === 1 ? '' : 's'} queued. They’ll send when
          the connection returns.
        </p>
      );
    case 'unsupported':
      return (
        <p className="gpa-text-secondary text-xs">
          <span className="badge warn">Unverified title</span>{' '}
          {hud.titleName ?? 'This game'} hasn’t passed GamePointAgent’s compliance review, so live
          coaching is off. General questions still work in the companion app.
        </p>
      );
    case 'advice': {
      const { prefix, body } = splitNotVerified(hud.response.advice_text);
      return (
        <div className="flow-tight">
          <p className="advice gpa-text-primary text-xs">
            {prefix && <span className="badge warn">{prefix}</span>} {body}
          </p>
          {hud.response.recommended_action !== 'none' && (
            <p className="action gpa-text-accent text-xs font-mono font-bold">→ {hud.response.recommended_action}</p>
          )}
        </div>
      );
    }
  }
}

/** Tier-1 status word: absolute certainty of what the system is doing right now. */
function statusWord(state: OverlayState): string {
  if (state.captureLocked) return 'Capture locked';
  if (state.hud.kind === 'offline') return 'Offline';
  return state.captureActive ? 'Watching' : 'Capture off';
}

function VoiceTalkButton({ state, dispatch }: { state: OverlayState; dispatch: React.Dispatch<Action> }) {
  const recognizerRef = useRef(ENABLE_VOICE_INPUT ? browserSpeechRecognizer() : null);

  const start = useCallback(() => {
    dispatch({ type: 'voice/ptt-start' });
    const recognizer = recognizerRef.current;
    if (!recognizer) {
      dispatch({ type: 'voice/error', message: 'Voice input isn’t available in this build yet.' });
      return;
    }
    recognizer.onresult = (transcript) => {
      const intent = matchVoiceIntent(transcript);
      if (intent) {
        dispatch({ type: 'voice/intent-recognized', intent, nowMs: Date.now() });
      } else {
        dispatch({ type: 'voice/error', message: `Didn’t catch that — try “assist”, “explain”, or “recap”.` });
      }
    };
    recognizer.onerror = (message) => dispatch({ type: 'voice/error', message });
    recognizer.start();
  }, [dispatch]);

  const stop = useCallback(() => {
    recognizerRef.current?.stop();
    dispatch({ type: 'voice/ptt-end' });
  }, [dispatch]);

  return (
    <div className="voice-talk">
      <button
        className="ghost gpa-target-min"
        aria-pressed={state.voice.listening}
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={() => state.voice.listening && stop()}
        onTouchStart={start}
        onTouchEnd={stop}
      >
        <span className={`mic-indicator ${state.voice.listening ? 'on' : ''}`} aria-hidden="true" />
        {state.voice.listening ? 'Listening…' : 'Hold to talk'}
      </button>
      {state.voice.lastError && <p className="muted voice-error">{state.voice.lastError}</p>}
    </div>
  );
}

function Hud({ state, dispatch }: { state: OverlayState; dispatch: React.Dispatch<Action> }) {
  const advice = state.hud.kind === 'advice' ? state.hud.response : null;
  const tier = advice ? confidenceTier(advice.confidence) : null;

  const synth = useMemo(() => browserSpeechSynthesis(), []);
  useEffect(() => {
    if (state.hud.kind !== 'advice') return;
    speakAdvice(synth, state.hud.response.advice_text, {
      enabled: state.voice.consented && state.voice.outputEnabled,
      muted: state.settings.muted,
    });
  }, [state.hud.kind === 'advice' ? state.hud.receivedAt : null]);

  return (
    <section className="card flow gpa-hud-card max-w-md pointer-events-auto" aria-label="GamePointAgent coaching HUD">
      <header className="hud-bar">
        <span className="status" role="status">
          <span
            className={`capture-indicator ${state.captureActive ? 'on' : ''}`}
            aria-hidden="true"
          />
          {statusWord(state)}
        </span>
        <span className="spacer" />
        <button
          className="ghost gpa-target-min"
          aria-pressed={state.settings.muted}
          onClick={() => dispatch({ type: 'mute/toggle' })}
        >
          {state.settings.muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          className="ghost gpa-target-min"
          disabled={state.captureLocked}
          title={state.captureLocked ? 'Session config was refused — relaunch from the web app.' : undefined}
          onClick={() => dispatch({ type: 'capture/toggle' })}
        >
          {state.captureLocked ? 'Capture locked' : state.captureActive ? 'Pause' : 'Start capture'}
        </button>
      </header>

      <div aria-live="polite" className="advice-region">
        <AdviceBody state={state} />
      </div>

      {state.voice.consented && <VoiceTalkButton state={state} dispatch={dispatch} />}

      {advice && (
        <footer className="hud-bar chips">
          <span className={`chip conf-${tier}`}>
            <span className="chip-dot" aria-hidden="true" /> Confidence: {tier}
          </span>
          <span className="chip">
            Evidence: {advice.evidence_ids.length > 0 ? `${advice.evidence_ids.length} source${advice.evidence_ids.length === 1 ? '' : 's'}` : 'none'}
          </span>
          {advice.request_id && (
            <span className="chip" title={advice.request_id}>
              req {advice.request_id.slice(0, 8)}
            </span>
          )}
        </footer>
      )}

      <details className="settings">
        <summary>Session &amp; settings</summary>
        <div className="flow-tight">
          {state.settings.playstyle && (
            <p className="muted">
              Coaching style: <span className="badge subtle">{personaLabel(state.settings.playstyle)}</span>
            </p>
          )}
          <p className="muted">
            This session: {state.session.adviceCount} tip{state.session.adviceCount === 1 ? '' : 's'} ·{' '}
            {state.session.verifiedCount} evidence-backed · {state.session.refusals} refused by
            policy
          </p>
          <label className="row">
            HUD opacity
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.05}
              value={state.settings.hudOpacity}
              onChange={(e) => dispatch({ type: 'opacity/set', value: Number(e.target.value) })}
            />
          </label>

          <label className="row">
            Enable voice this session
            <input
              type="checkbox"
              checked={state.voice.consented}
              onChange={(e) => dispatch({ type: 'voice/consent-set', consented: e.target.checked })}
            />
          </label>
          {state.voice.consented && (
            <label className="row">
              Speak advice aloud
              <input
                type="checkbox"
                checked={state.voice.outputEnabled}
                onChange={() => dispatch({ type: 'voice/output-toggle' })}
              />
            </label>
          )}
          {!ENABLE_VOICE_INPUT && (
            <p className="muted">
              Voice commands (push-to-talk) are built but not yet enabled — pending a
              Windows-hardware privacy check. Speaking advice aloud works today.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

export const App: React.FC = () => {
  const { isListening, activeCoach, telemetry, transcript, state, dispatch, selectCoach } = useVoiceAgentState();
  const [_isInteractive, setIsInteractive] = useState<boolean>(false);
  const hudContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize Tauri OS click-through mask with interactive card bounds
  const updateClickThrough = async (interactive: boolean) => {
    try {
      await invoke('set_ignore_cursor_events', { ignore: !interactive });
      setIsInteractive(interactive);
    } catch (err) {
      console.warn('Window click-through state update:', err);
    }
  };

  const binding = useMemo(() => resolveBinding(typeof window !== 'undefined' ? window.location.search : ''), []);
  const sourceRef = useRef(
    makeResponseSource(
      import.meta.env,
      binding.mode === 'configured'
        ? { url: binding.config.supabase_url, key: binding.config.publishable_key }
        : undefined,
    ),
  );
  const sessionId = useMemo(
    () => (binding.mode === 'configured' ? binding.config.session_id : crypto.randomUUID()),
    [binding],
  );

  useEffect(() => {
    if (binding.mode === 'invalid') dispatch({ type: 'binding/refused' });
  }, [binding.mode, dispatch]);

  useEffect(() => {
    if (binding.mode === 'invalid') return;
    if (state.screen !== 'hud' || !state.captureActive) return;
    const unsubscribe = sourceRef.current.subscribe(sessionId, (response) =>
      dispatch({ type: 'response/received', response, nowMs: Date.now() }),
    );
    return unsubscribe;
  }, [state.screen, state.captureActive, sessionId, binding.mode, dispatch]);

  const demoHotkey = useCallback(() => dispatch({ type: 'hotkey/pressed', nowMs: Date.now() }), [dispatch]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9' && sourceRef.current instanceof FixtureResponseSource) demoHotkey();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [demoHotkey]);

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-transparent select-none pointer-events-none p-6 flex flex-col justify-between"
      style={{ minWidth: '100vw', minHeight: '100vh', opacity: state.settings.hudOpacity }}
    >
      {/* Top Telemetry Bar */}
      <header className="flex justify-between items-start w-full pointer-events-none">
        <div
          className="pointer-events-auto bg-slate-950/90 border border-slate-800/80 rounded-lg px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-3"
          onMouseEnter={() => updateClickThrough(true)}
          onMouseLeave={() => updateClickThrough(false)}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              telemetry.wsConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'
            }`}
          />
          <span className="gpa-telemetry-badge text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            {statusWord(state)}: {telemetry.wsConnected ? `LINKED (${telemetry.latencyMs}ms)` : 'OFFLINE'}
          </span>
          <span className="text-xs font-mono text-slate-400">|</span>
          <span className="text-xs font-mono text-amber-400 font-bold uppercase">
            COACH: {activeCoach.name}
          </span>
        </div>

        {binding.mode === 'invalid' && (
          <div className="binding-banner refused pointer-events-auto" role="alert">
            Session config refused: {binding.error}. Launch the overlay from the GamePointAgent web app.
          </div>
        )}
        {binding.mode === 'configured' && (
          <div className="binding-banner bound pointer-events-auto">
            Bound to session {binding.config.session_id.slice(0, 8)}… · {binding.config.title_slug}
          </div>
        )}
      </header>

      {/* Screen Modals or Overlays */}
      {state.screen === 'consent' && (
        <div
          className="pointer-events-auto flex justify-center items-center my-auto"
          onMouseEnter={() => updateClickThrough(true)}
          onMouseLeave={() => updateClickThrough(false)}
        >
          <ConsentScreen dispatch={dispatch} />
        </div>
      )}

      {state.screen === 'persona' && (
        <div
          className="pointer-events-auto flex justify-center items-center my-auto"
          onMouseEnter={() => updateClickThrough(true)}
          onMouseLeave={() => updateClickThrough(false)}
        >
          <PersonaScreen dispatch={dispatch} />
        </div>
      )}

      {/* Main Tactical Coaching Subsystem (HUD Screen) */}
      {state.screen === 'hud' && (
        <main className="hud-layout flex justify-between items-end w-full gap-4 pointer-events-none">
          {/* Left / Settings Dock */}
          <div
            className="pointer-events-auto max-w-md w-full"
            onMouseEnter={() => updateClickThrough(true)}
            onMouseLeave={() => updateClickThrough(false)}
          >
            <Hud state={state} dispatch={dispatch} />
          </div>

          {/* Right Coaching Dialog & Voice Orb Dock */}
          <div className="flex items-end gap-3 pointer-events-auto">
            {transcript && (
              <div
                ref={hudContainerRef}
                className="transition-all duration-150 ease-out"
                onMouseEnter={() => updateClickThrough(true)}
                onMouseLeave={() => updateClickThrough(false)}
              >
                <CoachCard
                  coach={activeCoach}
                  transcript={transcript}
                  onSwitchCoach={selectCoach}
                />
              </div>
            )}

            {/* Ergonomic Corner Voice Orb Dock */}
            <div
              className="bg-slate-950/90 border border-slate-800 rounded-full p-2.5 shadow-2xl backdrop-blur-md flex items-center justify-center cursor-pointer hover:border-amber-500/50 transition-colors"
              onMouseEnter={() => updateClickThrough(true)}
              onMouseLeave={() => updateClickThrough(false)}
            >
              <VoiceOrb
                isListening={isListening}
                amplitude={telemetry.micAmplitude}
                onToggle={() => {
                  if (!state.voice.consented) {
                    dispatch({ type: 'voice/consent-set', consented: true });
                  }
                  dispatch({
                    type: state.voice.listening ? 'voice/ptt-end' : 'voice/ptt-start',
                  });
                }}
              />
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;
export { demoScript };
