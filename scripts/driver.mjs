// Quick driver for HICC Electron app (Windows)
import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const APP_DIR = 'C:\\Users\\CY\\Desktop\\HICC';
const SHOT_DIR = process.env.SCREENSHOT_DIR || path.join(APP_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

let app = null;
let page = null;

const COMMANDS = {
  async launch() {
    if (app) return console.log('already launched');
    console.log('Launching Electron...');
    app = await electron.launch({
      executablePath: electronBin,
      args: [APP_DIR],
      timeout: 60_000,
    });
    console.log('Waiting for window to load...');
    await new Promise(r => setTimeout(r, 10_000));

    const allWindows = app.windows();
    console.log(allWindows.length, 'windows:');
    for (const w of allWindows) {
      try { console.log(' ', w.url()); } catch {}
    }

    // Also check webContents
    try {
      const wcs = await app.evaluate(({ webContents }) =>
        webContents.getAllWebContents().map(w => ({ id: w.id, type: w.getType(), url: w.getURL() })));
      console.log('webContents:');
      for (const w of wcs) console.log(` [${w.id}] ${w.type}: ${w.url}`);
    } catch (e) { console.log('webContents error:', e.message); }

    page = allWindows.find(w => {
      try { return !w.url().startsWith('devtools://'); } catch { return false; }
    }) || allWindows[0];

    if (page) {
      try { console.log('Active page URL:', page.url()); } catch {}
    }
    console.log('launched.');
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '→', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"], .tab, [class*="tab"]')];
      const el = els.find(e => e.textContent?.trim() === t)
              || els.find(e => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async type(text)  { if (page) await page.keyboard.type(text, { delay: 30 }); },
  async press(key)  { if (page) await page.keyboard.press(key); },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    const txt = await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null);
    console.log(txt?.substring(0, 2000));
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async html(sel) {
    if (!page) return console.log('ERROR: launch first');
    const h = await page.evaluate(s =>
      (s ? document.querySelector(s) : document.body)?.innerHTML?.substring(0, 3000) ?? '(null)',
      sel || null);
    console.log(h);
  },

  async quit() { if (app) await app.close().catch(()=>{}); app = null; page = null; },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('con:', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async line => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('HICC Driver — "help" for commands, "launch" to start');
rl.prompt();
