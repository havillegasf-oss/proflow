const { chromium } = require('playwright');

const SHEET_ID = '1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4';
const gids = ['922174472', '132491368'];

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  for (const gid of gids) {
    await page.goto(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${gid}#gid=${gid}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);
    const tab = page.locator('.docs-sheet-active-tab').first();
    await tab.click({ button: 'right' });
    await page.waitForTimeout(1000);
    const deleteItem = page.getByText('Eliminar', { exact: true }).first();
    await deleteItem.click();
    await page.waitForTimeout(2000);
    const confirm = page.getByText('Aceptar', { exact: true }).first();
    if (await confirm.count()) {
      await confirm.click();
      await page.waitForTimeout(3000);
    }
    console.log('deleted', gid);
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
