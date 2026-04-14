from pathlib import Path
import csv
import json
import re
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
ORIG_CSV = BASE / 'google_sheets_paid_contracts.csv'
GEN_JSON = BASE / 'payment_calendar_like_sheet.json'
MASTER_JSON = BASE / 'master_cashflow_base.json'
OUT_CSV = BASE / 'payment_calendar_unified_v2.csv'
OUT_JSON = BASE / 'payment_calendar_unified_v2.json'
SUMMARY = BASE / 'payment_calendar_unified_v2_summary.json'

TODAY = datetime(2026, 4, 13)
SHEET_CUTOFF = datetime(2026, 3, 15)
MASTER = {r['base_id']: r for r in json.loads(MASTER_JSON.read_text())}
GEN = json.loads(GEN_JSON.read_text())


def norm_name(s):
    s = (s or '').upper().strip()
    s = re.sub(r'\(.*?\)', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def norm_amount(s):
    return re.sub(r'[^0-9]', '', s or '')


def parse_dmy_dash(s):
    s = (s or '').strip()
    for fmt in ('%d-%m-%y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None


def parse_dmy_slash(s):
    try:
        return datetime.strptime(s, '%d/%m/%Y')
    except Exception:
        return None


def to_dash(s):
    dt = parse_dmy_slash(s)
    return dt.strftime('%d-%m-%y') if dt else s


def capital_status(contract_status, due_dt):
    if due_dt and due_dt > TODAY:
        return 'POR PAGAR'
    if contract_status in ('RENOVADO_CON_PAGOS', 'RENOVADO', 'RENOVADO_VIGENTE'):
        return 'RENOVADO'
    if contract_status == 'LIQUIDADO':
        return 'LIQUIDADO'
    if contract_status == 'VIGENTE':
        return 'VIGENTE'
    if contract_status == 'POST_CORTE_SHEET':
        return 'NO ACTUALIZADO'
    return 'REVISAR'


rows = []
orig_keys = set()
with ORIG_CSV.open() as f:
    reader = csv.reader(f)
    for raw in reader:
        if len(raw) < 5:
            continue
        name = (raw[1] or '').strip()
        date_text = (raw[2] or '').strip()
        amount_text = (raw[3] or '').strip()
        status = (raw[4] or '').strip().upper()
        if not name or name == 'NOMBRE':
            continue
        dt = parse_dmy_dash(date_text)
        key = (norm_name(name), date_text, norm_amount(amount_text))
        orig_keys.add(key)
        rows.append({
            'NOMBRE': name,
            'FECHA': date_text,
            'MONTO': amount_text,
            'STATUS': status,
            'TIPO_EVENTO': 'ORIGINAL_SHEET',
            'FUENTE': 'sheet_original',
            'INVERSIONISTA': '',
            'BASE_ID': '',
            'ORDEN_FECHA': dt.strftime('%Y-%m-%d') if dt else '',
        })

added_keys = set(orig_keys)
for r in GEN:
    date_text = to_dash(r['date_text'])
    dt = parse_dmy_slash(r['date_text'])
    amount_text = r['amount_text']
    key = (norm_name(r['name']), date_text, norm_amount(amount_text))
    if key in added_keys:
        continue
    status = 'POR PAGAR' if dt and dt > TODAY else ('NO ACTUALIZADO' if dt and dt > SHEET_CUTOFF else 'REVISAR')
    rows.append({
        'NOMBRE': r['name'],
        'FECHA': date_text,
        'MONTO': amount_text,
        'STATUS': status,
        'TIPO_EVENTO': 'INTERES',
        'FUENTE': 'contrato_generado',
        'INVERSIONISTA': r['family_key'],
        'BASE_ID': r['base_id'],
        'ORDEN_FECHA': r['date_iso'],
    })
    added_keys.add(key)

# capital events on maturity date
for r in GEN:
    if str(r.get('payment_index')) != str(r.get('payment_dates_count')):
        continue
    final_capital = (r.get('final_capital_payment') or '').strip()
    if not final_capital:
        continue
    dt = parse_dmy_slash(r['date_text'])
    date_text = to_dash(r['date_text'])
    amount_text = f"${final_capital}" if not final_capital.startswith('$') else final_capital
    key = (norm_name(r['name']), date_text, norm_amount(amount_text))
    if key in added_keys:
        continue
    contract_status = MASTER.get(r['base_id'], {}).get('status_inferred', '')
    status = capital_status(contract_status, dt)
    rows.append({
        'NOMBRE': r['name'],
        'FECHA': date_text,
        'MONTO': amount_text,
        'STATUS': status,
        'TIPO_EVENTO': 'CAPITAL',
        'FUENTE': 'capital_generado',
        'INVERSIONISTA': r['family_key'],
        'BASE_ID': r['base_id'],
        'ORDEN_FECHA': r['date_iso'],
    })
    added_keys.add(key)

rows.sort(key=lambda r: (r['ORDEN_FECHA'] or '9999-99-99', r['NOMBRE'], r['MONTO']))

with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
with OUT_JSON.open('w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

summary = {
    'rows': len(rows),
    'from_original_sheet': sum(1 for r in rows if r['FUENTE'] == 'sheet_original'),
    'generated_interest_rows': sum(1 for r in rows if r['TIPO_EVENTO'] == 'INTERES'),
    'generated_capital_rows': sum(1 for r in rows if r['TIPO_EVENTO'] == 'CAPITAL'),
    'min_date': rows[0]['ORDEN_FECHA'] if rows else None,
    'max_date': rows[-1]['ORDEN_FECHA'] if rows else None,
}
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
