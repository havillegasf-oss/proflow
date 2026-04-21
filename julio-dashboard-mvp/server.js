const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3080);
const HOST = process.env.HOST || '0.0.0.0';
const DEMO_USER = process.env.DASH_USER || 'julio';
const DEMO_PASS = process.env.DASH_PASS || 'proflow2026';
const DATA_FILE = process.env.DASH_DATA_FILE || path.join(__dirname, 'data', 'current.json');
const AUDIT_FILE = path.join(__dirname, 'data', 'login_audit.jsonl');

const sessions = new Map();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatCLP(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function isoDate(value) {
  return new Date(value + 'T00:00:00');
}

function daysBetween(a, b) {
  const ms = isoDate(b) - isoDate(a);
  return Math.round(ms / 86400000);
}

function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    out[trimmed.slice(0, idx)] = decodeURIComponent(trimmed.slice(idx + 1));
  });
  return out;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token) return null;
  return sessions.get(token) || null;
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    redirect(res, '/login');
    return false;
  }
  return true;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendHtml(res, html, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendHtml(res, '<h1>404</h1>', 404);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function assetContentType(filePath) {
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseForm(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function appendAudit(event) {
  fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
  fs.appendFileSync(AUDIT_FILE, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
}

function readAuditEntries(limit = 200) {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { type: 'invalid_line', raw: line };
    }
  });
}

function loadDashboardData() {
  const raw = readJson(DATA_FILE);
  const today = todayISO();
  const settlements = (raw.settlements || []).map((item) => {
    const releaseDate = item.releaseDate || item.expectedReleaseDate || item.releaseLabel || 'Por definir';
    const hasIsoReleaseDate = /^\d{4}-\d{2}-\d{2}$/.test(releaseDate);
    const daysRemaining = hasIsoReleaseDate ? daysBetween(today, releaseDate) : (item.daysRemaining ?? '');
    return {
      ...item,
      releaseDate,
      daysRemaining,
      status: item.status || (hasIsoReleaseDate ? (daysRemaining <= 0 ? 'LIBERABLE' : 'EN ESPERA') : 'RETENIDO'),
      statusClass: item.statusClass || (hasIsoReleaseDate ? (daysRemaining <= 0 ? 'ok' : 'pending') : 'pending')
    };
  });

  const operationsToday = (raw.operations || []).filter((op) => op.date === today);
  const sumByCurrency = (items, amountField = 'balance') => items.reduce((acc, item) => {
    const currency = item.currency || 'CLP';
    acc[currency] = (acc[currency] || 0) + Number(item[amountField] || 0);
    return acc;
  }, {});

  const availableByCurrency = sumByCurrency(raw.accounts || [], 'balance');
  const pendingByCurrency = sumByCurrency(settlements, 'amount');
  const visibilityByCurrency = Object.fromEntries(
    Array.from(new Set([...Object.keys(availableByCurrency), ...Object.keys(pendingByCurrency)])).map((currency) => [
      currency,
      Number(availableByCurrency[currency] || 0) + Number(pendingByCurrency[currency] || 0)
    ])
  );
  const fxRateUsdClp = Number(raw.fxRateUsdClp || 0);
  const clpAsUsd = fxRateUsdClp > 0 ? Number(availableByCurrency.CLP || 0) / fxRateUsdClp : 0;
  const usdAvailable = Number(availableByCurrency.USD || 0);
  const usdRetained = Number(pendingByCurrency.USD || 0);
  const totalLiquidityUsd = clpAsUsd + usdAvailable + usdRetained;

  return {
    ...raw,
    today,
    computed: {
      totalBankBalance: Number(availableByCurrency.CLP || 0),
      pendingTotal: Number(pendingByCurrency.CLP || 0),
      availableLiquidity: Number(availableByCurrency.CLP || 0),
      totalVisibility: Number(visibilityByCurrency.CLP || 0),
      availableByCurrency,
      pendingByCurrency,
      visibilityByCurrency,
      heroCards: [
        {
          title: 'CLP disponible',
          kind: 'currency',
          currency: 'CLP',
          value: Number(availableByCurrency.CLP || 0),
          detail: 'Saldo bancario disponible hoy'
        },
        {
          title: 'USD disponible',
          kind: 'currency',
          currency: 'USD',
          value: usdAvailable,
          detail: 'Santander USD + Chase USD'
        },
        {
          title: 'USD retenido',
          kind: 'currency',
          currency: 'USD',
          value: usdRetained,
          detail: 'Santander retenido + reserva NMI'
        },
        {
          title: 'Liquidez total USD',
          kind: 'currency',
          currency: 'USD',
          value: totalLiquidityUsd,
          detail: fxRateUsdClp > 0 ? `Incluye CLP convertido a ${fxRateUsdClp.toFixed(2)}` : 'Disponible + retenido'
        }
      ],
      fxRateUsdClp,
      clpAsUsd,
      totalLiquidityUsd,
      operationsTodayCount: operationsToday.length,
      operationsTodayAmount: operationsToday.reduce((sum, op) => sum + Number(op.amount || 0), 0)
    },
    settlements,
    operationsToday
  };
}

function loginPage(error = '') {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ProFlow</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="login-body">
  <div class="login-card">
    <div class="brand-lockup login-lockup brand-inline">
      <img src="/assets/caja-chica.png" alt="La Caja Chica" class="brand-logo caja-logo" />
      <span class="brand-connector">By</span>
      <img src="/assets/proflow-latam.png" alt="ProFlow Latam" class="brand-logo proflow-logo" />
    </div>
    <h1>Accesos</h1>
    <p>Visualizador de liquidez, operación y capacidad de escala.</p>
    ${error ? `<div class="error-box">${error}</div>` : ''}
    <form method="post" action="/login" class="login-form">
      <label>Usuario<input name="username" autocomplete="username" required /></label>
      <label>Clave<input name="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">Ingresar</button>
    </form>
  </div>
</body>
</html>`;
}

function dashboardPage() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ProFlow - Dashboard</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="topbar">
    <div>
      <div class="brand-lockup topbar-lockup brand-inline">
        <img src="/assets/caja-chica.png" alt="La Caja Chica" class="brand-logo caja-logo" />
        <span class="brand-connector">By</span>
        <img src="/assets/proflow-latam.png" alt="ProFlow Latam" class="brand-logo proflow-logo" />
      </div>
      <h1>DASHBOARD DE LIQUIDEZ</h1>
      <div class="muted">Liquidez, operación y narrativa de escala</div>
    </div>
    <div class="topbar-actions">
      <a href="/logout">Salir</a>
    </div>
  </header>

  <main class="container">
    <section id="hero-cards" class="cards-grid"></section>

    <section id="machine-panel"></section>
    <section id="story-panel"></section>
    <section id="profitability-panel"></section>

    <section class="panel two-col">
      <div>
        <div class="section-title-row">
          <h2>Cuentas</h2>
          <span id="as-of-label" class="muted"></span>
        </div>
        <div id="accounts-table"></div>
      </div>
      <div>
        <h2>Pendientes por liberar</h2>
        <div id="settlements-table"></div>
      </div>
    </section>

    <section class="panel">
      <h2>Operaciones recientes</h2>
      <div id="operations-table"></div>
    </section>

    <section class="panel">
      <h2>Notas operativas</h2>
      <div id="notes-list"></div>
    </section>
  </main>

  <script src="/app.js"></script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/styles.css') {
    return sendFile(res, path.join(__dirname, 'public', 'styles.css'), 'text/css; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/app.js') {
    return sendFile(res, path.join(__dirname, 'public', 'app.js'), 'application/javascript; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    return sendFile(res, path.join(__dirname, 'public', url.pathname), assetContentType(url.pathname));
  }
  if (req.method === 'GET' && url.pathname === '/login') {
    return sendHtml(res, loginPage());
  }
  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await readBody(req);
    const { username, password } = parseForm(body);
    if (username === DEMO_USER && password === DEMO_PASS) {
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, { username, createdAt: Date.now(), lastViewAuditAt: 0 });
      appendAudit({
        type: 'login_success',
        username,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || ''
      });
      res.writeHead(302, {
        'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax`,
        Location: '/'
      });
      return res.end();
    }
    return sendHtml(res, loginPage('Usuario o clave incorrectos.'), 401);
  }
  if (req.method === 'GET' && url.pathname === '/logout') {
    res.writeHead(302, {
      'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
      Location: '/login'
    });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    if (!requireAuth(req, res)) return;
    const session = getSession(req);
    if (session && (!session.lastViewAuditAt || (Date.now() - session.lastViewAuditAt) > 300000)) {
      session.lastViewAuditAt = Date.now();
      appendAudit({
        type: 'dashboard_view',
        username: session.username,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || ''
      });
    }
    return sendJson(res, loadDashboardData());
  }
  if (req.method === 'GET' && url.pathname === '/api/access-audit') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, { entries: readAuditEntries() });
  }
  if (req.method === 'GET' && url.pathname === '/') {
    if (!requireAuth(req, res)) return;
    return sendHtml(res, dashboardPage());
  }

  sendHtml(res, '<h1>404</h1>', 404);
});

server.listen(PORT, HOST, () => {
  console.log(`Julio dashboard running on http://${HOST}:${PORT}`);
  console.log(`Demo user: ${DEMO_USER}`);
});
