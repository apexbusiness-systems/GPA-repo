import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RouteLink, Sidebar, navigate, supabase, supabaseConfigured, supabaseEnv, useRoute } from './lib';
import { buildOverlayLaunchConfig } from './overlay-launch';
import { canStartSession, gateReason } from './gating.mjs';

type Playstyle = 'story' | 'mastery' | 'rank';
type CoachingMode = 'simple' | 'guided' | 'tactical' | 'pro';

interface Profile {
  user_id: string;
  playstyle: Playstyle | null;
  coaching_mode: CoachingMode;
  age_gate_passed: boolean;
  voice_opt_in: boolean;
}

interface TitleRow {
  id: string;
  slug: string;
  display_name: string;
  publisher: string;
  anti_cheat_class: string;
  compliance_status: string;
  runtime_eligible: boolean;
  wave: number;
}

interface SessionRow {
  id: string;
  started_at: string;
  title_id?: string | null;
  titles: { display_name: string; slug?: string } | null;
}

interface AdviceEventRow {
  latency_ms: number;
  confidence: number;
  outcome: string;
}

const MODES: CoachingMode[] = ['simple', 'guided', 'tactical', 'pro'];
// Coach Squad is a brand layer over one coaching engine (one `coaching_mode` field) —
// each display coach maps 1:1 to a backing mode. There is no coach_id/persona routing
// and no multi-agent backend; selecting a coach just changes tone/explanation style.
const COACHES = [
  { name: 'Maya', role: 'The Anchor', image: '/art/portrait-maya.png', cue: 'Calm reads and tilt control.', mode: 'simple' as CoachingMode },
  { name: 'Ro', role: 'The Shotcaller', image: '/art/portrait-ro.png', cue: 'Decisive calls when it matters.', mode: 'guided' as CoachingMode },
  { name: 'Niko', role: 'The Analyst', image: '/art/portrait-niko.png', cue: 'Patterns and matchup analysis.', mode: 'tactical' as CoachingMode },
  { name: 'June', role: 'The Builder', image: '/art/portrait-june.png', cue: 'Long-term skill construction.', mode: 'pro' as CoachingMode },
] as const;

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

export function SessionFooter(): React.JSX.Element {
  const session = useSession();
  if (session === undefined) return <div className="player-card"><div><span>…</span></div></div>;
  if (session === null) {
    return (
      <RouteLink to="/app" className="player-card player-card-link">
        <div><strong>Guest</strong><span>Sign in →</span></div>
      </RouteLink>
    );
  }
  return (
    <RouteLink to="/app" className="player-card player-card-link">
      <div><strong>{session.user.email?.split('@')[0] ?? 'Player'}</strong><span>Open dashboard →</span></div>
    </RouteLink>
  );
}

function Field(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return <label className="field"><span>{props.label}</span>{props.children}</label>;
}

function Login(): React.JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else if (!data.session) setNotice('Account created. Check your inbox for the confirmation email, then sign in.');
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <form className="panel auth-card" onSubmit={(e) => { void submit(e); }}>
        <div className="brand"><img alt="GamePointAgent" className="brand-wordmark" src="/art/gpa-wordmark.png" /></div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
        <p className="muted">Screen-only coaching. No game injection. Consent required before capture.</p>
        <Field label="Email">
          <input autoComplete="email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
        </Field>
        <Field label="Password">
          <input autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
        </Field>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {notice ? <p className="form-notice" role="status">{notice}</p> : null}
        <button disabled={busy} type="submit">{busy ? 'Working…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}</button>
        <button className="ghost-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }} type="button">
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <RouteLink className="muted-link" to="/">← Back to overview</RouteLink>
      </form>
    </div>
  );
}

