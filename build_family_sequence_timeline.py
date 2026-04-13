from pathlib import Path
import json
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
MAIN = json.loads((BASE / '_mutuo_dataset_enriched.json').read_text())
PAY = json.loads((BASE / '_payment_evidence_by_contract.json').read_text())
LINEAGE = json.loads((BASE / '_capital_lineage.json').read_text())
OUT = BASE / '_family_sequence_timeline.json'
SUMMARY = BASE / '_family_sequence_timeline_summary.json'

pay_by_doc = {r['doc_id']: r for r in PAY}
lineage_by_doc = {r['doc_id']: r for r in LINEAGE}

groups = defaultdict(list)
for row in MAIN:
    if row.get('doc_type') != 'contrato_mutuo':
        continue
    key = (row.get('family_key'), row.get('contract_track'), row.get('sequence_number_inferred'))
    groups[key].append(row)

rows = []
for (family_key, track, seq), items in groups.items():
    items.sort(key=lambda r: (r.get('signed_date_text') or '', r.get('title') or ''))
    doc_ids = [r.get('doc_id') for r in items]
    payments = [pay_by_doc.get(doc_id) for doc_id in doc_ids if pay_by_doc.get(doc_id)]
    lineages = [lineage_by_doc.get(doc_id) for doc_id in doc_ids if lineage_by_doc.get(doc_id)]

    months = sorted(set(m for p in payments for m in p.get('payment_months_detected', [])))
    payment_files = sum(p.get('payment_evidence_files', 0) for p in payments)
    capital_values = sorted(set(l.get('capital') for l in lineages if l.get('capital') is not None))
    events = sorted(set(l.get('event_estimate') for l in lineages if l.get('event_estimate')))

    rows.append({
        'family_key': family_key,
        'contract_track': track,
        'sequence_number': seq,
        'documents': len(items),
        'doc_ids': doc_ids,
        'titles': [r.get('title') for r in items],
        'signed_dates': [r.get('signed_date_text') for r in items if r.get('signed_date_text')],
        'capital_values': capital_values,
        'event_estimates': events,
        'payment_months_detected': months,
        'payment_evidence_files': payment_files,
    })

rows.sort(key=lambda r: (-len(r['payment_months_detected']), -(r['payment_evidence_files']), r['family_key'] or '', r['contract_track'] or '', r['sequence_number'] or 9999))

summary = {
    'family_sequences': len(rows),
    'with_payment_evidence': sum(1 for r in rows if r['payment_evidence_files'] > 0),
    'with_months_detected': sum(1 for r in rows if r['payment_months_detected']),
    'with_6plus_months': sum(1 for r in rows if len(r['payment_months_detected']) >= 6),
}

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
