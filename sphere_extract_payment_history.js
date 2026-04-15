const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CDP_URL = process.env.SPHERE_CDP_URL || 'http://127.0.0.1:9222';
const OUTDIR = path.join(process.cwd(), 'state', 'sphere');

function moneyToNumber(value) {
  if (!value) return 0;
  const negative = value.includes('(') || value.trim().startsWith('-');
  const cleaned = value.replace(/[$,()\s]/g, '').replace(/-/g, '');
  const number = cleaned ? Number(cleaned) : 0;
  return negative ? -number : number;
}

function parsePaymentRow(cells) {
  const [reportDate, depositDate, ...rest] = cells;
  const row = {
    reportDate,
    depositDate,
    routing: null,
    dda: null,
    depositsCount: 0,
    depositsAmount: 0,
    debitsCount: 0,
    debitsAmount: 0,
    netDeposit: 0,
    raw: cells,
  };

  if (rest.length < 5) return row;

  const metricTail = rest.slice(-5);
  const leading = rest.slice(0, -5);
  const [depositsCount, depositsAmount, debitsCount, debitsAmount, netDeposit] = metricTail;

  if (leading.length === 1) {
    row.dda = /^x+/i.test(leading[0]) ? leading[0] : null;
    row.routing = row.dda ? null : leading[0];
  } else if (leading.length >= 2) {
    row.routing = leading[0] || null;
    row.dda = leading[1] || null;
  }

  row.depositsCount = Number(depositsCount) || 0;
  row.depositsAmount = moneyToNumber(depositsAmount);
  row.debitsCount = Number(debitsCount) || 0;
  row.debitsAmount = moneyToNumber(debitsAmount);
  row.netDeposit = moneyToNumber(netDeposit);
  return row;
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://spheretransact.com/PaymentHistory.aspx', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(4000);

  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr'))
      .map((tr) => ({
        className: tr.className || '',
        cells: Array.from(tr.querySelectorAll('td'))
          .map((td) => (td.innerText || '').trim())
          .filter(Boolean),
      }))
      .filter((row) => row.cells.length >= 6 && /\d{2}\/\d{2}\/\d{4}/.test(row.cells[0]));
  });

  const parsedRows = rows.map((row) => ({
    className: row.className,
    ...parsePaymentRow(row.cells),
  }));

  const summaryText = await page.locator('#ctl00_ContentPage_uxReportGrid').innerText().catch(() => '');
  const summaryMatch = summaryText.match(/(\d+)\s+\$(\d[\d,]*\.\d{2})\s+(\d+)\s+\((\$[\d,]*\.\d{2})\)\s+\$(\d[\d,]*\.\d{2})\s+Page:/);
  const summary = summaryMatch ? {
    depositsCount: Number(summaryMatch[1]),
    depositsAmount: moneyToNumber(`$${summaryMatch[2]}`),
    debitsCount: Number(summaryMatch[3]),
    debitsAmount: moneyToNumber(`(${summaryMatch[4]})`),
    netDeposit: moneyToNumber(`$${summaryMatch[5]}`),
  } : null;

  const output = {
    extractedAt: new Date().toISOString(),
    source: 'https://spheretransact.com/PaymentHistory.aspx',
    rows: parsedRows,
    summary,
  };

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'payment_history_snapshot.json'), JSON.stringify(output, null, 2));

  const csvHeader = [
    'report_date',
    'deposit_date',
    'routing',
    'dda',
    'deposits_count',
    'deposits_amount',
    'debits_count',
    'debits_amount',
    'net_deposit',
    'class_name',
  ];
  const csvRows = parsedRows.map((row) => [
    row.reportDate,
    row.depositDate,
    row.routing || '',
    row.dda || '',
    row.depositsCount,
    row.depositsAmount,
    row.debitsCount,
    row.debitsAmount,
    row.netDeposit,
    row.className,
  ]);
  const csv = [csvHeader, ...csvRows]
    .map((line) => line.map((value) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(','))
    .join('\n');
  fs.writeFileSync(path.join(OUTDIR, 'payment_history_snapshot.csv'), csv + '\n');

  console.log(JSON.stringify({
    outdir: OUTDIR,
    rowCount: parsedRows.length,
    summary,
    sample: parsedRows.slice(0, 5),
  }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
