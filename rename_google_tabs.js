const { chromium } = require('playwright');

const SHEET_ID = '1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4';
const renames = [
  { gid: '396247288', name: 'BASE MAESTRA' },
  { gid: '664078652', name: 'RESUMEN BASE' },
];

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  for (const item of renames) {
    await page.goto(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${item.gid}#gid=${item.gid}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);
    const caption = page.locator('.docs-sheet-active-tab .docs-sheet-tab-caption').first();
    await caption.dblclick();
    await page.waitForTimeout(1000);
    await page.keyboard.press('Meta+a').catch(() => {});
    await page.keyboard.type(item.name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    console.log('renamed', item.gid, item.name);
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
