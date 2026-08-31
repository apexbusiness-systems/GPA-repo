// Perception-sequence check (docs/design/voice-and-perception.md §1): in the rendered
// HUD, tier-1 status must sit above the advice, which sits above adjustment controls.
// Also re-captures the evidence screenshots. Run: node scripts/perception-check.mjs
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  let p = join(root, req.url === '/' ? 'index.html' : req.url);
  if (!existsSync(p)) p = join(root, 'index.html');
  res.setHeader('content-type', types[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
}).listen(4199);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 460, height: 640 } });
await page.goto('http://localhost:4199/');
await page.screenshot({ path: '../../docs/evidence/ui/1-consent.png' });
await page.check('input[type=checkbox]');
await page.click('button.primary');
await page.screenshot({ path: '../../docs/evidence/ui/2-persona.png' });
await page.click('.persona-option:nth-child(2)');
await page.click('text=Start capture');
await page.waitForTimeout(4500);

const top = async (sel) => (await page.locator(sel).first().boundingBox()).y;
const statusY = await top('.status');
const adviceY = await top('.advice-region');
const settingsY = await top('.settings');
if (!(statusY < adviceY && adviceY < settingsY)) {
  throw new Error(`sequence violated: status=${statusY} advice=${adviceY} settings=${settingsY}`);
}
const statusText = await page.locator('.status').innerText();
if (!/Watching/.test(statusText)) throw new Error('tier-1 status word missing');

await page.click('summary');
await page.screenshot({ path: '../../docs/evidence/ui/3-hud-advice.png' });
await browser.close();
server.close();
console.log(`PERCEPTION_SEQUENCE_OK status(${statusY}) < advice(${adviceY}) < settings(${settingsY}); status="${statusText.trim()}"`);
