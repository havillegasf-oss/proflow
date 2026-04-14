from pathlib import Path
import csv
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
INFILE = BASE / 'payment_calendar_unified_v2.csv'
OUTFILE = BASE / 'payment_status_audit_queue.csv'

rows = []
with INFILE.open() as f:
    for r in csv.DictReader(f):
        if r['FUENTE'] == 'sheet_original':
            continue
        if r['STATUS'] == 'POR PAGAR':
            continue
        rows.append(r)

rows.sort(key=lambda r: (r['STATUS'], r['FUENTE'], r['ORDEN_FECHA'], r['NOMBRE'], r['MONTO']))

with OUTFILE.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
    writer.writeheader()
    writer.writerows(rows)

print({'rows': len(rows), 'outfile': str(OUTFILE)})
