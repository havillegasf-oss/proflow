const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const currentPath = path.join(__dirname, 'data', 'current.json');
const batchPath = path.join(root, 'state', 'sphere', 'batch_history_snapshot.json');
const paymentPath = path.join(root, 'state', 'sphere', 'payment_history_snapshot.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function toIsoDate(mmddyyyy) {
  const [m, d, y] = mmddyyyy.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function main() {
  const current = readJson(currentPath);
  const batch = readJson(batchPath);
  const payment = readJson(paymentPath);
  const batchRows = batch.rows || [];
  const paymentSummary = payment.summary || {};
  const totalBatchVolume = batchRows.reduce((sum, row) => sum + Number(row.totalNet || 0), 0);
  const totalTransactions = batchRows.reduce((sum, row) => sum + Number(row.transactionCount || 0), 0);
  const avgTicket = totalTransactions ? totalBatchVolume / totalTransactions : 0;

  const sphereOps = batchRows.map((row) => ({
    date: toIsoDate(row.reportDate),
    type: 'Batch Sphere',
    description: `Batch ${row.batchNumber} | Terminal ${row.terminalNumber} | ${row.transactionCount} transacciones`,
    amount: row.totalNet,
    account: 'Sphere / Smart Global Advisory',
    status: row.nonSettledNet > 0 ? 'Con parte no liquidada' : 'Settled'
  }));

  const sphereNotes = [
    `Sphere Batch History 04/01-04/14: ${batchRows.length || 0} batches visibles, ${totalTransactions || 0} transacciones y ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalBatchVolume)} en volumen capturado.`,
    `Sphere Deposit History mismo corte: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(paymentSummary.depositsAmount || 0))} en depósitos, ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.abs(Number(paymentSummary.debitsAmount || 0)))} en débitos/ajustes y neto ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(paymentSummary.netDeposit || 0))}.`,
    'Sphere quedó conectado vía navegador autenticado y extractores locales; Transaction Search sigue pendiente de filtro útil, pero Batch History + Deposit History ya aportan señal real al MVP.'
  ];

  current.machine = {
    title: 'Máquina de dinero, señal operativa real',
    periodLabel: 'Sphere / Smart Global Advisory, corte 01-04 al 14-04',
    metrics: [
      { label: 'Volumen procesado', value: totalBatchVolume, kind: 'currency', detail: 'Batch History visible del período' },
      { label: 'Transacciones', value: totalTransactions, kind: 'number', detail: 'Operaciones visibles en batches' },
      { label: 'Batches', value: batchRows.length, kind: 'number', detail: 'Lotes procesados visibles' },
      { label: 'Ticket promedio', value: avgTicket, kind: 'currency', detail: 'Promedio por transacción' },
      { label: 'Depósito neto', value: Number(paymentSummary.netDeposit || 0), kind: 'currency', detail: 'Neto visto en Deposit History' },
      { label: 'Débitos / ajustes', value: Math.abs(Number(paymentSummary.debitsAmount || 0)), kind: 'currency', detail: 'Cargo y ajuste visto en Deposit History' }
    ],
    notes: [
      'Esto no prueba por sí solo rentabilidad final de La Caja Chica, pero sí demuestra tracción operativa, volumen y capacidad de procesamiento real.',
      'La siguiente capa es conectar rentabilidad real de Caja Chica encima de esta base operativa, no reemplazarla.'
    ]
  };

  current.operations = uniqueBy([
    ...sphereOps,
    ...(current.operations || [])
  ], (item) => `${item.date}|${item.type}|${item.description}|${item.amount}`)
    .sort((a, b) => `${b.date}|${b.description}`.localeCompare(`${a.date}|${a.description}`))
    .slice(0, 25);

  current.notes = uniqueBy([
    ...sphereNotes,
    ...(current.notes || [])
  ], (item) => item);

  current.today = current.today || new Date().toISOString().slice(0, 10);

  fs.writeFileSync(currentPath, JSON.stringify(current, null, 2) + '\n');
  console.log(JSON.stringify({
    updated: currentPath,
    addedSphereOperations: sphereOps.length,
    notesAdded: sphereNotes.length,
    operationsNow: current.operations.length
  }, null, 2));
}

main();
