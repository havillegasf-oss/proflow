const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CDP_URL = process.env.SPHERE_CDP_URL || 'http://127.0.0.1:9222';
const OUTDIR = path.join(process.cwd(), 'state', 'sphere');
const PAGES = [
  'https://spheretransact.com/TransactionSearch.aspx',
  'https://spheretransact.com/BatchHistory.aspx',
];

async function inspectPage(page, url) {
  const netReqs = [];
  page.on('request', (r) => {
    if (r.url().includes('spheretransact.com')) {
      netReqs.push({ method: r.method(), url: r.url(), type: r.resourceType() });
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, select'))
      .filter((el) => el.id || el.name)
      .map((el) => ({
        tag: el.tagName,
        type: el.type,
        id: el.id,
        name: el.name,
        value: el.value,
        options: el.tagName === 'SELECT'
          ? Array.from(el.options).map((o) => ({ v: o.value, t: o.textContent.trim() }))
          : null,
      }));

    const buttons = Array.from(document.querySelectorAll('button,input[type=button],input[type=submit],a'))
      .map((el) => ({
        text: (el.innerText || el.value || '').trim().slice(0, 80),
        id: el.id,
        onclick: (el.getAttribute('onclick') || '').slice(0, 150),
      }))
      .filter((el) => /export|excel|csv|download|search|submit|batch/i.test(`${el.text} ${el.id} ${el.onclick}`));

    const tables = Array.from(document.querySelectorAll('table'))
      .map((t) => ({
        id: t.id,
        cls: t.className,
        headers: Array.from(t.querySelectorAll('th')).map((h) => h.innerText.trim()).filter(Boolean),
        rowCount: t.querySelectorAll('tbody tr').length,
        sample: Array.from(t.querySelectorAll('tbody tr')).slice(0, 2)
          .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())),
      }))
      .filter((t) => t.headers.length > 0 || t.rowCount > 0);

    return {
      title: document.title,
      url: location.href,
      inputs,
      buttons,
      tables,
    };
  });

  const apiCalls = netReqs.filter((r) => ['xhr', 'fetch', 'document'].includes(r.type) && !r.url.match(/\.(js|css|png|jpg|gif|woff|ico)/));
  return { ...info, apiCalls };
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();
  const out = {};

  for (const url of PAGES) {
    console.log('Inspecting:', url);
    try {
      out[url] = await inspectPage(page, url);
    } catch (e) {
      out[url] = { error: e.message };
    }
  }

  fs.mkdirSync(OUTDIR, { recursive: true });
  const p = path.join(OUTDIR, 'page_inspection.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  console.log('Saved:', p);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
