from pathlib import Path
from pypdf import PdfReader
import json
import re

base = Path('state/firmaya-by-investor-v2')
patterns = [
    ('mutuo_express', re.compile(r'CONTRATO MUTUO EXPRESS', re.I)),
    ('mutuo', re.compile(r'CONTRATO MUTUO(?! EXPRESS)', re.I)),
    ('fin_contrato', re.compile(r'FIN CONTRATO', re.I)),
    ('mandato', re.compile(r'MANDATO', re.I)),
    ('arriendo', re.compile(r'ARRIENDO', re.I)),
    ('other', re.compile(r'.')),
]

picked = []
seen = set()
all_pdfs = sorted(base.rglob('*.pdf'))
for label, pattern in patterns:
    for pdf in all_pdfs:
        if pdf.name in seen:
            continue
        if pattern.search(pdf.name):
            picked.append((label, pdf))
            seen.add(pdf.name)
            break

result = []
for label, pdf in picked:
    reader = PdfReader(str(pdf))
    text_parts = []
    for page in reader.pages[:3]:
        try:
            text_parts.append(page.extract_text() or '')
        except Exception as e:
            text_parts.append(f'[extract_error: {e}]')
    text = '\n'.join(text_parts)
    result.append({
        'label': label,
        'file': str(pdf),
        'pages': len(reader.pages),
        'snippet': text[:5000],
    })

print(json.dumps(result, ensure_ascii=False, indent=2))
