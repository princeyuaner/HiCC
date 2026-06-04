// One-shot launcher for HICC — launches, screenshots, exits
import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(APP_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

async function main() {
  console.log('Launching HICC Electron app...');
  const app = await electron.launch({
    executablePath: electronBin,
    args: [APP_DIR],
    timeout: 60_000,
  });

  console.log('Waiting 8s for app to load...');
  await new Promise(r => setTimeout(r, 8_000));

  const allWindows = app.windows();
  console.log(`\nWindows found: ${allWindows.length}`);
  for (const w of allWindows) {
    try { console.log(`  ${w.url()}`); } catch { console.log('  (error reading url)'); }
  }

  // Check webContents
  try {
    const wcs = await app.evaluate(({ webContents }) =>
      webContents.getAllWebContents().map(w => ({ id: w.id, type: w.getType(), url: w.getURL() })));
    console.log('\nwebContents:');
    for (const w of wcs) console.log(`  [${w.id}] ${w.type}: ${w.url}`);
  } catch (e) { console.log('webContents error:', e.message); }

  // Find the main page (not devtools)
  const page = allWindows.find(w => {
    try { return !w.url().startsWith('devtools://'); } catch { return false; }
  }) || allWindows[0];

  if (!page) {
    console.log('ERROR: No page found');
    await app.close();
    return;
  }

  console.log(`\nMain page URL: ${page.url()}`);

  // Take landing screenshot
  const shot1 = path.join(SHOT_DIR, '01-landing.png');
  await page.screenshot({ path: shot1 });
  console.log(`Screenshot: ${shot1}`);

  // Get page title
  try {
    const title = await page.title();
    console.log(`Page title: "${title}"`);
  } catch {}

  // Get page text content summary
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) ?? '(empty)');
    console.log(`\nBody text preview:\n${bodyText}`);
  } catch (e) { console.log('Text error:', e.message); }

  // Try to find key UI elements
  try {
    const elements = await page.evaluate(() => {
      const find = (sel) => !!document.querySelector(sel);
      return {
        hasInput: find('input, textarea, [contenteditable="true"]'),
        hasButton: find('button, [role="button"]'),
        hasSidebar: find('[class*="sidebar"], [class*="Sidebar"], aside, nav'),
        hasChat: find('[class*="chat"], [class*="Chat"], [class*="message"]'),
        hasEditor: find('[class*="editor"], [class*="Editor"], .monaco-editor'),
        hasTerminal: find('[class*="terminal"], [class*="Terminal"], .xterm'),
        hasFileTree: find('[class*="file"], [class*="File"], [class*="tree"], [class*="Tree"], [class*="explorer"]'),
        hasTab: find('[class*="tab"], [class*="Tab"], [role="tab"]'),
      };
    });
    console.log('\nUI elements detected:');
    for (const [k, v] of Object.entries(elements)) console.log(`  ${k}: ${v}`);
  } catch (e) { console.log('Elements error:', e.message); }

  // Try clicking around
  console.log('\n--- Interaction tests ---');

  // Try clicking tabs
  try {
    const tabs = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="tab"], [class*="Tab"], [role="tab"]')]
        .map(el => el.textContent?.trim()).filter(Boolean);
    });
    console.log('Found tabs:', tabs.join(', ') || '(none)');
  } catch {}

  // Try typing in an input
  try {
    const inputFound = await page.evaluate(() => {
      const el = document.querySelector('input, textarea, [contenteditable="true"]');
      if (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.focus();
          return el.tagName;
        }
        return el.tagName;
      }
      return null;
    });
    if (inputFound) {
      console.log(`Focused input: ${inputFound}`);
      await page.keyboard.type('Hello HICC!', { delay: 20 });
      await new Promise(r => setTimeout(r, 500));
      const shot2 = path.join(SHOT_DIR, '02-typed.png');
      await page.screenshot({ path: shot2 });
      console.log(`Screenshot after typing: ${shot2}`);
    } else {
      console.log('No input element found');
    }
  } catch (e) { console.log('Type error:', e.message); }

  // Final screenshot
  const shot3 = path.join(SHOT_DIR, '03-final.png');
  await page.screenshot({ path: shot3 });
  console.log(`Final screenshot: ${shot3}`);

  await app.close();
  console.log('\nDone. App closed.');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
