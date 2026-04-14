from pathlib import Path
import csv
import json
import re
import unicodedata
from collections import defaultdict

BASE = Path('state/firmaya-by-investor-v2')
INFILE = BASE / 'payment_calendar_unified_v3.csv'
OUTFILE = BASE / 'payment_calendar_unified_v4.csv'
SUMMARY = BASE / 'payment_calendar_unified_v4_summary.json'
CROSS = json.loads((BASE / '_google_sheet_crosswalk_via_aux.json').read_text())
MASTER = {r['base_id']: r for r in json.loads((BASE / 'master_cashflow_base.json').read_text())}
GEN = json.loads((BASE / 'payment_calendar_like_sheet.json').read_text())
ALIASES_FILE = Path('firmaya_manual_alias_overrides.json')
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


def infer_track(name: str):
    n = (name or '').upper()
    return 'express' if 'EXPRESS' in n else 'mutuo'


def infer_sequence(name: str):
    n = (name or '').upper()
    m = re.search(r'\b(\d{1,2})\b', n)
    return int(m.group(1)) if m else None


def norm_amount(s):
    return re.sub(r'[^0-9]', '', s or '')

# generated exact map: date+amount -> base candidates
exact_map = defaultdict(list)
for r in GEN:
    key = (r['date_text'].replace('/', '-')[0:2] + '-' + r['date_text'][3:5] + '-' + r['date_text'][8:10], norm_amount(r['amount_text']))
    exact_map[key].append(r['base_id'])
    if str(r.get('payment_index')) == str(r.get('payment_dates_count')) and r.get('final_capital_payment'):
        exact_map[(key[0], norm_amount(r['final_capital_payment']))].append(r['base_id'])

rows = []
resolved = 0
with INFILE.open() as f:
    for r in csv.DictReader(f):
        if r.get('INVERSIONISTA'):
            r['FAMILIA'] = r['INVERSIONISTA']
            r['FAMILIA_BASE_ID'] = r.get('BASE_ID', '')
            resolved += 1
            rows.append(r)
            continue

        label = canon(r['NOMBRE'])
        track = infer_track(r['NOMBRE'])
        seq = infer_sequence(r['NOMBRE'])
        key = (r['FECHA'], norm_amount(r['MONTO']))

        candidates = []
        for c in CROSS:
            if c.get('contract_track') and track and c['contract_track'] != track:
                continue
            cseq = c.get('sequence_number')
            if seq is not None and cseq is not None and seq != cseq:
                continue
            aliases = [canon(a) for a in c.get('aliases', [])]
            if aliases and any(related(label, a) for a in aliases):
                base_id = f"{c['family_key']}|{c['contract_track']}|{c['sequence_number']}"
                candidates.append((base_id, c['family_key']))

        if len(candidates) > 1:
            exact_bases = set(exact_map.get(key, []))
            narrowed = [c for c in candidates if c[0] in exact_bases]
            if narrowed:
                candidates = narrowed

        if candidates:
            base_id, family = candidates[0]
            r['FAMILIA'] = family
            r['FAMILIA_BASE_ID'] = base_id
            resolved += 1
        else:
            r['FAMILIA'] = ''
            r['FAMILIA_BASE_ID'] = ''
        rows.append(r)

with OUTFILE.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

summary = {
    'rows': len(rows),
    'family_resolved_rows': resolved,
    'family_unresolved_rows': len(rows) - resolved,
}
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(summary)
