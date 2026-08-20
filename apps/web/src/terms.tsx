import React from 'react';
import { RouteLink } from './lib';

export function TermsOfService(): React.JSX.Element {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <RouteLink className="legal-brand" to="/">
            <strong><b style={{ color: 'var(--lime)', marginRight: '8px' }}>G</b> GAMEPOINTAGENT</strong>
          </RouteLink>
          <nav className="legal-nav">
            <RouteLink to="/">Home</RouteLink>
            <RouteLink to="/privacy">Privacy Policy</RouteLink>
            <RouteLink className="ghost-button" to="/app">Sign In</RouteLink>
          </nav>
        </div>
      </header>

      <main className="legal-container">
        <div className="legal-callout">
          <strong>LEGAL DISCLOSURE STATUS</strong>
          <p>
            <code>UNCERTAIN: draft legal terms pending qualified legal review before public traffic.</code>
            <br />
            These terms define the operating agreement and compliance covenants governing GamePointAgent (v1.0).
          </p>
        </div>

        <article className="legal-content">
          <h1>Terms of Service</h1>
          <p className="legal-meta">Effective Date: August 20, 2026 · Version: 1.0.0-draft</p>

          <section>
            <h2>1. Acceptance of Terms & Eligibility</h2>
            <p>
              By accessing or using GamePointAgent (&quot;GamePoint&quot;, &quot;the Service&quot;), you agree to be bound by these Terms of Service.
              You must be at least 13 years old to use the Service. If you are under the age of majority in your jurisdiction, you represent that your legal guardian has reviewed and agreed to these terms.
            </p>
          </section>

          <section>
            <h2>2. Permitted Use & Screen-Vision Companion Model</h2>
            <p>
              GamePoint is an external, screen-vision-only decision support companion. It is designed and intended solely to provide high-level conceptual advice, build suggestions, and timing analysis.
            </p>
            <p>You agree not to:</p>
            <ul>
              <li>Attempt to reverse-engineer, modify, or inject GamePoint code into third-party game executables or processes.</li>
              <li>Use the Service to bypass anti-cheat mechanisms, digital rights management (DRM), or game terms of service.</li>
              <li>Automate keystrokes, mouse movements, or game inputs using GamePoint.</li>
            </ul>
          </section>

          <section>
            <h2>3. Anti-Cheat Boundaries & Third-Party Games</h2>
            <p>
              GamePoint executes strictly in its own isolated user-space process and interacts with games solely via standard OS desktop duplication.
              However, certain third-party games utilize kernel-level anti-cheat software (e.g. Riot Vanguard, BattlEye, Easy Anti-Cheat, Ricochet).
            </p>
            <div className="legal-notice">
              <strong>Kernel Anti-Cheat Disclosure:</strong> While GamePoint uses no game memory hooks or DLL injection, third-party anti-cheat systems maintain aggressive heuristics. You acknowledge that companion software usage carries potential false-positive review risks under third-party publisher policies. GamePoint is only enabled for titles verified in our Compliance Matrix.
            </div>
          </section>

          <section>
            <h2>4. Coaching Architecture & Single-Engine Disclosure</h2>
            <p>
              The &quot;Coach Squad&quot; personas (Maya, Ro, Niko, June) represent stylistic tone and explanation modes (<code>simple</code>, <code>guided</code>, <code>tactical</code>, <code>pro</code>) over a single underlying coaching pipeline. Selecting a coach does not spawn four separate concurrent AI agents.
            </p>
          </section>

          <section>
            <h2>5. Title Availability & Wave Gating</h2>
            <p>
              Coaching sessions are strictly restricted to titles marked <code>runtime_eligible=true</code> and <code>compliance_status=&apos;cleared&apos;</code> in the GamePoint Title Registry.
              If a game is not yet cleared, capture is paused and sessions cannot be initiated.
            </p>
          </section>

          <section>
            <h2>6. Intellectual Property & Trademarks</h2>
            <p>
              All game titles, publisher names, and trademarks referenced within GamePoint belong to their respective copyright holders.
              Reference to third-party games does not imply affiliation, sponsorship, or endorsement by those publishers.
            </p>
          </section>

          <section>
            <h2>7. Disclaimer of Warranties & Limitation of Liability</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
              GAMEPOINT DOES NOT GUARANTEE SPECIFIC IN-GAME PERFORMANCE OUTCOMES, RANK INCREASES, OR UNINTERRUPTED AVAILABILITY.
            </p>
          </section>

          <section>
            <h2>8. Termination & Modification</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms or compromise the integrity of the Service. We may update these terms periodically with notice on this page.
            </p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>
              For legal inquiries regarding these Terms, contact <code>legal@gamepointagent.com</code>.
            </p>
          </section>
        </article>

        <div className="legal-footer-nav">
          <RouteLink className="primary-cta-link" to="/">← Back to Overview</RouteLink>
          <RouteLink className="ghost-button" to="/privacy">View Privacy Policy →</RouteLink>
        </div>
      </main>
    </div>
  );
}
