const { chromium } = require('playwright');
const fs = require('fs');

const SHEET_ID = '1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4';
const CSV_FILE = 'state/firmaya-by-investor-v2/payment_calendar_simple_view.csv';
const TAB_NAME = 'CALENDARIO SIMPLE';

function csvToTsv(path) {
  const raw = fs.readFileSync(path, 'utf8').trimEnd();
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.map(r => r.join('\t')).join('\n');
}

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://docs.google.com' });
  const page = await context.newPage();
  const tsv = csvToTsv(CSV_FILE);
  await page.goto(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.getByLabel('Agregar hoja').click();
  await page.waitForTimeout(3000);
  await page.evaluate(async (t) => await navigator.clipboard.writeText(t), tsv);
  await page.waitForTimeout(500);
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(7000);
  const gid = /gid=(\d+)/.exec(page.url())?.[1] || '';
  const caption = page.locator('.docs-sheet-active-tab .docs-sheet-tab-caption').first();
  await caption.dblclick();
  await page.waitForTimeout(1000);
  await page.keyboard.press('Meta+a').catch(() => {});
  await page.keyboard.type(TAB_NAME);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  console.log(JSON.stringify({ gid, url: page.url(), tab: TAB_NAME }));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
