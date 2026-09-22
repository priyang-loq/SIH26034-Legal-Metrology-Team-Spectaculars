import json

with open('data/outputs/product04.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Product04 Raw OCR Texts:")
results = data.get('ocr_info', {}).get('results', [])
for r in results:
    text = r.get('text', '')
    bbox = r.get('bbox', {}).get('points', [])
    if bbox:
        cy = sum(p[1] for p in bbox) / 4.0
    else:
        cy = 0
    print(f"Y: {cy:.1f} | Text: {text}")
