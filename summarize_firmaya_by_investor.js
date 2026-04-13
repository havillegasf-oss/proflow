const fs = require('fs');
const path = require('path');

const base = path.join(process.cwd(), 'state', 'firmaya-by-investor-v2');
const out = path.join(base, '_investor_summary.json');

const entries = fs.readdirSync(base, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => {
    const dir = path.join(base, d.name);
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
    return {
      investor: d.name,
      count: files.length,
      sample: files.slice(0, 5),
    };
  })
  .sort((a, b) => b.count - a.count || a.investor.localeCompare(b.investor));

const total = entries.reduce((n, e) => n + e.count, 0);
const summary = { totalPdfs: total, investors: entries.length, entries };
fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
