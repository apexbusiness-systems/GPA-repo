import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { RouteLink, Sidebar, navigate, useRoute } from './lib';
import { AppRoot, SessionFooter } from './app';
import { PrivacyPolicy } from './privacy';
import { TermsOfService } from './terms';

type Coach = {
  name: string;
  role: string;
  image: string;
  cue: string;
};

const coaches: Coach[] = [
  { name: 'Maya', role: 'The Anchor', image: '/art/portrait-maya.png', cue: 'Hold your position. Do not overextend.' },
  { name: 'Ro', role: 'The Shotcaller', image: '/art/portrait-ro.png', cue: 'Press the opening. Backup is close.' },
  { name: 'Niko', role: 'The Analyst', image: '/art/portrait-niko.png', cue: 'Low on resources. Regroup before the next push.' },
  { name: 'June', role: 'The Builder', image: '/art/portrait-june.png', cue: 'Set up the approach, then commit together.' },
];

const advice = [
  ['Ro', 'Good positioning. You drew attention on that side.'],
  ['Maya', 'Anchor the next push. Hold your ground.'],
  ['Niko', 'Watch your resources. A big spend is coming.'],
  ['June', 'Try a fast approach — they are grouped elsewhere.'],
];

function CoachSquad(): React.JSX.Element {
  return (
    <section className="panel squad-panel" id="coach-squad">
      <div className="panel-head">
        <div>
          <h2>Coach Squad</h2>
        </div>
      </div>
      <div className="coach-row">
        {coaches.map((coach) => (
          <article className="coach-card" key={coach.name}>
            <img src={coach.image} alt={`${coach.name}, ${coach.role}`} />
            <strong>{coach.name}</strong>
            <span>{coach.role}</span>
            <small><i /> Online</small>
          </article>
        ))}
      </div>
      <button className="ghost-button" onClick={() => navigate('/app/coaches')} type="button">All Coaches →</button>
    </section>
  );
}


function LiveCards(): React.JSX.Element {
  return (
    <div className="live-grid">
      <section className="panel score-panel">
        <div className="panel-head">
          <h2>Live Match</h2>
          <span className="live-badge">● LIVE</span>
        </div>
        <div className="score-line">
          <span className="hex">G</span>
          <strong>2 - 1</strong>
          <span className="hex opponent">G</span>
        </div>
        <button className="outline-button" onClick={() => navigate('/app/overlay')} type="button">View Overlay →</button>
      </section>

      <section className="panel advice-panel">
        <div className="panel-head">
          <h2>Advice Feed</h2>
          <span>7 new</span>
        </div>
        {advice.map(([name, text]) => {
          const coach = coaches.find((item) => item.name === name) ?? coaches[0];
          return (
            <article className="advice-item" key={text}>
              <img src={coach.image} alt="" />
              <div>
                <strong>{name}</strong>
                <p>{text}</p>
              </div>
              <time>2m</time>
            </article>
          );
        })}
      </section>

      <section className="panel session-panel">
        <div className="panel-head">
          <h2>Session Upcoming</h2>
          <span>Edit</span>
        </div>
        <div className="session-card">
          <div>
            <strong>Strategy Session</strong>
            <span>with Niko</span>
            <small>Tomorrow · 7:00 PM</small>
          </div>
          <img src="/art/portrait-niko.png" alt="" />
        </div>
        <button className="ghost-button" onClick={() => navigate('/app/sessions')} type="button">Join ↗</button>
      </section>

      <section className="panel progress-panel">
        <div className="panel-head">
          <h2>Your Progress</h2>
        </div>
        <div className="radar">
          <span>Decision<br />Making<br /><b>72</b></span>
          <span>Game<br />Sense<br /><b>68</b></span>
          <span>Mechanics<br /><b>81</b></span>
          <span>Positioning<br /><b>78</b></span>
          <div className="radar-shape" />
        </div>
        <button className="ghost-button" onClick={() => navigate('/app/insights')} type="button">Report ↗</button>
      </section>
    </div>
  );
}

