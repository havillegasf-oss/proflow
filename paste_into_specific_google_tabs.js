const { chromium } = require('playwright');
const fs = require('fs');

const SHEET_ID = '1h1iByHxxuL8LQAOjjUsiwY9DCMlsylC-j0ELyezlUX4';
const BASE_GID = '396247288';
const SUMMARY_GID = '664078652';
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

async function pasteToGid(context, gid, text) {
  const page = await context.newPage();
  await page.goto(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${gid}#gid=${gid}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.evaluate(async (t) => await navigator.clipboard.writeText(t), text);
  await page.waitForTimeout(500);
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(7000);
  console.log('pasted', gid, page.url());
  await page.close();
}

(async() => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://docs.google.com' });
  const dataTsv = csvToTsv(DATA_CSV);
  const summaryTsv = csvToTsv(SUMMARY_CSV);
  await pasteToGid(context, BASE_GID, dataTsv);
  await pasteToGid(context, SUMMARY_GID, summaryTsv);
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
