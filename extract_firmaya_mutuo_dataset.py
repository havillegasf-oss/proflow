from pathlib import Path
from pypdf import PdfReader
import json
import re
import csv

BASE = Path('state/firmaya-by-investor-v2')
CLASSIFICATION = BASE / '_document_classification.json'
INDEX = BASE / '_index.json'
OUT_JSON = BASE / '_mutuo_dataset.json'
OUT_CSV = BASE / '_mutuo_dataset.csv'

classification = json.loads(CLASSIFICATION.read_text())
index = json.loads(INDEX.read_text())

id_by_file = {}
for row in index:
    rel = row.get('finalRelativeTarget') or row.get('relativeTarget')
    if rel:
        id_by_file[str(Path('state/firmaya-by-investor-v2') / rel)] = row.get('id')


def normalize(text: str) -> str:
    text = text.replace('\t', ' ')
    text = text.replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    chunks = []
    for page in reader.pages[:5]:
        try:
            chunks.append(page.extract_text() or '')
        except Exception:
            pass
    return '\n'.join(chunks)


def search(pattern, text, flags=re.I):
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else ''

rows = []
for doc in classification['documents']:
    if doc['type'] not in ('contrato_mutuo', 'fin_contrato_mutuo'):
        continue
    file_path = Path(doc['file'])
    raw = extract_text(file_path)
    text = normalize(raw)
    investor_folder = file_path.parent.name
    title = file_path.stem
    doc_id = id_by_file.get(str(file_path), '')

    cve = search(r'CVE:\s*([A-Z0-9]+)', text)
    signed_date = search(r'En\s+Santiago\s+a\s+([^,]+?),\s+comparece', text)
    investor_name = search(r'instrumento,\s*(?:DOÑA|DON)\s+(.+?),\s+domiciliad', text)
    if not investor_name:
        investor_name = search(r'comparece\s+para\s+efectos\s+del\s+presente\s+instrumento[:]?\s*(?:DOÑA|DON)\s+(.+?),\s+domiciliad', text)
    investor_rut = search(r'identidad\s+número\s*([0-9\.\-Kk]+)', text)
    capital = search(r'cantidad\s+de\s+CLP\s*\$?\s*([0-9\.,]+)', text)
    if not capital:
        capital = search(r'monto\s+de\s+\$\s*([0-9\.,]+)', text)
    term = search(r'deberá\s+ser\s+entregada\s+por\s+el\s+mutuario\s+en\s+el\s+plazo\s+de\s+(.+?)\s*,\s*a\s+contar', text)
    if not term:
        term = search(r'plazo\s+de\s+(.+?)\s+a\s+contar', text)
    monthly_interest_pct = search(r'\(([0-9\.,]+)%\)', text)
    if not monthly_interest_pct:
        monthly_interest_pct = search(r'interés\s+simple\s+mensual\s+del\s+(.+?)\s+por\s+ciento', text)
    monthly_interest_amount = search(r'INTER[ÉE]S(?:\s+MENSUAL|\s+30\s+D[ÍI]AS)?\s*\$\s*([0-9\.,]+)', text)
    final_capital_payment = search(r'CAPITAL\s*\$\s*([0-9\.,]+)', text)

    payment_dates = re.findall(r'\b(\d{2}/\d{2}/\d{4})\b', text)
    payment_amounts = re.findall(r'\$\s*([0-9][0-9\.,]*)', text)

    account_block = search(r'la\s+siguiente\s+cuenta\s+bancaria:\s*(.*?)\s*Dado\s+que\s+el\s+mutuo', text)
    bank = search(r'Banco:\s*(.*?)\s*Cuenta', account_block)
    account_number = search(r'Cuenta\s+(?:Vista|Corriente)\s*N°:\s*([A-Za-z0-9\-]+)', account_block)
    payee_rut = search(r'RUT:\s*([0-9\.\-Kk]+)', account_block)
    email = search(r'Mail:\s*([^\s]+@[^\s]+)', account_block)

    reference_contract_date = ''
    carryover_capital = ''
    if doc['type'] == 'fin_contrato_mutuo':
        reference_contract_date = search(r'firmado\s+el\s+día\s+(.+?)\s+entre', text)
        carryover_capital = search(r'saldo\s+capital.*?monto\s+de\s*\$\s*([0-9\.,]+)', text)

    rows.append({
        'doc_id': doc_id,
        'doc_type': doc['type'],
        'file': str(file_path),
        'investor_folder': investor_folder,
        'title': title,
        'cve': cve,
        'signed_date_text': signed_date,
        'investor_name': investor_name,
        'investor_rut': investor_rut,
        'capital': capital,
        'term_text': term,
        'monthly_interest_pct': monthly_interest_pct,
        'monthly_interest_amount': monthly_interest_amount,
        'final_capital_payment': final_capital_payment,
        'payment_dates_count': len(payment_dates),
        'payment_dates': payment_dates,
        'payment_dates_preview': payment_dates[:12],
        'payment_amounts': payment_amounts,
        'payment_amounts_preview': payment_amounts[:12],
        'bank': bank,
        'account_number': account_number,
        'payee_rut': payee_rut,
        'email': email,
        'reference_contract_date': reference_contract_date,
        'carryover_capital': carryover_capital,
    })

OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
    writer.writeheader()
    writer.writerows(rows)

summary = {
    'rows': len(rows),
    'mutuo': sum(1 for r in rows if r['doc_type'] == 'contrato_mutuo'),
    'fin_contrato': sum(1 for r in rows if r['doc_type'] == 'fin_contrato_mutuo'),
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