function Onboarding(props: { userId: string; onDone: (p: Profile) => void }): React.JSX.Element {
  const [playstyle, setPlaystyle] = useState<Playstyle>('mastery');
  const [coachingMode, setCoachingMode] = useState<CoachingMode>('guided');
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true); setError(null);
    const row = { user_id: props.userId, playstyle, coaching_mode: coachingMode, age_gate_passed: ageOk, voice_opt_in: false };
    const { data, error: err } = await supabase.from('profiles').upsert(row).select().single();
    if (err) { setError(err.message); setBusy(false); return; }
    props.onDone(data as Profile);
  };

  return (
    <div className="auth-wrap">
      <form className="panel auth-card" onSubmit={(e) => { void submit(e); }}>
        <h1>What are you playing for?</h1>
        <p className="muted">One answer sets your coaching defaults. Change it anytime in Settings.</p>
        <div className="choice-row" role="radiogroup" aria-label="Playstyle">
          {(['story', 'mastery', 'rank'] as Playstyle[]).map((p) => (
            <button aria-pressed={playstyle === p} className={playstyle === p ? 'choice active' : 'choice'} key={p} onClick={() => setPlaystyle(p)} type="button">{p}</button>
          ))}
        </div>
        <Field label="Coaching mode">
          <select onChange={(e) => setCoachingMode(e.target.value as CoachingMode)} value={coachingMode}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <label className="check">
          <input checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} required type="checkbox" />
          <span>I confirm I am 13 or older.</span>
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button disabled={busy || !ageOk} type="submit">{busy ? 'Saving…' : 'Enter GamePointAgent →'}</button>
      </form>
    </div>
  );
}

function Gate(props: { title: string; body: string; facts: string[] }): React.JSX.Element {
  return (
    <section className="panel gate-panel">
      <div className="panel-head"><h2>{props.title}</h2><span className="gate-chip">NOT YET AVAILABLE</span></div>
      <p>{props.body}</p>
      <ul>{props.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      <RouteLink className="muted-link" to="/app">← Back to dashboard</RouteLink>
    </section>
  );
}

function Dashboard(props: { profile: Profile; email: string }): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('sessions').select('id, started_at, titles(display_name)').order('started_at', { ascending: false }).limit(5)
      .then(({ data, error: err }) => { if (err) setError(err.message); else setSessions((data ?? []) as unknown as SessionRow[]); });
  }, []);
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head"><h2>Welcome back</h2></div>
        <p><strong>{props.email}</strong> · playing for <strong>{props.profile.playstyle ?? 'unset'}</strong> · <strong>{props.profile.coaching_mode}</strong> coaching</p>
        <div className="cta-row">
          <button onClick={() => navigate('/app/sessions')} type="button">Start a session →</button>
          <button className="ghost-button" onClick={() => navigate('/app/settings')} type="button">Settings</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Recent sessions</h2></div>
        {error ? <p className="form-error">{error}</p> : sessions === null ? <p className="muted">Loading…</p> : sessions.length === 0
          ? <p className="muted">No sessions yet. Start one from the Sessions tab — cleared titles only.</p>
          : <ul className="row-list">{sessions.map((s) => <li key={s.id}><strong>{s.titles?.display_name ?? 'Unassigned title'}</strong><span>{new Date(s.started_at).toLocaleString()}</span></li>)}</ul>}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Boundaries that hold</h2></div>
        <ul className="row-list compact">
          <li>No game injection · screen-vision only</li>
          <li>Consent required before capture</li>
          <li>Voice/audio: Disabled in v1.0</li>
          <li>Not runtime supported until cleared — see title registry in Sessions</li>
        </ul>
      </section>
    </div>
  );
}

