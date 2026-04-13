from pathlib import Path
import json
import csv
import re
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
ENRICHED = json.loads((BASE / '_mutuo_dataset_enriched.json').read_text())
MASTER = json.loads((BASE / 'master_cashflow_base.json').read_text())
SHEET = json.loads((BASE / '_google_paid_contracts.json').read_text())
OUT_JSON = BASE / 'payment_calendar_like_sheet.json'
OUT_CSV = BASE / 'payment_calendar_like_sheet.csv'
SUMMARY = BASE / 'payment_calendar_like_sheet_summary.json'

master_by_id = {r['base_id']: r for r in MASTER}


def norm_amount(s):
    s = (s or '').strip()
    if not s:
        return ''
    s = s.replace('$', '').replace('.', '').replace(',', '').replace(' ', '')
    return s


def parse_ddmmyyyy(s):
    try:
        return datetime.strptime(s, '%d/%m/%Y')
    except Exception:
        return None


def first_label_from_sheet_examples(s):
    parts = [p.strip() for p in (s or '').split(' | ') if p.strip()]
    return parts[0] if parts else ''


def generate_label(contract_row, master_row):
    example = first_label_from_sheet_examples(master_row.get('sheet_examples', '') if master_row else '')
    if example:
        return example
    folder = (contract_row.get('investor_folder') or contract_row.get('investor_name') or '').upper().strip()
    words = [w for w in re.split(r'\s+', folder) if w]
    short = ' '.join(words[:2]) if len(words) >= 2 else folder
    track = contract_row.get('contract_track') or 'mutuo'
    seq = contract_row.get('sequence_number_inferred')
    if seq is None:
        seq = contract_row.get('sequence_number_raw')
    suffix = ''
    if track == 'express':
        suffix += ' EXPRESS'
    if seq not in (None, '', 'None'):
        try:
            suffix += f' {int(seq):02d}'
        except Exception:
            suffix += f' {seq}'
    return f'{short}{suffix}'.strip()


rows = []
for row in ENRICHED:
    if row.get('doc_type') != 'contrato_mutuo':
        continue
    if not row.get('payment_dates'):
        continue
    seq = row.get('sequence_number_inferred')
    if seq is None:
        seq = row.get('sequence_number_raw')
    base_id = f"{row.get('family_key')}|{row.get('contract_track')}|{seq}"
    master = master_by_id.get(base_id)
    if master and master.get('status_inferred') == 'DESCARTAR':
        continue

    label = generate_label(row, master or {})
    monthly_amount = row.get('monthly_interest_amount') or ''
    if not monthly_amount:
        amounts = row.get('payment_amounts') or []
        if len(amounts) >= 2:
            monthly_amount = amounts[1]
    contract_status = master.get('status_inferred', '') if master else ''

    for idx, date_text in enumerate(row.get('payment_dates') or [], start=1):
        dt = parse_ddmmyyyy(date_text)
        rows.append({
            'base_id': base_id,
            'family_key': row.get('family_key', ''),
            'name': label,
            'date_text': date_text,
            'date_iso': dt.strftime('%Y-%m-%d') if dt else '',
            'amount_text': f"${monthly_amount}" if monthly_amount and not str(monthly_amount).startswith('$') else monthly_amount,
            'amount_norm': norm_amount(monthly_amount),
            'status': contract_status,
            'track': row.get('contract_track', ''),
            'sequence': seq if seq is not None else '',
            'payment_index': idx,
            'payment_dates_count': row.get('payment_dates_count', 0),
            'capital': row.get('capital', ''),
            'monthly_interest_amount': row.get('monthly_interest_amount', ''),
            'final_capital_payment': row.get('final_capital_payment', ''),
            'title': row.get('title', ''),
        })

deduped = []
seen = set()
for r in rows:
    key = (r['base_id'], r['date_text'], r['amount_norm'])
    if key in seen:
        continue
    seen.add(key)
    deduped.append(r)
rows = deduped

rows.sort(key=lambda r: (r['date_iso'] or '9999-99-99', r['name'], str(r['sequence'])))

with OUT_JSON.open('w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
    writer.writeheader()
    writer.writerows(rows)


def norm_sheet_date(s):
    s = (s or '').strip()
    try:
        return datetime.strptime(s, '%d-%m-%y').strftime('%d/%m/%Y')
    except Exception:
        return s

sheet_by_date = {}
for r in SHEET:
    key = norm_sheet_date(r['date_text'])
    sheet_by_date.setdefault(key, 0)
    sheet_by_date[key] += 1

summary = {
    'rows': len(rows),
    'min_date': rows[0]['date_iso'] if rows else None,
    'max_date': rows[-1]['date_iso'] if rows else None,
    'dates_also_present_in_original_sheet': sum(1 for r in rows if r['date_text'] in sheet_by_date),
    'rows_in_original_sheet': len(SHEET),
}
with SUMMARY.open('w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
print(json.dumps(summary, ensure_ascii=False, indent=2))
