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
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

function loadDashboardData() {
  const raw = readJson(DATA_FILE);
  const today = raw.today || todayISO();
  const settlements = (raw.settlements || []).map((item) => {
    const releaseDate = item.releaseDate || item.expectedReleaseDate;
    const daysRemaining = daysBetween(today, releaseDate);
    return {
      ...item,
      releaseDate,
      daysRemaining,
      status: daysRemaining <= 0 ? 'LIBERABLE' : 'EN ESPERA'
    };
  });

  const operationsToday = (raw.operations || []).filter((op) => op.date === today);
  const totalBankBalance = (raw.accounts || []).reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  const pendingTotal = settlements.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const availableLiquidity = totalBankBalance;
  const totalVisibility = totalBankBalance + pendingTotal;

  return {
    ...raw,
    today,
    computed: {
      totalBankBalance,
      pendingTotal,
      availableLiquidity,
      totalVisibility,
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
  <title>ProFlow - Acceso inversionista</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="login-body">
  <div class="login-card">
    <div class="eyebrow">ProFlow / La Caja Chica</div>
    <h1>Acceso inversionista</h1>
    <p>Visualizador de liquidez y operaciones.</p>
    ${error ? `<div class="error-box">${error}</div>` : ''}
    <form method="post" action="/login" class="login-form">
      <label>Usuario<input name="username" autocomplete="username" required /></label>
      <label>Clave<input name="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">Ingresar</button>
    </form>
    <div class="demo-note">MVP demo. Seguridad básica solo para presentación inicial.</div>
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
      <div class="eyebrow">ProFlow / La Caja Chica</div>
      <h1>Dashboard de liquidez</h1>
    </div>
    <div class="topbar-actions">
      <span class="badge">MVP inversionista</span>
      <a href="/logout">Salir</a>
    </div>
  </header>

  <main class="container">
    <section id="hero-cards" class="cards-grid"></section>

    <section id="machine-panel"></section>

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
  if (req.method === 'GET' && url.pathname === '/login') {
    return sendHtml(res, loginPage());
  }
  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await readBody(req);
    const { username, password } = parseForm(body);
    if (username === DEMO_USER && password === DEMO_PASS) {
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, { username, createdAt: Date.now() });
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
    return sendJson(res, loadDashboardData());
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
