const { chromium } = require('playwright');

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://docs.google.com' });
  const page = await context.newPage();
  await page.goto('https://docs.google.com/spreadsheets/d/1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4/edit?usp=sharing', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);
  await page.getByLabel('Agregar hoja').click();
  await page.waitForTimeout(3000);
  const txt = 'PRUEBA_PEGADO\nA\tB\n1\t2';
  await page.evaluate(async (t) => await navigator.clipboard.writeText(t), txt);
  await page.waitForTimeout(500);
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(6000);
  console.log('URL', page.url());
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