function OverlayPreview(): React.JSX.Element {
  return (
    <section className="panel overlay-preview" id="live-overlay">
      <div className="panel-head">
        <h2 className="titlebar">Live Overlay Preview</h2>
        <span>⚙ ×</span>
      </div>
      <div className="game-window">
        <img className="overlay-source" src="/art/component-live-overlay.png" alt="" />
        <div className="gp-chip"><img alt="GamePointAgent" src="/art/gpa-wordmark.png" /></div>
        <div className="score-strip" aria-label="Live scoreboard">
          <span className="squad-strip"><img src="/art/portrait-ro.png" alt="" /><img src="/art/portrait-maya.png" alt="" /></span>
          <span>2</span>
          <strong>1:12</strong>
          <span>1</span>
          <span className="squad-strip"><img src="/art/portrait-niko.png" alt="" /><img src="/art/portrait-june.png" alt="" /></span>
        </div>
        <div className="coach-callout callout-left">
          <img src="/art/portrait-ro.png" alt="" />
          <div><strong>Ro</strong><small>The Shotcaller</small><span>Nice opening. Backup should be close.</span></div>
          <time>2m ago</time>
        </div>
        <div className="coach-callout callout-mid">
          <img src="/art/portrait-maya.png" alt="" />
          <div><strong>Maya</strong><small>The Anchor</small><span>Hold this position. Do not overextend.</span></div>
          <time>1m ago</time>
        </div>
        <div className="coach-callout callout-right">
          <img src="/art/portrait-niko.png" alt="" />
          <div><strong>Niko</strong><small>The Analyst</small><span>They are low on resources. Good time to press.</span></div>
          <time>1m ago</time>
        </div>
        <div className="coach-callout callout-june">
          <img src="/art/portrait-june.png" alt="" />
          <div><strong>June</strong><small>The Builder</small><span>Set up here, then commit together.</span></div>
          <time>Now</time>
        </div>
        <div className="reticle" />
        <div className="overlay-hud">
          <span>100 ◎</span>
          <img alt="GamePointAgent" src="/art/gpa-wordmark.png" />
          <span>25 / 75</span>
        </div>
      </div>
    </section>
  );
}

