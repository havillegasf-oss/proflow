from pathlib import Path
import json
import csv

BASE = Path('state/firmaya-by-investor-v2')
master = json.loads((BASE / 'master_cashflow_base.json').read_text())
out = BASE / 'master_cashflow_google_sheet_ready.csv'
summary = BASE / 'master_cashflow_summary.csv'

rows = []
for r in master:
    rows.append({
        'ID': r['base_id'],
        'Inversionista': r['family_key'],
        'Linea': r['contract_track'],
        'Secuencia': r['sequence_number'],
        'Estado': r['status_inferred'],
        'Confianza': r['confidence'],
        'Capitales': r['capital_values'],
        'Fechas firma': r['signed_dates'],
        'Meses con evidencia': r['payment_months_detected'],
        'Archivos evidencia pago': r['payment_evidence_files'],
        'Matches Sheet': r['sheet_matches'],
        'PAGADO': r['sheet_pagado_count'],
        'RENOVADO': r['sheet_renovado_count'],
        'LIQUIDADO': r['sheet_liquidado_count'],
        'POR PAGAR': r['sheet_por_pagar_count'],
        'PENDIENTE': r['sheet_pendiente_count'],
        'Eventos estimados': r['event_estimates'],
        'Titulos': r['titles'],
        'Nota manual': r.get('manual_note', ''),
        'Ejemplos sheet': r['sheet_examples'],
    })

with out.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

status_counts = {}
for r in master:
    status_counts[r['status_inferred']] = status_counts.get(r['status_inferred'], 0) + 1
summary_rows = [{'Estado': k, 'Cantidad': v} for k, v in sorted(status_counts.items())]
with summary.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['Estado', 'Cantidad'])
    writer.writeheader()
    writer.writerows(summary_rows)

print(str(out))
print(str(summary))
