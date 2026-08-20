import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Persona = 'story' | 'mastery' | 'rank';

type CoachCue = {
  name: string;
  role: string;
  image: string;
  cue: string;
  tone: Persona;
};

const activePersona: Persona = 'mastery';

const coachCues: CoachCue[] = [
  {
    name: 'Ro',
    role: 'The Shotcaller',
    image: '/art/portrait-ro.png',
    cue: 'Good opening. Your second player is close enough to follow up.',
    tone: 'mastery',
  },
  {
    name: 'Maya',
    role: 'The Anchor',
    image: '/art/portrait-maya.png',
    cue: 'Hold your position. Do not overextend while your team regroups.',
    tone: 'rank',
  },
  {
    name: 'Niko',
    role: 'The Analyst',
    image: '/art/portrait-niko.png',
    cue: 'They are low on resources. Group before the next push.',
    tone: 'story',
  },
  {
    name: 'June',
    role: 'The Builder',
    image: '/art/portrait-june.png',
    cue: 'Set up here, then commit together.',
    tone: 'mastery',
  },
];

const cueTimes = ['2m ago', '1m ago', '1m ago', 'Now'];

function App(): React.JSX.Element {
  return (
    <main className="overlay-shell" aria-label="GamePointAgent local overlay scaffold">
      <section className="stage">
        <div className="topbar">
          <strong>GamePointAgent</strong>
          <span className="status"><span className="dot" /> Capture paused</span>
        </div>
        <section className="live-preview">
          <img src="/art/component-live-overlay.png" alt="" />
          <div className="gp-chip"><img alt="GamePointAgent" src="/art/gpa-wordmark.png" /></div>
          <div className="score-strip" aria-label="Live scoreboard">
            <span className="squad-strip"><img src="/art/portrait-ro.png" alt="" /><img src="/art/portrait-maya.png" alt="" /></span>
            <span>2</span><strong>1:12</strong><span>1</span>
            <span className="squad-strip"><img src="/art/portrait-niko.png" alt="" /><img src="/art/portrait-june.png" alt="" /></span>
          </div>
          {coachCues.map((coach, index) => (
            <article className={`coach-callout callout-${index} ${coach.tone === activePersona ? 'active' : ''}`} key={coach.name}>
              <img src={coach.image} alt={`${coach.name}, ${coach.role}`} />
              <div>
                <strong>{coach.name}</strong>
                <small>{coach.role}</small>
                <span>{coach.cue}</span>
              </div>
              <time>{cueTimes[index]}</time>
            </article>
          ))}
          <div className="reticle" />
          <div className="overlay-hud">
            <span>100 ◎</span>
            <img alt="GamePointAgent" src="/art/gpa-wordmark.png" />
            <span>25 / 75</span>
          </div>
        </section>

        <section className="consent">
          <strong>Consent required before capture</strong>
          <span>Age gate and privacy consent must pass before the local capture service can start.</span>
        </section>

        <section className="tactical-row" aria-label="Evidence and controls">
          <span>Evidence: Not verified</span>
          <span>Persona: {activePersona}</span>
          <span>Voice/audio: Disabled in v1.0</span>
          <button type="button">Pause capture</button>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
