from pathlib import Path
import json
import re
import unicodedata
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
TIMELINE = json.loads((BASE / '_family_sequence_timeline.json').read_text())
PAY = json.loads((BASE / '_payment_evidence_by_contract.json').read_text())
SHEET = json.loads((BASE / '_google_paid_contracts.json').read_text())
OUT = BASE / '_google_sheet_crosswalk_via_aux.json'
SUMMARY = BASE / '_google_sheet_crosswalk_via_aux_summary.json'

SPECIAL_TOP = {'JUAN PABLO DIAZ', 'JUAN PABLO DIÁZ', 'MATERIAL A ENVIAR', 'NUEVOS_CONTRATOS_FIRMAYA'}


def norm(s: str) -> str:
    s = (s or '').strip().upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def alias_from_relpath(rel: str):
    parts = rel.split('/')
    if not parts:
        return ''
    first = norm(parts[0])
    if first in {norm(x) for x in SPECIAL_TOP} and len(parts) > 1:
        second = norm(parts[1])
        if second and not any(k in second for k in ['MUTUO', 'PAGO', 'PAGOS', 'EXPRESS', 'COMISION', 'SALDOS']):
            return second
    return first


def related(label: str, alias: str):
    if not label or not alias:
        return False
    if label == alias or label in alias or alias in label:
        return True
    lt = {t for t in label.split() if len(t) >= 4}
    at = {t for t in alias.split() if len(t) >= 4}
    return len(lt & at) >= 1

pay_by_doc = {r['doc_id']: r for r in PAY}
results = []
for row in TIMELINE:
    aliases = set()
    for doc_id in row.get('doc_ids', []):
        pay = pay_by_doc.get(doc_id)
        if not pay:
            continue
        for rel in pay.get('payment_examples', []):
            alias = alias_from_relpath(rel)
            if alias:
                aliases.add(alias)

    matches = []
    for s in SHEET:
        if row.get('contract_track') and s.get('track') and row['contract_track'] != s['track']:
            continue
        if row.get('sequence_number') is not None and s.get('sequence') is not None and row['sequence_number'] != s['sequence']:
            continue
        label = norm(s.get('label') or s.get('name_raw') or '')
        if aliases and any(related(label, alias) for alias in aliases):
            matches.append(s)

    results.append({
        'family_key': row.get('family_key'),
        'contract_track': row.get('contract_track'),
        'sequence_number': row.get('sequence_number'),
        'aliases': sorted(aliases),
        'sheet_matches': len(matches),
        'sheet_status_counts': {
            status: sum(1 for m in matches if m.get('status') == status)
            for status in sorted(set(m.get('status') for m in matches))
        },
        'sheet_examples': [m.get('name_raw') + ' | ' + m.get('status') + ' | ' + m.get('amount_text') for m in matches[:8]],
    })

summary = {
    'timeline_rows': len(results),
    'with_aliases': sum(1 for r in results if r['aliases']),
    'with_sheet_matches': sum(1 for r in results if r['sheet_matches'] > 0),
    'with_pagado': sum(1 for r in results if r['sheet_status_counts'].get('PAGADO', 0) > 0),
    'with_renovado': sum(1 for r in results if r['sheet_status_counts'].get('RENOVADO', 0) > 0),
    'with_por_pagar': sum(1 for r in results if r['sheet_status_counts'].get('POR PAGAR', 0) > 0),
}

OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2))
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
