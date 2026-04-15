const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CDP_URL = process.env.SPHERE_CDP_URL || 'http://127.0.0.1:9222';
const OUTDIR = path.join(process.cwd(), 'state', 'sphere');
const URL = 'https://spheretransact.com/BatchHistory.aspx';

function moneyToNumber(value) {
  if (!value) return 0;
  const negative = value.includes('(') || value.trim().startsWith('-');
  const cleaned = value.replace(/[$,()\s]/g, '').replace(/-/g, '');
  const number = cleaned ? Number(cleaned) : 0;
  return negative ? -number : number;
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const payload = await page.evaluate(() => {
    const table = document.querySelector('#ctl00_ContentPage_uxBatchMerchantGrid_ctl00');
    const rows = Array.from(table.querySelectorAll('tbody tr'))
      .map((tr) => ({
        className: tr.className || '',
        cells: Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim()),
      }))
      .filter((row) => row.cells.some(Boolean));

    const summaryTitle = document.querySelector('[data-target="#ctl00_ContentPage_uxBatchMerchantGrid"]')?.innerText?.trim() || '';
    const gridText = table.innerText || '';
    return { rows, summaryTitle, gridText };
  });

  const parsedRows = payload.rows.map((row) => {
    const cells = row.cells.filter((cell, idx) => !(idx === row.cells.length - 1 && cell === ''));
    return {
      className: row.className,
      reportDate: cells[0] || '',
      terminalNumber: cells[1] || '',
      batchNumber: cells[2] || '',
      keyedPercent: cells[3] || '',
      avgTransaction: moneyToNumber(cells[4] || ''),
      transactionCount: Number(cells[5] || 0),
      settledSales: moneyToNumber(cells[6] || ''),
      settledReturns: moneyToNumber(cells[7] || ''),
      settledNet: moneyToNumber(cells[8] || ''),
      nonSettledSales: moneyToNumber(cells[9] || ''),
      nonSettledReturns: moneyToNumber(cells[10] || ''),
      nonSettledNet: moneyToNumber(cells[11] || ''),
      totalSales: moneyToNumber(cells[12] || ''),
      totalReturns: moneyToNumber(cells[13] || ''),
      totalNet: moneyToNumber(cells[14] || ''),
      raw: cells,
    };
  });

  const summaryMatch = payload.gridText.match(/(\d+\.\d+)%\s+\$([\d,]+\.\d{2})\s+(\d+)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})/);
  const summary = summaryMatch ? {
    keyedPercent: Number(summaryMatch[1]),
    avgTransaction: moneyToNumber(`$${summaryMatch[2]}`),
    transactionCount: Number(summaryMatch[3]),
    settledSales: moneyToNumber(`$${summaryMatch[4]}`),
    settledReturns: moneyToNumber(`$${summaryMatch[5]}`),
    settledNet: moneyToNumber(`$${summaryMatch[6]}`),
  } : null;

  const output = {
    extractedAt: new Date().toISOString(),
    source: URL,
    summaryTitle: payload.summaryTitle,
    summary,
    rows: parsedRows,
  };

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'batch_history_snapshot.json'), JSON.stringify(output, null, 2));

  const header = [
    'report_date', 'terminal_number', 'batch_number', 'keyed_percent', 'avg_transaction', 'transaction_count',
    'settled_sales', 'settled_returns', 'settled_net',
    'non_settled_sales', 'non_settled_returns', 'non_settled_net',
    'total_sales', 'total_returns', 'total_net', 'class_name'
  ];

  const csv = [header, ...parsedRows.map((row) => [
    row.reportDate,
    row.terminalNumber,
    row.batchNumber,
    row.keyedPercent,
    row.avgTransaction,
    row.transactionCount,
    row.settledSales,
    row.settledReturns,
    row.settledNet,
    row.nonSettledSales,
    row.nonSettledReturns,
    row.nonSettledNet,
    row.totalSales,
    row.totalReturns,
    row.totalNet,
    row.className,
  ])].map((line) => line.map((value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');

  fs.writeFileSync(path.join(OUTDIR, 'batch_history_snapshot.csv'), csv + '\n');

  console.log(JSON.stringify({
    outdir: OUTDIR,
    rowCount: parsedRows.length,
    summaryTitle: payload.summaryTitle,
    summary,
    sample: parsedRows.slice(0, 3),
  }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
