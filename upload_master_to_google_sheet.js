const { chromium } = require('playwright');
const fs = require('fs');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4/edit?usp=sharing';
const DATA_CSV = 'state/firmaya-by-investor-v2/master_cashflow_google_sheet_ready.csv';
const SUMMARY_CSV = 'state/firmaya-by-investor-v2/master_cashflow_summary.csv';

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

async function pasteIntoActiveSheet(page, text) {
  await page.waitForTimeout(2000);
  await page.mouse.click(310, 260);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Meta+Home').catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.insertText(text);
  await page.waitForTimeout(4000);
}

async function addSheet(page) {
  await page.getByLabel('Agregar hoja').click();
  await page.waitForTimeout(2500);
}

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const dataTsv = csvToTsv(DATA_CSV);
  const summaryTsv = csvToTsv(SUMMARY_CSV);

  await page.goto(SHEET_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);

  console.log('Opened:', await page.title());

  await addSheet(page);
  await pasteIntoActiveSheet(page, 'BASE_MAESTRA_2026_04_13\n' + dataTsv);

  await addSheet(page);
  await pasteIntoActiveSheet(page, 'RESUMEN_BASE_2026_04_13\n' + summaryTsv);

  await page.waitForTimeout(8000);
  console.log('Upload complete:', page.url());
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
