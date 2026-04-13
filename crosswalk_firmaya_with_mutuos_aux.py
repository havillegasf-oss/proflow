from pathlib import Path
import json
import re
import unicodedata
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
MAIN_FILE = BASE / '_mutuo_dataset_enriched.json'
AUX_FILE = BASE / '_mutuos_aux_index.json'
OUT_FILE = BASE / '_firmaya_aux_crosswalk.json'
SUMMARY_FILE = BASE / '_firmaya_aux_crosswalk_summary.json'

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

# prepare aux side
aux_grouped = defaultdict(list)
for row in aux_rows:
    top = row.get('top_folder') or ''
    sub = row.get('sub_folder') or ''
    candidate = top
    if norm(top) in {norm(x) for x in SPECIAL_TOP} and sub and not looks_like_sequence_folder(sub):
        candidate = sub
    key = norm(candidate)
    row['candidate_key'] = key
    aux_grouped[key].append(row)

# simple synonym fallback from main investor folder names
results = []
matched_families = 0
for row in main_rows:
    if row.get('doc_type') != 'contrato_mutuo':
        continue

    candidates = []
    for value in [row.get('investor_name'), row.get('investor_folder'), row.get('family_key')]:
        nv = norm(value or '')
        if nv and nv not in candidates:
            candidates.append(nv)

    matched = []
    for cand in candidates:
        if cand in aux_grouped:
            matched.extend(aux_grouped[cand])
    if not matched:
        # loose match by containment
        for aux_key, aux_items in aux_grouped.items():
            if any(aux_key and (aux_key in cand or cand in aux_key) for cand in candidates):
                matched.extend(aux_items)

    unique_paths = {}
    for m in matched:
        unique_paths[m['path']] = m
    matched = list(unique_paths.values())

    payment_files = [m for m in matched if m['kind'] == 'payment_evidence']
    contract_files = [m for m in matched if m['kind'] == 'contract_like']
    fin_files = [m for m in matched if m['kind'] == 'fin_contract']

    if matched:
        matched_families += 1

    results.append({
        'doc_id': row.get('doc_id'),
        'title': row.get('title'),
        'family_key': row.get('family_key'),
        'investor_name': row.get('investor_name'),
        'investor_folder': row.get('investor_folder'),
        'sequence_number': row.get('sequence_number_inferred'),
        'capital': row.get('capital'),
        'aux_match_count': len(matched),
        'aux_payment_count': len(payment_files),
        'aux_contract_count': len(contract_files),
        'aux_fin_contract_count': len(fin_files),
        'aux_payment_examples': [m['relative_path'] for m in payment_files[:6]],
    })

summary = {
    'main_contracts': len(results),
    'contracts_with_aux_matches': sum(1 for r in results if r['aux_match_count'] > 0),
    'contracts_with_payment_evidence': sum(1 for r in results if r['aux_payment_count'] > 0),
    'contracts_with_fin_contract_evidence': sum(1 for r in results if r['aux_fin_contract_count'] > 0),
}

OUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))
SUMMARY_FILE.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
