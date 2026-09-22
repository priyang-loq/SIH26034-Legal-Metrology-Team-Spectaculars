import json
with open('data/outputs/product02.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

results = data.get('ocr_info', {}).get('results', [])
for r in results:
    text = r.get('text', '')
    if 'see' in text.lower() or 'bottom' in text.lower():
        print("Deferral Text:", text)
