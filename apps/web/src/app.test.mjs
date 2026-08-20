import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canStartSession, gateReason } from './gating.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(resolve(here, f), 'utf8');

test('title gating: only cleared + runtime_eligible titles can start sessions', () => {
  assert.equal(canStartSession({ compliance_status: 'cleared', runtime_eligible: true }), true);
  assert.equal(canStartSession({ compliance_status: 'cleared', runtime_eligible: false }), false);
  assert.equal(canStartSession({ compliance_status: 'verify_terms', runtime_eligible: true }), false);
  assert.equal(canStartSession({ compliance_status: 'license_blocked', runtime_eligible: false }), false);
});

test('title gating: every blocked title has a specific human reason', () => {
  for (const t of [
    { compliance_status: 'cleared', runtime_eligible: false },
    { compliance_status: 'verify_terms', runtime_eligible: false },
    { compliance_status: 'license_blocked', runtime_eligible: false },
    { compliance_status: 'unknown', runtime_eligible: false },
  ]) {
    const r = gateReason(t);
    assert.equal(typeof r, 'string');
    assert.ok(r.length > 20, `reason too vague: ${r}`);
  }
  assert.equal(gateReason({ compliance_status: 'cleared', runtime_eligible: true }), null);
});

test('no dead hash anchors remain in navigation source', () => {
  for (const f of ['main.tsx', 'lib.tsx', 'app.tsx']) {
    assert.ok(!/href=\{?["'`]#/.test(src(f)), `${f} still contains hash-anchor hrefs`);
  }
});

test('every nav item routes to a real path', () => {
  const lib = src('lib.tsx');
  const paths = [...lib.matchAll(/path: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(paths.length, 8);
  for (const p of paths) assert.ok(p.startsWith('/'), `bad path ${p}`);
});

test('gated app surfaces keep compliance boundary copy', () => {
  const app = src('app.tsx');
  for (const line of ['No game injection', 'Consent required before capture', 'Voice/audio: Disabled in v1.0', 'Not runtime supported until cleared']) {
    assert.ok(app.includes(line), `missing: ${line}`);
  }
});

test('landing demo panels are marked inert and labeled as preview', () => {
  const main = src('main.tsx');
  assert.ok(main.includes('className="demo-surface" inert'), 'demo surface not inert');
  assert.ok(main.includes('PRODUCT PREVIEW'), 'preview label missing');
});

test('title copy policy: no uncleared tactical-shooter jargon in shipped copy', () => {
  const banned = [
    'overpeek', 'bombsite', 'plant safe', 'rotation to a', 'post-plant', 'retake on b',
    'econ.', 'buy round', 'headshot', ' awp', 'haven ·', 'bind.', 'clutch attempt', 'mid control',
  ];
  for (const f of ['main.tsx', 'app.tsx']) {
    const text = src(f).toLowerCase();
    for (const term of banned) {
      assert.ok(!text.includes(term), `${f} contains banned tactical-shooter term: "${term}"`);
    }
  }
});

test('Coach Squad cards map 1:1 to coaching_mode, are interactive, and disclose single-engine design', () => {
  const app = src('app.tsx');
  for (const mode of ['simple', 'guided', 'tactical', 'pro']) {
    assert.ok(new RegExp(`mode:\\s*'${mode}'`).test(app), `COACHES missing explicit mapping to mode "${mode}"`);
  }
  assert.ok(app.includes('aria-pressed={props.profile.coaching_mode === c.mode}'), 'coach tiles are not wired to the persisted coaching_mode');
  assert.ok(app.includes('does not run four separate agents'), 'missing single-engine disclosure copy');
});

test('public legal routes exist, dispatch without auth gate, and disclose draft review status', () => {
  const main = src('main.tsx');
  assert.ok(main.includes('path === \'/privacy\'') && main.includes('<PrivacyPolicy />'), 'Root() does not dispatch PrivacyPolicy at top level');
  assert.ok(main.includes('path === \'/terms\'') && main.includes('<TermsOfService />'), 'Root() does not dispatch TermsOfService at top level');

  const privacy = src('privacy.tsx');
  const terms = src('terms.tsx');
  assert.ok(privacy.includes('UNCERTAIN: draft legal disclosure pending qualified legal review before public traffic'), 'privacy missing legal review notice');
  assert.ok(terms.includes('UNCERTAIN: draft legal terms pending qualified legal review before public traffic'), 'terms missing legal review notice');
  assert.ok(privacy.includes('Zero Game Injection'), 'privacy missing core architecture statement');
  assert.ok(terms.includes('Kernel Anti-Cheat Disclosure'), 'terms missing kernel anti-cheat disclosure');
});

test('marketing landing renders real footer with legal route links outside inert container', () => {
  const main = src('main.tsx');
  assert.ok(main.includes('className="marketing-footer'), 'MarketingLanding missing real footer');
  assert.ok(main.includes('<RouteLink to="/privacy">Privacy Policy</RouteLink>'), 'Marketing footer missing privacy link');
  assert.ok(main.includes('<RouteLink to="/terms">Terms of Service</RouteLink>'), 'Marketing footer missing terms link');
  // Confirm inert demo-surface is intact and unchanged
  assert.ok(main.includes('<div className="demo-surface" inert>'), 'demo-surface container must remain inert');
});

test('overlay download UI correctly supports honest refusal when unset and download CTA when set', () => {
  const app = src('app.tsx');
  assert.ok(app.includes('VITE_GAMEPOINT_DOWNLOAD_URL'), 'app.tsx does not read VITE_GAMEPOINT_DOWNLOAD_URL');
  assert.ok(app.includes('It is not yet distributed — no download is offered because none is ready'), 'honest refusal copy missing when download url unset');
  assert.ok(app.includes('Download Windows Overlay'), 'download CTA link missing when download url set');
});

