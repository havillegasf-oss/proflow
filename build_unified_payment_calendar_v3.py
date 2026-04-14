from pathlib import Path
import csv
import json
import re
import unicodedata
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
ORIG_CSV = BASE / 'google_sheets_paid_contracts.csv'
SHEET_JSON = BASE / '_google_paid_contracts.json'
GEN_JSON = BASE / 'payment_calendar_like_sheet.json'
MASTER_JSON = BASE / 'master_cashflow_base.json'
CROSSWALK_JSON = BASE / '_google_sheet_crosswalk_via_aux.json'
ALIASES_FILE = Path('firmaya_manual_alias_overrides.json')
OUT_CSV = BASE / 'payment_calendar_unified_v3.csv'
OUT_JSON = BASE / 'payment_calendar_unified_v3.json'
SUMMARY = BASE / 'payment_calendar_unified_v3_summary.json'

TODAY = datetime(2026, 4, 13)
SHEET_CUTOFF = datetime(2026, 3, 15)
MASTER = {r['base_id']: r for r in json.loads(MASTER_JSON.read_text())}
GEN = json.loads(GEN_JSON.read_text())
SHEET = json.loads(SHEET_JSON.read_text())
CROSS = json.loads(CROSSWALK_JSON.read_text())
ALIASES = json.loads(ALIASES_FILE.read_text()) if ALIASES_FILE.exists() else {}


def norm(s: str) -> str:
    s = (s or '').strip().upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def canon(s: str) -> str:
    n = norm(s)
    return norm(ALIASES.get(n, n))


def related(label: str, alias: str):
    if not label or not alias:
        return False
    if label == alias or label in alias or alias in label:
        return True
    lt = {t for t in label.split() if len(t) >= 4}
    at = {t for t in alias.split() if len(t) >= 4}
    return len(lt & at) >= 1


def norm_amount(s):
    return re.sub(r'[^0-9]', '', s or '')


def parse_any_date(s):
    s = (s or '').strip()
    for fmt in ('%d-%m-%y', '%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None


def to_dash(s):
    dt = parse_any_date(s)
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

# aliases / candidate sheet rows by base_id
aliases_by_base = {}
for r in CROSS:
    base_id = f"{r['family_key']}|{r['contract_track']}|{r['sequence_number']}"
    aliases_by_base[base_id] = {
        'track': r['contract_track'],
        'sequence': r['sequence_number'],
        'aliases': [canon(a) for a in r.get('aliases', []) if a],
    }

candidates_by_base = {}
for base_id, meta in aliases_by_base.items():
    candidates = []
    for s in SHEET:
        if meta['track'] and s.get('track') and meta['track'] != s['track']:
            continue
        if meta['sequence'] is not None and s.get('sequence') is not None and meta['sequence'] != s['sequence']:
            continue
        label = canon(s.get('label') or s.get('name_raw') or '')
        if meta['aliases'] and any(related(label, alias) for alias in meta['aliases']):
            candidates.append(s)
    candidates_by_base[base_id] = candidates


def exact_status_from_sheet(base_id, date_dash, amount_text):
    amount = norm_amount(amount_text)
    for s in candidates_by_base.get(base_id, []):
        if to_dash(s.get('date_text')) != date_dash:
            continue
        if amount and norm_amount(s.get('amount_text')) == amount:
            return s.get('status', ''), s.get('name_raw', '')
    return '', ''

rows = []
added_keys = set()
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
        dt = parse_any_date(date_text)
        key = (norm(name), to_dash(date_text), norm_amount(amount_text))
        added_keys.add(key)
        rows.append({
            'NOMBRE': name,
            'FECHA': to_dash(date_text),
            'MONTO': amount_text,
            'STATUS': status,
            'TIPO_EVENTO': 'ORIGINAL_SHEET',
            'FUENTE': 'sheet_original',
            'STATUS_ORIGEN': 'Hoja 1',
            'INVERSIONISTA': '',
            'BASE_ID': '',
            'ORDEN_FECHA': dt.strftime('%Y-%m-%d') if dt else '',
        })

for r in GEN:
    date_dash = to_dash(r['date_text'])
    dt = parse_any_date(r['date_text'])
    amount_text = r['amount_text']
    key = (norm(r['name']), date_dash, norm_amount(amount_text))
    if key in added_keys:
        continue
    status, matched_name = exact_status_from_sheet(r['base_id'], date_dash, amount_text)
    if not status:
        status = 'POR PAGAR' if dt and dt > TODAY else ('NO ACTUALIZADO' if dt and dt > SHEET_CUTOFF else 'REVISAR')
        source = 'regla_fecha'
    else:
        source = 'Hoja 1 por match'
    rows.append({
        'NOMBRE': r['name'],
        'FECHA': date_dash,
        'MONTO': amount_text,
        'STATUS': status,
        'TIPO_EVENTO': 'INTERES',
        'FUENTE': 'contrato_generado',
        'STATUS_ORIGEN': source,
        'INVERSIONISTA': r['family_key'],
        'BASE_ID': r['base_id'],
        'ORDEN_FECHA': r['date_iso'],
    })
    added_keys.add(key)

for r in GEN:
    if str(r.get('payment_index')) != str(r.get('payment_dates_count')):
        continue
    final_capital = (r.get('final_capital_payment') or '').strip()
    if not final_capital:
        continue
    date_dash = to_dash(r['date_text'])
    dt = parse_any_date(r['date_text'])
    amount_text = f"${final_capital}" if not final_capital.startswith('$') else final_capital
    key = (norm(r['name']), date_dash, norm_amount(amount_text))
    if key in added_keys:
        continue
    status, matched_name = exact_status_from_sheet(r['base_id'], date_dash, amount_text)
    if not status:
        contract_status = MASTER.get(r['base_id'], {}).get('status_inferred', '')
        status = capital_status(contract_status, dt)
        source = 'capital_contractual'
    else:
        source = 'Hoja 1 por match'
    rows.append({
        'NOMBRE': r['name'],
        'FECHA': date_dash,
        'MONTO': amount_text,
        'STATUS': status,
        'TIPO_EVENTO': 'CAPITAL',
        'FUENTE': 'capital_generado',
        'STATUS_ORIGEN': source,
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
    'status_from_sheet_match': sum(1 for r in rows if r['STATUS_ORIGEN'] == 'Hoja 1 por match'),
    'status_from_rule_date': sum(1 for r in rows if r['STATUS_ORIGEN'] == 'regla_fecha'),
    'status_from_contract_capital': sum(1 for r in rows if r['STATUS_ORIGEN'] == 'capital_contractual'),
    'min_date': rows[0]['ORDEN_FECHA'] if rows else None,
    'max_date': rows[-1]['ORDEN_FECHA'] if rows else None,
}
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
