from pathlib import Path
import json
import re

ROOT = Path('/Users/andresvillegas/Documents/Documentos - MacBook Pro (2)/MUTUOS CARPETA')
OUT = Path('state/firmaya-by-investor-v2/_mutuos_aux_index.json')

rows = []

for p in ROOT.rglob('*'):
    if not p.is_file():
        continue
    rel = p.relative_to(ROOT)
    parts = rel.parts
    top = parts[0] if parts else ''
    subdir = parts[1] if len(parts) > 2 else ''
    name = p.name
    upper = name.upper()
    ext = p.suffix.lower()

    kind = 'other'
    if top in ('MATERIAL A ENVIAR', 'NUEVOS_CONTRATOS_FIRMAYA'):
        kind = 'staging_or_draft'
    elif ext in ('.doc', '.docx') and 'FORMATO' in upper:
        kind = 'template'
    elif 'PAGO' in upper or 'ABONO' in upper or 'DEVOLUCION' in upper or 'LIQUIDACION' in upper:
        kind = 'payment_evidence'
    elif 'FIN' in upper and 'CONTRATO' in upper:
        kind = 'fin_contract'
    elif 'CONTRATO' in upper or 'MUTUO' in upper:
        kind = 'contract_like'

    months = re.findall(r'MES\s*0?(\d{1,2})', upper)
    mutuo_nums = re.findall(r'MUTUO\s*0?(\d{1,2})', upper)
    express_nums = re.findall(r'EXPRESS\s*0?(\d{1,2})', upper)

    rows.append({
        'path': str(p),
        'relative_path': str(rel),
        'top_folder': top,
        'sub_folder': subdir,
        'filename': name,
        'ext': ext,
        'kind': kind,
        'mutuo_numbers': [int(x) for x in mutuo_nums],
        'express_numbers': [int(x) for x in express_nums],
        'payment_months': [int(x) for x in months],
    })

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
summary = {}
for r in rows:
    summary[r['kind']] = summary.get(r['kind'], 0) + 1
print(json.dumps({'rows': len(rows), 'summary': dict(sorted(summary.items()))}, ensure_ascii=False, indent=2))
