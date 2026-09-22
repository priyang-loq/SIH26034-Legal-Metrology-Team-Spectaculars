import json
with open('data/outputs/product02.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

results = data.get('ocr_info', {}).get('results', [])
print("PRODUCT 02 OCR RESULTS containing 510 or MRP or Net:")
for r in results:
    text = r.get('text', '')
    if '510' in text or 'mrp' in text.lower() or 'net' in text.lower():
        print(text)