function Sessions(props: { userId: string }): React.JSX.Element {
  const [titles, setTitles] = useState<TitleRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [picked, setPicked] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // A3: export the validated overlay handoff config for a real session.
  const copyLaunchConfig = async (s: SessionRow): Promise<void> => {
    if (!supabaseEnv || !s.title_id || !s.titles?.slug) return;
    try {
      const encoded = buildOverlayLaunchConfig({
        sessionId: s.id,
        titleId: s.title_id,
        titleSlug: s.titles.slug,
        supabaseUrl: supabaseEnv.url,
        publishableKey: supabaseEnv.publishableKey,
      });
      await navigator.clipboard.writeText(encoded);
      setCopied(s.id);
      window.setTimeout(() => setCopied((prev) => (prev === s.id ? null : prev)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build overlay config.');
    }
  };

  const load = useCallback((): void => {
    void supabase.from('titles').select('id, slug, display_name, publisher, anti_cheat_class, compliance_status, runtime_eligible, wave').order('wave').order('display_name')
      .then(({ data, error: err }) => { if (err) setError(err.message); else setTitles((data ?? []) as TitleRow[]); });
    void supabase.from('sessions').select('id, started_at, title_id, titles(display_name, slug)').order('started_at', { ascending: false }).limit(20)
      .then(({ data, error: err }) => { if (err) setError(err.message); else setSessions((data ?? []) as unknown as SessionRow[]); });
  }, []);
  useEffect(load, [load]);

  const startable = useMemo(() => (titles ?? []).filter((t) => canStartSession(t)), [titles]);

  const start = async (): Promise<void> => {
    if (!picked) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('sessions').insert({ user_id: props.userId, title_id: picked });
    if (err) setError(err.message);
    setBusy(false); load();
  };

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head"><h2>Start a session</h2></div>
        <p className="muted">Sessions log coaching runs against a cleared title. Live capture requires the desktop overlay (not yet distributed) — web sessions record the registry entry only.</p>
        <div className="cta-row">
          <select aria-label="Choose a cleared title" onChange={(e) => setPicked(e.target.value)} value={picked}>
            <option value="">Choose a cleared title…</option>
            {startable.map((t) => <option key={t.id} value={t.id}>{t.display_name} — {t.publisher}</option>)}
          </select>
          <button disabled={busy || !picked} onClick={() => { void start(); }} type="button">{busy ? 'Starting…' : 'Start session →'}</button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Title registry</h2></div>
        {titles === null ? <p className="muted">Loading…</p> : (
          <ul className="row-list">
            {titles.map((t) => (
              <li key={t.id}>
                <strong>{t.display_name}</strong>
                <span>{t.publisher} · anti-cheat: {t.anti_cheat_class}</span>
                {canStartSession(t) ? <em className="ok-chip">cleared · runtime eligible</em> : <em className="gate-chip">{gateReason(t)}</em>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Your sessions</h2></div>
        {sessions === null ? <p className="muted">Loading…</p> : sessions.length === 0
          ? <p className="muted">No sessions logged yet.</p>
          : <ul className="row-list">{sessions.map((s) => (
              <li key={s.id}>
                <strong>{s.titles?.display_name ?? 'Unassigned title'}</strong>
                <span>{new Date(s.started_at).toLocaleString()}</span>
                {supabaseEnv && s.title_id && s.titles?.slug ? (
                  <button className="ghost-button" onClick={() => { void copyLaunchConfig(s); }} type="button">
                    {copied === s.id ? 'Copied ✓' : 'Copy overlay config'}
                  </button>
                ) : null}
              </li>
            ))}</ul>}
        <p className="muted">Overlay config binds the desktop overlay to one session — paste it into the overlay launch prompt. It contains only browser-safe values.</p>
      </section>
    </div>
  );
}

function Coaches(props: { profile: Profile; onProfile: (p: Profile) => void }): React.JSX.Element {
  const [busy, setBusy] = useState<CoachingMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setMode = async (m: CoachingMode): Promise<void> => {
    setBusy(m); setError(null);
    const { data, error: err } = await supabase.from('profiles').update({ coaching_mode: m }).eq('user_id', props.profile.user_id).select().single();
    if (err) setError(err.message); else props.onProfile(data as Profile);
    setBusy(null);
  };
  const active = COACHES.find((c) => c.mode === props.profile.coaching_mode);
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head"><h2>Coach Squad</h2></div>
        <p className="muted">Coach Squad changes tone and explanation style. It does not run four separate agents — one coaching engine, four ways of talking to you. Pick the one that fits.</p>
        <div className="coach-row">
          {COACHES.map((c) => (
            <button
              aria-pressed={props.profile.coaching_mode === c.mode}
              className={props.profile.coaching_mode === c.mode ? 'coach-tile active' : 'coach-tile'}
              disabled={busy !== null}
              key={c.name}
              onClick={() => { void setMode(c.mode); }}
              type="button"
            >
              <img alt={`${c.name}, ${c.role}`} src={c.image} />
              <span className="coach-caption"><strong>{c.name}</strong><span>{c.role}</span><small>{busy === c.mode ? 'Saving…' : c.cue}</small></span>
            </button>
          ))}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Active coaching mode</h2></div>
        <p><strong>{active ? `${active.name} — ${active.role}` : 'Custom'}</strong> · <code>{props.profile.coaching_mode}</code></p>
      </section>
    </div>
  );
}

function Insights(): React.JSX.Element {
  const [events, setEvents] = useState<AdviceEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('advice_events').select('latency_ms, confidence, outcome').limit(500)
      .then(({ data, error: err }) => { if (err) setError(err.message); else setEvents((data ?? []) as AdviceEventRow[]); });
  }, []);
  const agg = useMemo(() => {
    if (!events || events.length === 0) return null;
    const n = events.length;
    return {
      n,
      latency: Math.round(events.reduce((a, e) => a + e.latency_ms, 0) / n),
      confidence: (events.reduce((a, e) => a + e.confidence, 0) / n).toFixed(2),
      ok: events.filter((e) => e.outcome === 'ok').length,
    };
  }, [events]);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Insights</h2></div>
      {error ? <p className="form-error">{error}</p> : events === null ? <p className="muted">Loading…</p> : agg === null
        ? <p className="muted">No coaching telemetry yet. Advice events are recorded when the desktop overlay runs a live session — nothing is simulated here.</p>
        : <ul className="row-list compact">
            <li>Advice events: <strong>{agg.n}</strong></li>
            <li>Median-ish latency: <strong>{agg.latency} ms</strong></li>
            <li>Avg confidence: <strong>{agg.confidence}</strong></li>
            <li>OK outcomes: <strong>{agg.ok}/{agg.n}</strong></li>
          </ul>}
    </section>
  );
}

function Settings(props: { profile: Profile; email: string; onProfile: (p: Profile) => void }): React.JSX.Element {
  const [playstyle, setPlaystyle] = useState<Playstyle>(props.profile.playstyle ?? 'mastery');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async (): Promise<void> => {
    setBusy(true); setError(null); setSaved(false);
    const { data, error: err } = await supabase.from('profiles').update({ playstyle }).eq('user_id', props.profile.user_id).select().single();
    if (err) setError(err.message); else { props.onProfile(data as Profile); setSaved(true); }
    setBusy(false);
  };
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head"><h2>Account</h2></div>
        <p><strong>{props.email}</strong></p>
        <div className="cta-row">
          <Field label="Playing for">
            <select onChange={(e) => setPlaystyle(e.target.value as Playstyle)} value={playstyle}>
              {(['story', 'mastery', 'rank'] as Playstyle[]).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <button disabled={busy} onClick={() => { void save(); }} type="button">{busy ? 'Saving…' : 'Save'}</button>
        </div>
        {saved ? <p className="form-notice" role="status">Saved.</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Consent & capture</h2></div>
        <ul className="row-list compact">
          <li>Screen capture consent: <strong>collected per session in the desktop overlay</strong> — consent required before capture, always.</li>
          <li>Age gate: <strong>{props.profile.age_gate_passed ? 'passed (13+)' : 'not confirmed'}</strong></li>
        </ul>
        <label className="check disabled">
          <input checked={false} disabled type="checkbox" />
          <span>Voice/audio capture — <strong>Disabled in v1.0</strong> (schema-ready, dark by policy)</span>
        </label>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Session</h2></div>
        <button className="ghost-button" onClick={() => { void supabase.auth.signOut().then(() => navigate('/')); }} type="button">Sign out</button>
      </section>
    </div>
  );
}

export function AppRoot(): React.JSX.Element {
  const path = useRoute();
  const session = useSession();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    if (!session) { setProfile(undefined); return; }
    void supabase.from('profiles').select('*').maybeSingle()
      .then(({ data }) => setProfile((data as Profile | null) ?? null));
  }, [session]);

  // Auth-configuration gate — checked after all hooks to satisfy React rules.
  // VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in the deployment
  // environment (Cloudflare Workers Builds → Settings → Environment Variables).
  if (!supabaseConfigured) {
    return (
      <main className="cockpit app-cockpit">
        <Sidebar footer={null} />
        <div className="workspace app-workspace">
          <section className="panel gate-panel" id="auth-not-configured">
            <div className="panel-head">
              <h2>Auth not configured</h2>
              <span className="gate-chip">ENV MISSING</span>
            </div>
            <p>
              <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> must be set in the deployment
              environment. Add them to Cloudflare Workers Builds{' '}
              <strong>Settings → Environment Variables</strong> and redeploy, or set them
              in your local <code>.env</code> file.
            </p>
            <RouteLink className="muted-link" to="/">← Back to overview</RouteLink>
          </section>
        </div>
      </main>
    );
  }

  if (session === undefined) return <div className="auth-wrap"><p className="muted">Loading…</p></div>;
  if (session === null) return <Login />;
  if (profile === undefined) return <div className="auth-wrap"><p className="muted">Loading your profile…</p></div>;
  if (profile === null) return <Onboarding onDone={setProfile} userId={session.user.id} />;

  const email = session.user.email ?? 'you';
  const downloadUrl = import.meta.env.VITE_GAMEPOINT_DOWNLOAD_URL as string | undefined;
  let view: React.JSX.Element;
  if (path === '/app' || path === '/app/') view = <Dashboard email={email} profile={profile} />;
  else if (path.startsWith('/app/sessions')) view = <Sessions userId={session.user.id} />;
  else if (path.startsWith('/app/coaches')) view = <Coaches onProfile={setProfile} profile={profile} />;
  else if (path.startsWith('/app/insights')) view = <Insights />;
  else if (path.startsWith('/app/settings')) view = <Settings email={email} onProfile={setProfile} profile={profile} />;
  else if (path.startsWith('/app/overlay')) view = downloadUrl ? (
    <section className="panel gate-panel" id="live-overlay-ready">
      <div className="panel-head">
        <h2>Live Overlay</h2>
        <span className="ok-chip">WINDOWS INSTALLER READY</span>
      </div>
      <p>The live overlay is a desktop application that captures your screen with consent and renders coach callouts in a PiP HUD.</p>
      <div className="cta-row" style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
        <a
          className="download-cta"
          href={downloadUrl}
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.75rem 1.5rem',
            background: 'var(--lime)',
            color: '#030402',
            fontWeight: 'bold',
            borderRadius: '4px',
            textDecoration: 'none',
          }}
          target="_blank"
        >
          <span>Download Windows Overlay (.exe) ↓</span>
        </a>
      </div>
      <ul>
        <li>No game injection — OS-level screen capture only</li>
        <li>Consent required before capture</li>
        <li>Voice/audio: Disabled in v1.0</li>
        <li>Not runtime supported until cleared per title</li>
      </ul>
      <RouteLink className="muted-link" to="/app">← Back to dashboard</RouteLink>
    </section>
  ) : (
    <Gate
      body="The live overlay is a desktop application that captures your screen with consent and renders coach callouts in a PiP HUD. It is not yet distributed — no download is offered because none is ready."
      facts={['No game injection — OS-level screen capture only', 'Consent required before capture', 'Voice/audio: Disabled in v1.0', 'Not runtime supported until cleared per title']}
      title="Live Overlay"
    />
  );
  else if (path.startsWith('/app/replay')) view = (
    <Gate
      body="Replay Review analyzes captures recorded by the desktop overlay. Until the overlay ships, there are no captures to review — this page will not fake one."
      facts={['Heatmaps and key moments are computed from your own consented captures', 'No third-party VOD scraping']}
      title="Replay Review"
    />
  );
  else if (path.startsWith('/app/community')) view = (
    <Gate
      body="Community opens after v1.0 launch. No seeded posts, no bots — it starts when real players arrive."
      facts={['Feed, LFG, and events land here', 'Moderation and 13+ policy apply from day one']}
      title="Community"
    />
  );
  else view = (
    <section className="panel gate-panel">
      <div className="panel-head"><h2>Not found</h2></div>
      <p>That page does not exist.</p>
      <RouteLink className="muted-link" to="/app">← Back to dashboard</RouteLink>
    </section>
  );

  return (
    <main className="cockpit app-cockpit">
      <Sidebar footer={<SessionFooter />} />
      <div className="workspace app-workspace">
        {view}
        <footer>
          <span><i /> Screen-only coaching</span>
          <span>No game injection · Not runtime supported until cleared</span>
          <span className="footer-legal">
            <RouteLink to="/privacy">Privacy Policy</RouteLink> · <RouteLink to="/terms">Terms of Service</RouteLink>
          </span>
          <span>v1.2.0</span>
        </footer>
      </div>
    </main>
  );
}
