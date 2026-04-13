from pathlib import Path
from pypdf import PdfReader
import json
import re

base = Path('state/firmaya-by-investor-v2')
out = base / '_document_classification.json'

rules = [
    ('fin_contrato_mutuo', [r'FIN\s+DE\s+CONTRATO\s+DE\s+MUTUO', r'FIN\s+CONTRATO\s+MUTUO']),
    ('contrato_mutuo', [r'CONTRATO\s+DE\s+MUTUO\s+DE\s+DINERO', r'CONTRATO\s+MUTUO']),
    ('mandato_poder', [r'MANDATO', r'PODER']),
    ('arriendo', [r'CONTRATO\s+DE\s+ARRIENDO', r'ARRIENDO']),
    ('avenimiento', [r'AVENIMIENTO']),
    ('no_valido', [r'NO\s+VALIDO']),
    ('error', [r'^ERROR$', r'^error$']),
]

summary = {}
rows = []

for pdf in sorted(base.rglob('*.pdf')):
    try:
        reader = PdfReader(str(pdf))
        text = ''
        for page in reader.pages[:2]:
            try:
                text += '\n' + (page.extract_text() or '')
            except Exception:
                pass
    except Exception as e:
        rows.append({'file': str(pdf), 'type': 'read_error', 'error': str(e)})
        summary['read_error'] = summary.get('read_error', 0) + 1
        continue

    full = (pdf.name + '\n' + text[:4000]).strip()
    doc_type = 'other'
    for label, patterns in rules:
        if any(re.search(p, full, re.I | re.M) for p in patterns):
            doc_type = label
            break

    rows.append({'file': str(pdf), 'type': doc_type, 'pages': len(reader.pages)})
    summary[doc_type] = summary.get(doc_type, 0) + 1

payload = {
    'summary': dict(sorted(summary.items(), key=lambda kv: (-kv[1], kv[0]))),
    'documents': rows,
}

out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
print(json.dumps(payload['summary'], ensure_ascii=False, indent=2))
