from pathlib import Path
import json

root = Path('/Users/andresvillegas/Documents/Documentos - MacBook Pro (2)/MUTUOS CARPETA')
summary = {
    'root': str(root),
    'top_level_dirs': 0,
    'pdfs': 0,
    'docxs': 0,
    'xlsxs': 0,
    'payment_like_files': 0,
    'contract_like_files': 0,
    'fin_contract_like_files': 0,
    'investor_dirs_preview': [],
}

entries = list(root.iterdir())
summary['top_level_dirs'] = sum(1 for p in entries if p.is_dir())
summary['investor_dirs_preview'] = sorted([p.name for p in entries if p.is_dir()])[:40]

for p in root.rglob('*'):
    if not p.is_file():
        continue
    name = p.name.upper()
    suf = p.suffix.lower()
    if suf == '.pdf':
        summary['pdfs'] += 1
    elif suf == '.docx':
        summary['docxs'] += 1
    elif suf == '.xlsx':
        summary['xlsxs'] += 1

    if 'PAGO' in name or 'ABONO' in name or 'DEVOLUCION' in name or 'LIQUIDACION' in name:
        summary['payment_like_files'] += 1
    if 'CONTRATO' in name or 'MUTUO' in name:
        summary['contract_like_files'] += 1
    if 'FIN' in name and 'CONTRATO' in name:
        summary['fin_contract_like_files'] += 1

print(json.dumps(summary, ensure_ascii=False, indent=2))
