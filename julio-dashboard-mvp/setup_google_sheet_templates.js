const { chromium } = require('playwright');
const fs = require('fs');

const SHEET_URL = process.env.SHEET_URL || 'https://docs.google.com/spreadsheets/d/19geWVUxQvBnvwwgycW3aF3n68YV8usljQrQx63kLUAg/edit?usp=sharing';
const accountsCsv = fs.readFileSync('./data/accounts_template.csv', 'utf8').trimEnd();
const settlementsCsv = fs.readFileSync('./data/settlements_template.csv', 'utf8').trimEnd();
const operationsCsv = fs.readFileSync('./data/operations_template.csv', 'utf8').trimEnd();

function csvToTsv(raw) {
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
  await page.evaluate(async (t) => await navigator.clipboard.writeText(t), text);
  await page.waitForTimeout(400);
  await page.mouse.click(280, 240);
  await page.waitForTimeout(400);
  await page.keyboard.press('Meta+v');
  await page.waitForTimeout(5000);
}

async function addSheet(page) {
  await page.getByLabel('Agregar hoja').click();
  await page.waitForTimeout(2500);
  console.log('ACTIVE_URL', page.url());
}

(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://docs.google.com' });
  const page = await context.newPage();

  await page.goto(SHEET_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(12000);
  console.log('OPENED', page.url());

  await pasteIntoActiveSheet(page, csvToTsv(accountsCsv));
  await addSheet(page);
  await pasteIntoActiveSheet(page, csvToTsv(settlementsCsv));
  await addSheet(page);
  await pasteIntoActiveSheet(page, csvToTsv(operationsCsv));

  console.log('DONE', page.url());
  await page.waitForTimeout(3000);
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
