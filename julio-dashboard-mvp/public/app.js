async function loadDashboard() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) {
    location.href = '/login';
    return;
  }
  const data = await res.json();
  renderHero(data);
  renderMachine(data.machine || null);
  renderStory(data.story || null);
  renderAccounts(data.accounts || [], data.today);
  renderSettlements(data.settlements || []);
  renderOperations(data.operations || []);
  renderNotes(data.notes || []);
}

function clp(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function renderHero(data) {
  const computed = data.computed || {};
  const cards = [
    ['Liquidez visible total', clp(computed.totalVisibility), 'Caja visible + montos retenidos'],
    ['Disponible bancario', clp(computed.totalBankBalance), 'Saldo hoy en cuentas visibles'],
    ['Pendiente por liberar', clp(computed.pendingTotal), 'Fondos en espera / clearing'],
    ['Operaciones del día', `${computed.operationsTodayCount || 0}`, clp(computed.operationsTodayAmount || 0)]
  ];

  document.getElementById('hero-cards').innerHTML = cards.map(([title, value, detail]) => `
    <div class="card metric-card">
      <div class="metric-title">${title}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-detail">${detail}</div>
    </div>
  `).join('');
}

function metricValue(metric) {
  if (!metric) return '-';
  if (metric.kind === 'currency') return clp(metric.value);
  if (metric.kind === 'percent') return `${Number(metric.value || 0).toFixed(1)}%`;
  return String(metric.value ?? '-');
}

function renderMachine(machine) {
  const container = document.getElementById('machine-panel');
  if (!container) return;
  if (!machine || !machine.metrics || !machine.metrics.length) {
    container.innerHTML = '';
    return;
  }

  const notes = machine.notes || [];
  container.innerHTML = `
    <div class="panel machine-panel">
      <div class="section-title-row">
        <div>
          <h2>${machine.title || 'Máquina de dinero'}</h2>
          <div class="muted">${machine.periodLabel || ''}</div>
        </div>
      </div>
      <div class="cards-grid machine-grid">
        ${machine.metrics.map((metric) => `
          <div class="card metric-card compact">
            <div class="metric-title">${metric.label}</div>
            <div class="metric-value">${metricValue(metric)}</div>
            <div class="metric-detail">${metric.detail || ''}</div>
          </div>
        `).join('')}
      </div>
      ${notes.length ? `
        <ul class="notes-list machine-notes">
          ${notes.map((note) => `<li>${note}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

function renderStory(story) {
  const container = document.getElementById('story-panel');
  if (!container) return;
  if (!story || (!story.metrics?.length && !story.sections?.length)) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="panel story-panel">
      <div class="section-title-row">
        <div>
          <h2>${story.title || 'Narrativa de escalamiento'}</h2>
          <div class="muted">${story.subtitle || ''}</div>
        </div>
      </div>
      ${story.metrics?.length ? `
        <div class="cards-grid machine-grid">
          ${story.metrics.map((metric) => `
            <div class="card metric-card compact">
              <div class="metric-title">${metric.label}</div>
              <div class="metric-value">${metricValue(metric)}</div>
              <div class="metric-detail">${metric.detail || ''}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${story.sections?.length ? `
        <div class="story-sections">
          ${story.sections.map((section) => `
            <div class="story-block">
              <h3>${section.title}</h3>
              <ul class="notes-list">
                ${(section.bullets || []).map((bullet) => `<li>${bullet}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderAccounts(accounts, today) {
  document.getElementById('as-of-label').textContent = `Corte: ${today}`;
  document.getElementById('accounts-table').innerHTML = `
    <table>
      <thead>
        <tr><th>Cuenta</th><th>Institución</th><th>Moneda</th><th>Saldo</th><th>Estado</th></tr>
      </thead>
      <tbody>
        ${accounts.map((acc) => `
          <tr>
            <td>${acc.name}</td>
            <td>${acc.institution}</td>
            <td>${acc.currency || 'CLP'}</td>
            <td>${clp(acc.balance)}</td>
            <td><span class="pill ${acc.status === 'PENDING' ? 'pending' : 'ok'}">${acc.statusLabel || acc.status || 'OK'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSettlements(items) {
  document.getElementById('settlements-table').innerHTML = `
    <table>
      <thead>
        <tr><th>Origen</th><th>Monto</th><th>Liberación</th><th>Días</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${item.source}</td>
            <td>${clp(item.amount)}</td>
            <td>${item.releaseDate}</td>
            <td>${item.daysRemaining}</td>
            <td><span class="pill ${item.daysRemaining <= 0 ? 'ok' : 'pending'}">${item.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderOperations(items) {
  document.getElementById('operations-table').innerHTML = `
    <table>
      <thead>
        <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Monto</th><th>Cuenta</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${item.date}</td>
            <td>${item.type}</td>
            <td>${item.description}</td>
            <td>${clp(item.amount)}</td>
            <td>${item.account}</td>
            <td>${item.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderNotes(notes) {
  document.getElementById('notes-list').innerHTML = `
    <ul class="notes-list">
      ${notes.map((note) => `<li>${note}</li>`).join('')}
    </ul>
  `;
}

loadDashboard().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:24px;color:#fff;background:#111">Error cargando dashboard: ${err.message}</pre>`;
});
