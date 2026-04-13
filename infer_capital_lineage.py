from pathlib import Path
import json
import re
from collections import defaultdict
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
IN_FILE = BASE / '_mutuo_dataset_enriched.json'
OUT_FILE = BASE / '_capital_lineage.json'
SUMMARY_FILE = BASE / '_capital_lineage_summary.json'

rows = json.loads(IN_FILE.read_text())

months = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'setiembre': 9, 'octubre': 10,
    'noviembre': 11, 'diciembre': 12,
}


def parse_money(s):
    s = (s or '').strip().replace('.', '').replace(',', '')
    s = re.sub(r'[^0-9-]', '', s)
    return int(s) if s else None


def parse_spanish_date(s):
    s = (s or '').strip().lower()
    m = re.match(r'(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})', s)
    if not m:
        return None
    day, month_name, year = m.groups()
    month_name = month_name.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
    month = months.get(month_name)
    if not month:
        return None
    return datetime(int(year), month, int(day))

families = defaultdict(list)
for row in rows:
    if row.get('doc_type') != 'contrato_mutuo':
        continue
    families[row.get('family_key') or row.get('investor_name') or row.get('investor_folder')].append(row)

lineage = []
summary = []
for family_key, items in families.items():
    for row in items:
        row['_capital_num'] = parse_money(row.get('capital'))
        row['_date_obj'] = parse_spanish_date(row.get('signed_date_text'))
        row['_seq'] = row.get('sequence_number_inferred') if row.get('sequence_number_inferred') is not None else 999999
    items.sort(key=lambda r: (r['_seq'], r['_date_obj'] or datetime.max, r.get('title') or ''))

    prev = None
    seq_events = []
    for row in items:
        capital = row['_capital_num']
        event = 'new'
        rolled = None
        delta = None
        if prev and capital is not None and prev['_capital_num'] is not None:
            rolled = min(capital, prev['_capital_num'])
            delta = capital - prev['_capital_num']
            if delta == 0:
                event = 'rollover_same_capital'
            elif delta > 0:
                event = 'rollover_with_increase'
            else:
                event = 'rollover_with_decrease'
        lineage_row = {
            'family_key': family_key,
            'sequence_number': row.get('sequence_number_inferred'),
            'doc_id': row.get('doc_id'),
            'signed_date_text': row.get('signed_date_text'),
            'title': row.get('title'),
            'capital': capital,
            'previous_doc_id': prev.get('doc_id') if prev else None,
            'previous_capital': prev.get('_capital_num') if prev else None,
            'capital_rolled_estimate': rolled,
            'capital_delta_estimate': delta,
            'event_estimate': event,
        }
        lineage.append(lineage_row)
        seq_events.append(lineage_row)
        prev = row

    summary.append({
        'family_key': family_key,
        'contracts': len(items),
        'events': [
            {
                'seq': e['sequence_number'],
                'capital': e['capital'],
                'event': e['event_estimate'],
                'delta': e['capital_delta_estimate'],
                'title': e['title'],
            }
            for e in seq_events[:15]
        ]
    })

OUT_FILE.write_text(json.dumps(lineage, ensure_ascii=False, indent=2))
SUMMARY_FILE.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps({
    'families': len(summary),
    'lineage_rows': len(lineage),
    'same_capital_rollovers': sum(1 for r in lineage if r['event_estimate'] == 'rollover_same_capital'),
    'increases': sum(1 for r in lineage if r['event_estimate'] == 'rollover_with_increase'),
    'decreases': sum(1 for r in lineage if r['event_estimate'] == 'rollover_with_decrease'),
}, ensure_ascii=False, indent=2))
