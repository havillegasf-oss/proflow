from pathlib import Path
import json
import re
import unicodedata
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
TIMELINE = json.loads((BASE / '_family_sequence_timeline.json').read_text())
SHEET = json.loads((BASE / '_google_paid_contracts.json').read_text())
MAIN = json.loads((BASE / '_mutuo_dataset_enriched.json').read_text())
OUT = BASE / '_google_sheet_crosswalk.json'
SUMMARY = BASE / '_google_sheet_crosswalk_summary.json'

main_by_doc = {r['doc_id']: r for r in MAIN if r.get('doc_id')}


def norm(s: str) -> str:
    s = (s or '').strip().upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def alias_candidates(timeline_row):
    aliases = set()
    aliases.add(norm(timeline_row.get('family_key') or ''))
    for doc_id in timeline_row.get('doc_ids', []):
        row = main_by_doc.get(doc_id)
        if not row:
            continue
        aliases.add(norm(row.get('investor_folder') or ''))
        aliases.add(norm(row.get('investor_name') or ''))
    # short aliases from family/investor folder tokens
    extra = set()
    for a in list(aliases):
        parts = a.split()
        if len(parts) >= 1:
            extra.add(parts[0])
        if len(parts) >= 2:
            extra.add(' '.join(parts[:2]))
    aliases |= {x for x in extra if x}
    return sorted(a for a in aliases if a)


def related(label, alias):
    if not label or not alias:
        return False
    if label == alias or label in alias or alias in label:
        return True
    lt = {t for t in label.split() if len(t) >= 4}
    at = {t for t in alias.split() if len(t) >= 4}
    return len(lt & at) >= 1

results = []
for row in TIMELINE:
    aliases = alias_candidates(row)
    matches = []
    for s in SHEET:
        if row.get('contract_track') and s.get('track') and row['contract_track'] != s['track']:
            continue
        if row.get('sequence_number') is not None and s.get('sequence') is not None and row['sequence_number'] != s['sequence']:
            continue
        label = norm(s.get('label') or s.get('name_raw') or '')
        if any(related(label, alias) for alias in aliases):
            matches.append(s)

    results.append({
        'family_key': row.get('family_key'),
        'contract_track': row.get('contract_track'),
        'sequence_number': row.get('sequence_number'),
        'payment_months_detected': row.get('payment_months_detected'),
        'sheet_matches': len(matches),
        'sheet_status_counts': {
            status: sum(1 for m in matches if m.get('status') == status)
            for status in sorted(set(m.get('status') for m in matches))
        },
        'sheet_examples': [m.get('name_raw') + ' | ' + m.get('status') + ' | ' + m.get('amount_text') for m in matches[:8]],
    })

summary = {
    'timeline_rows': len(results),
    'with_sheet_matches': sum(1 for r in results if r['sheet_matches'] > 0),
    'with_pagado': sum(1 for r in results if r['sheet_status_counts'].get('PAGADO', 0) > 0),
    'with_renovado': sum(1 for r in results if r['sheet_status_counts'].get('RENOVADO', 0) > 0),
    'with_por_pagar': sum(1 for r in results if r['sheet_status_counts'].get('POR PAGAR', 0) > 0),
}

OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2))
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
