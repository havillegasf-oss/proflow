const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://firmaya.idok.cl';
const userDataDir = path.join(process.cwd(), '.playwright-firmaya-profile');
const outDir = path.join(process.cwd(), process.env.FIRMAYA_OUTDIR || 'state/firmaya-by-investor');
const limit = parseInt(process.env.FIRMAYA_LIMIT || '0', 10); // 0 = all

function sanitize(name) {
  return (name || 'sin_nombre')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function investorFromGroup(groupText) {
  const prefix = 'Grupo de ';
  let s = groupText || '';
  if (s.startsWith(prefix)) s = s.slice(prefix.length);
  const parts = s.split(/\s+y\s+/i);
  if (parts.length >= 2) return sanitize(parts.slice(1).join(' y '));
  return sanitize(s);
}

async function collectDocs(page) {
  await page.goto(`${BASE}/groups/my_signed_docs`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const maxPage = await page.locator('a[href*="/groups/my_signed_docs"]').evaluateAll(els => {
    const nums = els.map(e => {
      const href = e.getAttribute('href') || '';
      const m = href.match(/[?&]page=(\d+)/);
      if (m) return parseInt(m[1], 10);
      const txt = parseInt((e.textContent || '').trim(), 10);
      return Number.isNaN(txt) ? null : txt;
    }).filter(n => Number.isFinite(n));
    return nums.length ? Math.max(...nums) : 1;
  }).catch(() => 1);

  const all = [];
  for (let p = 1; p <= maxPage; p++) {
    const url = p === 1
      ? `${BASE}/groups/my_signed_docs`
      : `${BASE}/groups/my_signed_docs?container_id=container-signed-mxmls&page=${p}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    const rows = await page.locator('tr').evaluateAll(trs => trs.map(tr => {
      const docLink = tr.querySelector('a[href*="/show_mxml"]');
      if (!docLink) return null;
      const fullTextLink = Array.from(tr.querySelectorAll('a[href*="/show_mxml"]')).find(a => (a.textContent || '').trim().length > 0);
      const small = tr.querySelector('small');
      const title = (fullTextLink?.textContent || '').trim();
      const href = docLink.getAttribute('href') || '';
      const groupLink = Array.from(tr.querySelectorAll('a[href^="/groups/"]')).find(a => (a.textContent || '').includes('Grupo de '));
      const group = (groupLink?.textContent || '').trim();
      const meta = (small?.innerText || '').trim();
      return { title, href, group, meta };
    }).filter(Boolean));

    for (const row of rows) {
      const match = row.href.match(/\/groups\/([^/]+)\/show_mxml/);
      if (!match) continue;
      const id = match[1];
      all.push({
        id,
        title: row.title,
        group: row.group,
        investor: investorFromGroup(row.group),
        meta: row.meta,
        downloadUrl: `${BASE}/groups/download_pdf_doc?id=${id}`,
        sourceUrl: `${BASE}${row.href}`,
        page: p,
      });
    }
  }
  return all;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    acceptDownloads: true,
  });

  const page = context.pages()[0] || await context.newPage();
  const docs = await collectDocs(page);
  console.log(`DOCS_FOUND: ${docs.length}`);

  const docsWithTargets = docs.map(doc => {
    const investor = doc.investor || 'sin_inversionista';
    const relativeTarget = path.join(investor, sanitize(`${doc.title || doc.id}.pdf`));
    return { ...doc, relativeTarget };
  });

  const targetCounts = new Map();
  for (const doc of docsWithTargets) {
    targetCounts.set(doc.relativeTarget, (targetCounts.get(doc.relativeTarget) || 0) + 1);
  }

  const finalizedDocs = docsWithTargets.map(doc => {
    const duplicate = (targetCounts.get(doc.relativeTarget) || 0) > 1;
    const finalRelativeTarget = duplicate
      ? path.join(doc.investor || 'sin_inversionista', sanitize(`${doc.title || doc.id}__${doc.id}.pdf`))
      : doc.relativeTarget;
    return { ...doc, finalRelativeTarget };
  });

  const toDownload = limit > 0 ? finalizedDocs.slice(0, limit) : finalizedDocs;
  const dlPage = page;
  const failures = [];

  for (let i = 0; i < toDownload.length; i++) {
    const doc = toDownload[i];
    const target = path.join(outDir, doc.finalRelativeTarget);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    console.log(`DOWNLOADING ${i + 1}/${toDownload.length}: ${doc.title} -> ${target}`);
    try {
      const downloadPromise = dlPage.waitForEvent('download', { timeout: 30000 });
      await dlPage.goto(doc.downloadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(err => {
        if (!String(err.message || err).includes('Download is starting')) throw err;
      });
      const download = await downloadPromise;
      await download.saveAs(target);
      console.log(`SAVED: ${target}`);
    } catch (err) {
      const error = String(err && err.message ? err.message : err);
      failures.push({ id: doc.id, title: doc.title, target, error, downloadUrl: doc.downloadUrl });
      console.log(`FAILED: ${doc.title} :: ${error}`);
    }
    await dlPage.waitForTimeout(500);
  }

  fs.writeFileSync(path.join(outDir, '_index.json'), JSON.stringify(toDownload, null, 2));
  fs.writeFileSync(path.join(outDir, '_failures.json'), JSON.stringify(failures, null, 2));
  fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify({
    docsFound: docs.length,
    attempted: toDownload.length,
    failures: failures.length,
    outDir,
  }, null, 2));
  console.log(`FAILURES_COUNT: ${failures.length}`);
  console.log('DONE');
  await context.close();
}

main().catch(err => {
  console.error('FIRMAYA_DOWNLOAD_ALL_ERROR:', err);
  process.exit(1);
});