function ReplayAndStrategy(): React.JSX.Element {
  return (
    <div className="lower-grid">
      <section className="panel replay-panel" id="replay-review">
        <div className="panel-head">
          <div>
            <h2 className="titlebar">Replay Review</h2>
            <p>Latest Run · May 12</p>
          </div>
          <span>↻ ›</span>
        </div>
        <div className="replay-body">
          <div className="heatmap">
            <img src="/art/component-replay-review.png" alt="" />
            <span className="heat heat-a" />
            <span className="heat heat-b" />
            <span className="heat heat-c" />
            <div className="video-controls">
              <b>▶</b><b>▮▮</b><span>12:45 / 34:20</span><i />
            </div>
            <div className="event-timeline">
              <i /><i /><i /><i /><i />
            </div>
          </div>
          <div className="moments">
            <strong className="column-label">Key Moments</strong>
            {[['0:45', 'Fast start'], ['1:32', 'Objective reached'], ['2:18', 'Setup complete'], ['3:05', 'Clutch recovery']].map(([at, label]) => (
              <span className="moment" key={at}><b>{at}</b>{label}</span>
            ))}
            <strong className="column-label">Coach Notes</strong>
            <article className="coach-note">
              <img src="/art/portrait-ro.png" alt="" />
              <div><strong>Ro</strong><p>Great patience here.</p></div>
              <time>2:18</time>
            </article>
          </div>
        </div>
        <div className="panel-status"><i /> Overlay Active <em>Connected</em></div>
      </section>

      <section className="panel strategy-panel">
        <div className="panel-head">
          <h2 className="titlebar">Strategy Board</h2>
          <button className="dropdown" type="button">Default Strategy ⌄</button>
        </div>
        <div className="strategy-shell">
          <div className="tool-rail" aria-label="Strategy tools">
            {[['+', 'Add marker'], ['⌗', 'Grid snap'], ['╱', 'Draw line'], ['○', 'Draw circle'], ['□', 'Draw zone'], ['◎', 'Focus node']].map(([glyph, label]) => (
              <button key={label} type="button" aria-label={label}>{glyph}</button>
            ))}
          </div>
          <div className="board">
            <img src="/art/component-strategy-board.png" alt="" />
            <svg className="routes" viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
              <path className="arc arc-lime" d="M 62 38 C 120 6, 196 18, 236 58" />
              <path className="arc arc-lime" d="M 150 84 C 110 112, 70 116, 42 96" />
              <path className="arc arc-amber" d="M 232 66 C 200 104, 160 126, 116 128" />
              <path className="arc arc-amber" d="M 68 46 C 96 78, 128 92, 146 82" />
              <g className="marks">
                <path d="M 30 62 l 10 10 M 40 62 l -10 10" />
                <path d="M 250 108 l 10 10 M 260 108 l -10 10" />
              </g>
            </svg>
            <span className="node node-a">1</span>
            <span className="node node-b">2</span>
            <span className="node node-c">⚑</span>
          </div>
          <div className="tool-list">
            <strong>Layers</strong>
            <span>☑ Routes</span>
            <span>☑ Notes</span>
          </div>
        </div>
        <div className="panel-status"><em>Next Advice Sync</em> · 00:07</div>
      </section>

      <section className="panel community-panel" id="community">
        <div className="panel-head">
          <h2 className="titlebar">Community</h2>
          <span className="tabs" role="tablist" aria-label="Community sections">
            <b role="tab" aria-selected="true">Feed</b>
            <em role="tab" aria-selected="false">LFG</em>
            <em role="tab" aria-selected="false">Events</em>
          </span>
        </div>
        <div className="community-shell">
          <div className="feed-column">
            <label>Share an update with the community...</label>
            <article>
              <img src="/art/portrait-june.png" alt="" />
              <div>
                <strong>ClutchKid</strong>
                <small>1h ago</small>
                <p>Check out my latest review. Any tips on positioning?</p>
                <span>♡ 12   ↻ 5</span>
              </div>
            </article>
            <article>
              <img src="/art/portrait-maya.png" alt="" />
              <div>
                <strong>StrategyLab</strong>
                <small>3h ago</small>
                <p>New default warm-up routine. Works great post-patch.</p>
                <span>♡ 18   ↻ 7</span>
              </div>
            </article>
          </div>
          <div className="thread-column">
            <strong>Active Thread <em>#general</em></strong>
            {[
              ['NovaMind', 'Great win last night team!', '/art/portrait-june.png', '5m ago'],
              ['PlayerPerfect', 'That comeback in the last fight was clean.', '/art/portrait-maya.png', '9m ago'],
              ['Ro', 'Remember: communicate early, it pays off.', '/art/portrait-ro.png', '11m ago'],
              ['You', 'Thanks for the calls, Ro.', '/art/portrait-niko.png', '12m ago'],
            ].map(([author, text, avatar, when]) => (
              <span className="thread-msg" key={text}>
                <img src={avatar} alt="" />
                <span><b>{author}</b>{text}</span>
                <small>{when}</small>
              </span>
            ))}
            <button type="button">Message ▷</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DemoBar(): React.JSX.Element {
  return (
    <div className="demo-bar" role="note">
      <span className="demo-chip">PRODUCT PREVIEW</span>
      <span>Sample data — the live tools open inside the app:</span>
      <RouteLink to="/app/replay">Replay Review →</RouteLink>
      <RouteLink to="/app/overlay">Live Overlay →</RouteLink>
      <RouteLink to="/app/community">Community →</RouteLink>
    </div>
  );
}


function MarketingHero(): React.JSX.Element {
  return (
    <section className="marketing-hero">
      <div className="marketing-copy">
        <span className="demo-chip animate-enter" style={{ marginBottom: '1rem', display: 'inline-block' }}>PRIVATE BETA</span>
        <h1 className="animate-enter delay-1">The AI Coach That Watches Your Game, Not Your Screen.</h1>
        <p className="animate-enter delay-2">GamePointAgent is the coach in your corner: it watches the fight, it never touches the controls. Real-time positioning and decision advice — zero game injection, 100% safe.</p>
        <button className="primary-cta animate-enter delay-3" onClick={() => navigate('/app')} type="button">Start Private Beta</button>
      </div>
    </section>
  );
}

function DashboardMockup(): React.JSX.Element {
  return (
    <div className="dashboard-showcase animate-enter delay-4">
      <div className="showcase-header">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
      <main className="cockpit">
        <Sidebar footer={<SessionFooter />} />
        <div className="workspace">
          <div className="top-grid">
            <CoachSquad />
          </div>
          <LiveCards />
          <DemoBar />
          <div className="demo-surface" inert>
            <OverlayPreview />
            <ReplayAndStrategy />
          </div>
          <footer>
            <span><i /> Overlay Active</span>
            <span>Connected</span>
            <span className="footer-links">
              <span>Screen-only</span> · <span>No game injection</span> · <span>Consent-first</span> · <span>Not runtime supported until cleared</span>
            </span>
            <span>Next Advice Sync · 00:07</span>
            <span>v1.2.0</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function MarketingLanding(): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
            containerRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="marketing-page" ref={containerRef}>
      <header className="marketing-nav animate-enter">
        <strong><b style={{ color: 'var(--lime)', marginRight: '8px'}}>G</b> GAMEPOINTAGENT</strong>
        <button className="ghost-button" onClick={() => navigate('/app')} type="button">Sign In</button>
      </header>
      <MarketingHero />
      <DashboardMockup />
      <footer className="marketing-footer animate-enter delay-4">
        <div className="footer-content">
          <div className="footer-brand">
            <strong><b style={{ color: 'var(--lime)', marginRight: '8px'}}>G</b> GAMEPOINTAGENT</strong>
            <p>Screen-vision-only AI gaming companion. Zero game injection.</p>
          </div>
          <div className="footer-links">
            <RouteLink to="/privacy">Privacy Policy</RouteLink>
            <span>·</span>
            <RouteLink to="/terms">Terms of Service</RouteLink>
            <span>·</span>
            <RouteLink to="/app">Sign In</RouteLink>
          </div>
        </div>
        <div className="footer-bottom">
          <small>© 2026 GamePointAgent. All rights reserved. Not runtime supported until cleared per title.</small>
        </div>
      </footer>
    </div>
  );
}

function Root(): React.JSX.Element {
  const path = useRoute();
  if (path === '/privacy') return <PrivacyPolicy />;
  if (path === '/terms') return <TermsOfService />;
  return path === '/' || path === '' ? <MarketingLanding /> : <AppRoot />;
}

createRoot(document.getElementById('root') as HTMLElement).render(<Root />);
