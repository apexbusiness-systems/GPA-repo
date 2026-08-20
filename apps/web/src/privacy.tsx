import React from 'react';
import { RouteLink } from './lib';

export function PrivacyPolicy(): React.JSX.Element {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <RouteLink className="legal-brand" to="/">
            <strong><b style={{ color: 'var(--lime)', marginRight: '8px' }}>G</b> GAMEPOINTAGENT</strong>
          </RouteLink>
          <nav className="legal-nav">
            <RouteLink to="/">Home</RouteLink>
            <RouteLink to="/terms">Terms of Service</RouteLink>
            <RouteLink className="ghost-button" to="/app">Sign In</RouteLink>
          </nav>
        </div>
      </header>

      <main className="legal-container">
        <div className="legal-callout">
          <strong>LEGAL DISCLOSURE STATUS</strong>
          <p>
            <code>UNCERTAIN: draft legal disclosure pending qualified legal review before public traffic.</code>
            <br />
            This policy outlines actual, grounded technical data practices enforced by the GamePoint codebase (v1.0).
          </p>
        </div>

        <article className="legal-content">
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Effective Date: August 20, 2026 · Version: 1.0.0-draft</p>

          <section>
            <h2>1. Core Architecture & Screen-Vision Boundary</h2>
            <p>
              GamePointAgent (&quot;GamePoint&quot;, &quot;we&quot;, &quot;us&quot;) operates strictly as an OS-level visual companion.
              Our software complies with the following non-negotiable architectural boundaries:
            </p>
            <ul>
              <li><strong>Zero Game Injection:</strong> We never inject DLLs, read game process memory, hook network packets, or automate keyboard/mouse input into games.</li>
              <li><strong>Local Screen Capture:</strong> Visual frames are captured via OS-level desktop duplication APIs solely upon user consent and trigger.</li>
              <li><strong>No Audio or Voice Capture in v1.0:</strong> Microphone input, system audio, and speech recognition are completely disabled in v1.0 (ADR-003 / ADR-010). No audio data is captured, buffered, or transmitted.</li>
            </ul>
          </section>

          <section>
            <h2>2. Information We Collect and Process</h2>
            <p>We process the following categories of data in strict accordance with your consent:</p>
            <ul>
              <li><strong>Account Credentials:</strong> Email address and hashed authentication data managed securely via Supabase Auth.</li>
              <li><strong>User Profile & Preferences:</strong> Selected playstyle (<code>story</code>, <code>mastery</code>, <code>rank</code>), coaching tone mode (<code>simple</code>, <code>guided</code>, <code>tactical</code>, <code>pro</code>), and age gate confirmation (13+).</li>
              <li><strong>Transient Frame Data:</strong> When a coaching assist is triggered, the local application encodes a compressed JPEG of the active frame or region of interest (ROI). Frame bytes are processed in transient memory for vision inference and are not permanently stored.</li>
              <li><strong>Operational Telemetry:</strong> Latency metrics, model confidence scores, and categorical assist outcomes (e.g. <code>ok</code>, <code>degraded</code>, <code>refused</code>). Telemetry explicitly excludes frame bytes, OCR text, player usernames, raw prompts, and chat content.</li>
            </ul>
          </section>

          <section>
            <h2>3. AI Model Providers & Data Transmission</h2>
            <p>
              To generate contextual coaching advice, transient frame data and query descriptors are transmitted over encrypted HTTPS to inference providers configured in our multi-tier routing architecture (ADR-009):
            </p>
            <ul>
              <li><strong>Groq Inc.:</strong> Primary vision inference for rapid real-time analysis.</li>
              <li><strong>Google Gemini:</strong> Escalation and complex scene reasoning.</li>
              <li><strong>OpenAI:</strong> Text embeddings for domain knowledge retrieval.</li>
            </ul>
            <p>
              Transmitted frames are designated as transient inference payloads and are subject to enterprise zero-retention / privacy agreements where available.
            </p>
          </section>

          <section>
            <h2>4. Title Compliance & Advantage Check</h2>
            <p>
              GamePoint strictly gates coaching availability based on title clearance status in our compliance registry (<code>governance/compliance-matrix.md</code>).
              For competitive multiplayer titles, our Advantage Check engine enforces strict anti-cheat fairness constraints, refusing tactical real-time callouts that would convey unfair competitive advantage.
            </p>
          </section>

          <section>
            <h2>5. Age Gate & Child Privacy</h2>
            <p>
              GamePoint requires users to pass an explicit age gate confirming they are 13 years of age or older before capturing frames or creating a coaching session. We do not knowingly collect personal data from children under 13.
            </p>
          </section>

          <section>
            <h2>6. Data Security & Storage</h2>
            <p>
              All stored user profiles and session metadata are protected by Row Level Security (RLS) within PostgreSQL/Supabase. Publishable keys used in browser bundles are strictly restricted to authenticated user sessions.
            </p>
          </section>

          <section>
            <h2>7. Contact & Updates</h2>
            <p>
              For privacy inquiries or data deletion requests, contact <code>privacy@gamepointagent.com</code>.
            </p>
          </section>
        </article>

        <div className="legal-footer-nav">
          <RouteLink className="primary-cta-link" to="/">← Back to Overview</RouteLink>
          <RouteLink className="ghost-button" to="/terms">View Terms of Service →</RouteLink>
        </div>
      </main>
    </div>
  );
}
