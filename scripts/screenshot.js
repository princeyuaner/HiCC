const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  
  // Wait for React to render
  await page.waitForTimeout(3000);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Body text (first 500 chars):', bodyText);
  
  const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 1000));
  console.log('Root HTML (first 1000 chars):', rootHTML || '(empty)');
  
  await page.screenshot({ path: 'C:/Users/CY/Desktop/HICC/screenshot_full.png', fullPage: true });
  console.log('Screenshot saved');
  
  await browser.close();
})();
