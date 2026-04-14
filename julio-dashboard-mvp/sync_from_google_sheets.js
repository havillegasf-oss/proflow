const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUTPUT = path.join(__dirname, 'data', 'current.json');
const ACCOUNTS_URL = process.env.ACCOUNTS_CSV_URL || '';
const SETTLEMENTS_URL = process.env.SETTLEMENTS_CSV_URL || '';
const OPERATIONS_URL = process.env.OPERATIONS_CSV_URL || '';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https://') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += ch;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (r[idx] || '').trim());
    return obj;
  });
}

function num(value) {
  return Number(String(value || '0').replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '')) || 0;
}

async function main() {
  if (!ACCOUNTS_URL || !SETTLEMENTS_URL || !OPERATIONS_URL) {
    throw new Error('Faltan ACCOUNTS_CSV_URL, SETTLEMENTS_CSV_URL u OPERATIONS_CSV_URL');
  }

  const [accountsCsv, settlementsCsv, operationsCsv] = await Promise.all([
    fetchText(ACCOUNTS_URL),
    fetchText(SETTLEMENTS_URL),
    fetchText(OPERATIONS_URL)
  ]);

  const accounts = parseCsv(accountsCsv).map((r) => ({
    name: r.name,
    institution: r.institution,
    currency: r.currency || 'CLP',
    balance: num(r.balance),
    status: r.status || 'OK',
    statusLabel: r.statusLabel || r.status || 'Disponible'
  }));

  const settlements = parseCsv(settlementsCsv).map((r) => ({
    source: r.source,
    amount: num(r.amount),
    releaseDate: r.releaseDate,
    notes: r.notes || ''
  }));

  const operations = parseCsv(operationsCsv).map((r) => ({
    date: r.date,
    type: r.type,
    description: r.description,
    amount: num(r.amount),
    account: r.account,
    status: r.status || 'Ejecutada'
  }));

  const payload = {
    today: new Date().toISOString().slice(0, 10),
    organization: 'ProFlow / La Caja Chica',
    accounts,
    settlements,
    operations,
    notes: [
      'Datos sincronizados desde Google Sheets para demo.',
      'Fuente temporal operativa mientras se conectan fuentes más automáticas.'
    ]
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
  console.log(`OK: ${OUTPUT}`);
  console.log(`accounts=${accounts.length} settlements=${settlements.length} operations=${operations.length}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
