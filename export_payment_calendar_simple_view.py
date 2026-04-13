from pathlib import Path
import csv
import json
from datetime import datetime

BASE = Path('state/firmaya-by-investor-v2')
rows = json.loads((BASE / 'payment_calendar_like_sheet.json').read_text())
out = BASE / 'payment_calendar_simple_view.csv'

simple = []
for r in rows:
    try:
        date_display = datetime.strptime(r['date_text'], '%d/%m/%Y').strftime('%d-%m-%y')
    except Exception:
        date_display = r['date_text']
    simple.append({
        'NOMBRE': r['name'],
        'FECHA': date_display,
        'MONTO': r['amount_text'],
        'STATUS': r['status'],
        'LINEA': r['track'],
        'SECUENCIA': r['sequence'],
        'INVERSIONISTA': r['family_key'],
        'BASE_ID': r['base_id'],
        'ORDEN_FECHA': r['date_iso'],
    })

with out.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(simple[0].keys()))
    writer.writeheader()
    writer.writerows(simple)

print(out)
