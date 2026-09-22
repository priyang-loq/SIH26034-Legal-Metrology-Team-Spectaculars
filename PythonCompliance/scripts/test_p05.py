import json
from src.extract.rules import extract_mrp
from src.ocr.normalization import OCRText, BoundingBox

with open('data/outputs/product05.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

results = []
for idx, r in enumerate(data.get('ocr_info', {}).get('results', [])):
    text = r.get('text', '')
    bbox_points = r.get('bbox', {}).get('points', [])
    conf = r.get('confidence', 0.9)
    if bbox_points:
        bbox = BoundingBox(points=[(p[0], p[1]) for p in bbox_points])
        results.append(OCRText(text=text, bbox=bbox, confidence=conf))

claimed = set()
mrp, mrp_indices = extract_mrp(results, claimed)
print("MRP Field:", mrp.extracted_value, mrp.status, mrp.extraction_confidence)
print("Source Text:", mrp.source_text)
print("Evidence:", [e.text for e in mrp.evidence])
