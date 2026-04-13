from pathlib import Path
import csv
import json
import re
from datetime import datetime

base = Path('state/firmaya-by-investor-v2')
infile = base / 'google_sheets_paid_contracts.csv'
out_json = base / '_google_paid_contracts.json'
out_summary = base / '_google_paid_contracts_summary.json'

rows = []


def infer_track(name: str):
    n = (name or '').upper()
    return 'express' if 'EXPRESS' in n else 'mutuo'


def infer_sequence(name: str):
    n = (name or '').upper()
    m = re.search(r'(?:EXPRESS|FACTORAJE|DIAZ|MEZA|LEAL|ROMERO|NUÑEZ|NUNEZ|CARRANZA|BEATRIZ|FELIPE|VIVIANNE|VIVANNE|WILSON SALINAS|JUAN PABLO DIAZ|CATALINA MEZA|NINOSKA KROFF|CRISTOBAL DIAZ|CAMILA MARTINEZ|ISIDORA TATAN|ANDREA AZURDUY|MANUEL MAGAÑA|FELIPE UARAC)\s*(\d{1,2})\b', n)
    if m:
        return int(m.group(1))
    m = re.search(r'\b(\d{1,2})\b', n)
    if m:
        return int(m.group(1))
    return None


def infer_label(name: str):
    n = (name or '').upper()
    n = re.sub(r'\(.*?\)', ' ', n)
    n = re.sub(r'EXPRESSO', 'EXPRESS', n)
    n = re.sub(r'EXPRESS', ' ', n)
    n = re.sub(r'FACTORAJE', ' ', n)
    n = re.sub(r'\b\d{1,2}\b', ' ', n)
    n = re.sub(r'\s+', ' ', n).strip()
    return n

with infile.open() as f:
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
        rows.append({
            'name_raw': name,
            'label': infer_label(name),
            'track': infer_track(name),
            'sequence': infer_sequence(name),
            'date_text': date_text,
            'amount_text': amount_text,
            'status': status,
        })

summary = {
    'rows': len(rows),
    'statuses': {},
    'tracks': {},
}
for r in rows:
    summary['statuses'][r['status']] = summary['statuses'].get(r['status'], 0) + 1
    summary['tracks'][r['track']] = summary['tracks'].get(r['track'], 0) + 1

out_json.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
out_summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False, indent=2))
