from pathlib import Path
import json
import re
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
IN_FILE = BASE / '_mutuo_dataset.json'
OUT_FILE = BASE / '_mutuo_dataset_enriched.json'
SUMMARY_FILE = BASE / '_contract_families_summary.json'

rows = json.loads(IN_FILE.read_text())


def norm_name(s: str) -> str:
    s = (s or '').upper().strip()
    s = re.sub(r'\s+', ' ', s)
    return s


def infer_track(title: str):
    t = norm_name(title)
    return 'express' if 'EXPRESS' in t else 'mutuo'


def infer_sequence(title: str):
    t = norm_name(title)
    patterns = [
        r'CONTRATO\s+MUTUO\s+EXPRESS\s+(\d{1,2})\b',
        r'CONTRATO\s+MUTUO\s+(\d{1,2})\b',
        r'MUTUO\s+(\d{1,2})\b',
        r'EXPRESS\s+(\d{1,2})\b',
    ]
    for p in patterns:
        m = re.search(p, t)
        if m:
            try:
                return int(m.group(1))
            except Exception:
                return None
    return None

families = defaultdict(list)
for row in rows:
    if row['doc_type'] not in ('contrato_mutuo', 'fin_contrato_mutuo'):
        continue
    family_key = norm_name(row.get('investor_name') or row.get('investor_folder'))
    row['family_key'] = family_key
    row['contract_track'] = infer_track(row.get('title', ''))
    row['sequence_number_raw'] = infer_sequence(row.get('title', ''))
    families[family_key].append(row)

for family_key, items in families.items():
    # sort by signed date text fallback title
    def sort_key(r):
        return (r.get('signed_date_text') or '', r.get('title') or '')
    items.sort(key=sort_key)

    raw_numbers = [r['sequence_number_raw'] for r in items if r['sequence_number_raw'] is not None]
    has_numbered_contracts = len(raw_numbers) > 0

    for idx, row in enumerate(items, start=1):
        inferred = row['sequence_number_raw']
        if inferred is None and has_numbered_contracts and row['doc_type'] == 'contrato_mutuo':
            # if family has numbered contracts but this one has no visible number,
            # treat as likely sequence 1 when nothing else claims 1
            used = set(n for n in raw_numbers if n is not None)
            if 1 not in used:
                inferred = 1
        row['sequence_number_inferred'] = inferred

summary = []
for family_key, items in sorted(families.items(), key=lambda kv: (-len(kv[1]), kv[0])):
    seqs = sorted(set(r['sequence_number_inferred'] for r in items if r.get('sequence_number_inferred') is not None))
    summary.append({
        'family_key': family_key,
        'documents': len(items),
        'mutuos': sum(1 for r in items if r['doc_type'] == 'contrato_mutuo'),
        'fin_contratos': sum(1 for r in items if r['doc_type'] == 'fin_contrato_mutuo'),
        'sequences_detected': seqs,
        'titles_preview': [r['title'] for r in items[:6]],
    })

OUT_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
SUMMARY_FILE.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps({
    'families': len(summary),
    'with_multiple_docs': sum(1 for s in summary if s['documents'] > 1),
    'with_sequences': sum(1 for s in summary if s['sequences_detected']),
}, ensure_ascii=False, indent=2))
