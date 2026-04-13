const { chromium } = require('playwright');

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('https://docs.google.com/spreadsheets/d/1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4/edit?usp=sharing', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY_SNIPPET:', body.slice(0, 2000));
  const buttons = await page.locator('button, [role="button"], div[role="button"]').evaluateAll(els =>
    els.slice(0, 200).map((e, i) => ({ i, text: (e.innerText || e.textContent || '').trim(), aria: e.getAttribute('aria-label') || '', title: e.getAttribute('title') || '' }))
  ).catch(() => []);
  console.log('BUTTONS:', JSON.stringify(buttons.slice(0, 80), null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
