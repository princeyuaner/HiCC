// Interactive E2E test for HICC chat improvements
import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(APP_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

let shotNum = 0;
function shotName(label) { return `${String(++shotNum).padStart(2, '0')}-${label}.png`; }

async function main() {
  console.log('=== HICC Chat Features E2E Test ===\n');

  console.log('[1] Launching app...');
  const app = await electron.launch({
    executablePath: electronBin,
    args: [APP_DIR],
    env: { ...process.env, NODE_ENV: 'development' },
    timeout: 60_000,
  });
  await new Promise(r => setTimeout(r, 8_000));

  const allWindows = app.windows();
  let page = null;
  for (const w of allWindows) {
    try {
      if (!w.url().startsWith('devtools://')) { page = w; break; }
    } catch {}
  }
  if (!page) page = allWindows[0];
  console.log(`    Page: ${page.url()}\n`);

  // ====== Test 1: Empty state ======
  console.log('[2] Checking empty state...');
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '(empty)');
  const hasEmptyState = bodyText.includes('Start a conversation');
  console.log(`    Empty state visible: ${hasEmptyState ? 'YES' : 'NO'}`);

  // ====== Test 2: Conversation header ======
  console.log('[3] Checking conversation header...');
  const hasNewChatBtn = bodyText.includes('New Chat');
  console.log(`    "New Chat" in body: ${hasNewChatBtn ? 'YES' : 'NO'}`);

  const hasPlusBtn = bodyText.includes('+');
  console.log(`    "+" button in body: ${hasPlusBtn ? 'YES' : 'NO'}`);

  await page.screenshot({ path: path.join(SHOT_DIR, shotName('empty-chat')) });

  // ====== Test 3: Model button, mode button, Send button ======
  console.log('[4] Checking bottom bar controls...');
  const btnsText = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].map(b => b.textContent?.trim()).filter(Boolean);
  });
  const hasSonnet = btnsText.some(t => t.includes('Sonnet'));
  const hasDefault = btnsText.includes('Default');
  const hasSend = btnsText.includes('Send');
  console.log(`    Sonnet model: ${hasSonnet ? 'YES' : 'NO'}`);
  console.log(`    Default mode: ${hasDefault ? 'YES' : 'NO'}`);
  console.log(`    Send button: ${hasSend ? 'YES' : 'NO'}`);

  // ====== Test 4: Open model menu ======
  console.log('[5] Opening model selector...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const mb = btns.find(b => /Sonnet|Opus/.test(b.textContent?.trim() || ''));
    mb?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(SHOT_DIR, shotName('model-menu')) });

  const modelItems = await page.evaluate(() => {
    return [...document.querySelectorAll('[class*="modelMenuItem"]')].map(el => ({
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      active: el.className.includes('Active'),
    }));
  });
  console.log(`    Model items: ${modelItems.length} (${modelItems.map(m => m.text + (m.active ? '*' : '')).join(', ')})`);

  // Close model menu
  await page.evaluate(() => {
    const overlay = document.querySelector('[class*="modelMenuOverlay"]');
    if (overlay) overlay.click();
  });
  await new Promise(r => setTimeout(r, 200));

  // ====== Test 5: Open conversation menu ======
  console.log('[6] Opening conversation selector...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const convBtn = btns.find(b => (b.textContent || '').includes('New Chat') && (b.textContent || '').includes('▾'));
    if (convBtn) convBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(SHOT_DIR, shotName('conv-menu')) });

  const hasNoConvs = await page.evaluate(() => {
    return document.body?.innerText?.includes('No conversations yet') || false;
  });
  console.log(`    "No conversations yet": ${hasNoConvs ? 'YES' : 'NO'}`);

  // Close menu
  await page.evaluate(() => document.body.click());
  await new Promise(r => setTimeout(r, 200));

  // ====== Test 6: Type message ======
  console.log('[7] Typing a Markdown test message...');
  const taFound = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (ta) { ta.focus(); return true; }
    return false;
  });
  console.log(`    Textarea found: ${taFound ? 'YES' : 'NO'}`);

  if (taFound) {
    await page.keyboard.type('# Hello World\n\nThis is **bold** and *italic*\n\n- list item 1\n- list item 2\n\n`inline code`', { delay: 5 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(SHOT_DIR, shotName('typed-message')) });
  }

  // ====== Test 7: Click Send ======
  console.log('[8] Sending message...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const sendBtn = btns.find(b => b.textContent?.trim() === 'Send');
    sendBtn?.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SHOT_DIR, shotName('after-send')) });

  // Check message bubbles
  const bubbleCount = await page.evaluate(() => {
    return document.querySelectorAll('[class*="bubbleInner"]').length;
  });
  console.log(`    Message bubbles: ${bubbleCount}`);

  // Check if textarea is disabled (AI working)
  const taDisabled = await page.evaluate(() => {
    return document.querySelector('textarea')?.disabled || false;
  });
  console.log(`    Textarea disabled (AI working): ${taDisabled ? 'YES' : 'NO'}`);

  // ====== Test 8: Check for Stop button ======
  const hasStopBtn = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Stop');
  });
  console.log(`[9] Stop button visible: ${hasStopBtn ? 'YES' : 'NO'}`);

  if (hasStopBtn) {
    console.log('    Clicking Stop...');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const sb = btns.find(b => b.textContent?.trim() === 'Stop');
      sb?.click();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SHOT_DIR, shotName('after-stop')) });
  }

  // ====== Test 9: Check hover actions on messages ======
  console.log('[10] Hovering over assistant message...');
  await page.evaluate(() => {
    const bubble = document.querySelector('[class*="bubbleAssistant"]');
    if (bubble) {
      bubble.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(SHOT_DIR, shotName('hover-actions')) });

  const actionBtns = await page.evaluate(() => {
    return [...document.querySelectorAll('[class*="actionButton"]')].map(el => el.textContent?.trim());
  });
  console.log(`    Action buttons: ${actionBtns.join(', ') || '(none)'}`);

  // ====== Test 10: Click New Chat + button ======
  console.log('[11] Creating new conversation...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const plusBtn = btns.find(b => b.textContent?.trim() === '+');
    plusBtn?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(SHOT_DIR, shotName('new-conversation')) });

  const bodyAfterNew = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
  const emptyAgain = bodyAfterNew.includes('Start a conversation');
  console.log(`    Empty state after new chat: ${emptyAgain ? 'YES' : 'NO'}`);

  // ====== Final ======
  await page.screenshot({ path: path.join(SHOT_DIR, shotName('final')) });

  const shots = fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\n=== Test Complete ===`);
  console.log(`Screenshots (${shots.length}):`);
  for (const s of shots.slice(-12)) {
    const stat = fs.statSync(path.join(SHOT_DIR, s));
    console.log(`  ${s} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  await app.close();
  console.log('\nApp closed.');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
