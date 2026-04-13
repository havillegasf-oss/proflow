from pathlib import Path
import json
import csv
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
TIMELINE = json.loads((BASE / '_family_sequence_timeline.json').read_text())
SHEET = json.loads((BASE / '_google_sheet_crosswalk_via_aux.json').read_text())
STATUS_OVERRIDES_FILE = Path('firmaya_manual_status_overrides.json')
STATUS_OVERRIDES = json.loads(STATUS_OVERRIDES_FILE.read_text()) if STATUS_OVERRIDES_FILE.exists() else {}
OUT_JSON = BASE / 'master_cashflow_base.json'
OUT_CSV = BASE / 'master_cashflow_base.csv'
SHEET_CUTOFF = datetime(2026, 3, 15)

MONTHS = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'setiembre': 9, 'octubre': 10,
    'noviembre': 11, 'diciembre': 12,
}


def parse_spanish_date(s: str):
    s = (s or '').strip().lower()
    parts = s.split(' | ')
    dates = []
    for part in parts:
        part = part.strip().lower()
        if not part:
            continue
        part = part.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
        import re
        m = re.match(r'(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})', part)
        if not m:
            continue
        d, mon, y = m.groups()
        month = MONTHS.get(mon)
        if month:
            dates.append(datetime(int(y), month, int(d)))
    return max(dates) if dates else None

sheet_index = {
    (r['family_key'], r['contract_track'], r['sequence_number']): r
    for r in SHEET
}

rows = []
for row in TIMELINE:
    key = (row['family_key'], row['contract_track'], row['sequence_number'])
    sheet = sheet_index.get(key, {})
    status_counts = sheet.get('sheet_status_counts', {})
    pagado = status_counts.get('PAGADO', 0)
    renovado = status_counts.get('RENOVADO', 0)
    liquidado = status_counts.get('LIQUIDADO', 0)
    por_pagar = status_counts.get('POR PAGAR', 0)
    pendiente = status_counts.get('PENDIENTE DE PAGO', 0)

    latest_signed_date = parse_spanish_date(' | '.join(row.get('signed_dates', [])))

    if liquidado > 0:
        status = 'LIQUIDADO'
    elif por_pagar > 0 and pagado == 0 and renovado == 0:
        status = 'POR_PAGAR'
    elif renovado > 0 and pagado > 0:
        status = 'RENOVADO_CON_PAGOS'
    elif renovado > 0:
        status = 'RENOVADO'
    elif pagado > 0:
        status = 'PAGADO'
    elif pendiente > 0:
        status = 'PENDIENTE'
    elif row.get('payment_months_detected'):
        status = 'EVIDENCIA_PAGO_AUX'
    elif latest_signed_date and latest_signed_date >= SHEET_CUTOFF and sheet.get('sheet_matches', 0) == 0:
        status = 'POST_CORTE_SHEET'
    else:
        status = 'SIN_CLASIFICAR'

    confidence = 'media'
    if liquidado > 0 or pagado > 0 or renovado > 0 or por_pagar > 0:
        confidence = 'alta'
    elif len(row.get('payment_months_detected', [])) >= 3:
        confidence = 'media_alta'

    base_id = f"{row['family_key']}|{row['contract_track']}|{row['sequence_number']}"
    override = STATUS_OVERRIDES.get(base_id, {})
    if override.get('status'):
        status = override['status']
        confidence = 'alta'

    rows.append({
        'base_id': base_id,
        'family_key': row['family_key'],
        'contract_track': row['contract_track'],
        'sequence_number': row['sequence_number'],
        'documents': row['documents'],
        'signed_dates': ' | '.join(row.get('signed_dates', [])),
        'capital_values': ' | '.join(str(x) for x in row.get('capital_values', [])),
        'event_estimates': ' | '.join(row.get('event_estimates', [])),
        'payment_months_detected': ' | '.join(str(x) for x in row.get('payment_months_detected', [])),
        'payment_evidence_files': row.get('payment_evidence_files', 0),
        'sheet_matches': sheet.get('sheet_matches', 0),
        'sheet_pagado_count': pagado,
        'sheet_renovado_count': renovado,
        'sheet_liquidado_count': liquidado,
        'sheet_por_pagar_count': por_pagar,
        'sheet_pendiente_count': pendiente,
        'status_inferred': status,
        'confidence': confidence,
        'titles': ' | '.join(row.get('titles', [])),
        'sheet_examples': ' | '.join(sheet.get('sheet_examples', [])[:5]),
        'manual_note': override.get('note', ''),
    })

OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
    writer.writeheader()
    writer.writerows(rows)

summary = {
    'rows': len(rows),
    'status_counts': {},
}
for r in rows:
    summary['status_counts'][r['status_inferred']] = summary['status_counts'].get(r['status_inferred'], 0) + 1

print(json.dumps(summary, ensure_ascii=False, indent=2))
