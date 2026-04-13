from pathlib import Path
import json
import re
import unicodedata
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
MAIN_FILE = BASE / '_mutuo_dataset_enriched.json'
AUX_FILE = BASE / '_mutuos_aux_index.json'
OUT_FILE = BASE / '_payment_evidence_by_contract.json'
SUMMARY_FILE = BASE / '_payment_evidence_by_contract_summary.json'

main_rows = json.loads(MAIN_FILE.read_text())
aux_rows = json.loads(AUX_FILE.read_text())

SPECIAL_TOP = {
    'MATERIAL A ENVIAR',
    'NUEVOS_CONTRATOS_FIRMAYA',
    'JUAN PABLO DIAZ',
    'JUAN PABLO DÍAZ',
}


def norm(s: str) -> str:
    s = (s or '').strip().upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def looks_like_sequence_folder(s: str) -> bool:
    t = norm(s)
    return any(k in t for k in ['MUTUO', 'PAGO', 'PAGOS', 'EXPRESS', 'COMISION', 'SALDOS'])


def numbers_from_text(label: str, word: str):
    return [int(x) for x in re.findall(rf'{word}\s*0?(\d{{1,2}})', norm(label))]


def infer_track(label: str):
    return 'express' if 'EXPRESS' in norm(label) else 'mutuo'

def related_keys(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    ta = {t for t in a.split() if len(t) >= 4}
    tb = {t for t in b.split() if len(t) >= 4}
    return len(ta & tb) >= 2

# Build aux payment evidence grouped by candidate
aux_payments = defaultdict(list)
for row in aux_rows:
    if row.get('kind') != 'payment_evidence':
        continue
    top = row.get('top_folder') or ''
    sub = row.get('sub_folder') or ''
    candidate = top
    if norm(top) in {norm(x) for x in SPECIAL_TOP} and sub and not looks_like_sequence_folder(sub):
        candidate = sub
    key = norm(candidate)
    rel = row.get('relative_path') or ''
    seqs = numbers_from_text(rel, 'MUTUO') or numbers_from_text(rel, 'EXPRESS')
    months = [int(x) for x in re.findall(r'MES\s*0?(\d{1,2})', norm(rel))]
    aux_payments[key].append({
        'path': row['path'],
        'relative_path': rel,
        'track': infer_track(rel),
        'sequence_candidates': seqs,
        'months': months,
    })

# Group main contracts by possible matching keys
main_contracts = []
for row in main_rows:
    if row.get('doc_type') != 'contrato_mutuo':
        continue
    keys = []
    for value in [row.get('investor_name'), row.get('investor_folder'), row.get('family_key')]:
        nv = norm(value or '')
        if nv and nv not in keys:
            keys.append(nv)
    row['_match_keys'] = keys
    main_contracts.append(row)

results = []
for row in main_contracts:
    seq = row.get('sequence_number_inferred')
    track = row.get('contract_track') or ('express' if 'EXPRESS' in norm(row.get('title') or '') else 'mutuo')
    matched = []
    candidate_payment_rows = []
    for key in row['_match_keys']:
        for aux_key, aux_items in aux_payments.items():
            if related_keys(key, aux_key):
                candidate_payment_rows.extend(aux_items)

    for p in candidate_payment_rows:
        # strict match by sequence when available
        if p.get('track') and track and p['track'] != track:
            continue
        if seq is not None and p['sequence_candidates']:
            if seq in p['sequence_candidates']:
                matched.append(p)
        # fallback: no sequence in evidence and contract inferred as 1
        elif seq == 1 and not p['sequence_candidates']:
            matched.append(p)
        # fallback: evidence has no sequence and contract itself has no inferred seq
        elif seq is None and not p['sequence_candidates']:
            matched.append(p)

    unique = {}
    for m in matched:
        unique[m['path']] = m
    matched = list(unique.values())

    months = sorted(set(m for item in matched for m in item['months']))

    results.append({
        'doc_id': row.get('doc_id'),
        'title': row.get('title'),
        'family_key': row.get('family_key'),
        'sequence_number': seq,
        'capital': row.get('capital'),
        'payment_evidence_files': len(matched),
        'payment_months_detected': months,
        'payment_examples': [m['relative_path'] for m in matched[:8]],
    })

summary = {
    'contracts': len(results),
    'with_payment_evidence': sum(1 for r in results if r['payment_evidence_files'] > 0),
    'with_month_level_evidence': sum(1 for r in results if r['payment_months_detected']),
    'with_3plus_months_evidence': sum(1 for r in results if len(r['payment_months_detected']) >= 3),
}

OUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))
SUMMARY_FILE.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
