import json
from src.extract.rules import extract_mrp
from src.ocr.normalization import OCRText, BoundingBox

with open('data/outputs/product02.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

results = []
for idx, r in enumerate(data.get('ocr_info', {}).get('results', [])):
    text = r.get('text', '')
    bbox_points = r.get('bbox', {}).get('points', [])
    conf = r.get('confidence', 0.9)
    if bbox_points:
        bbox = BoundingBox(points=[(p[0], p[1]) for p in bbox_points])
        results.append(OCRText(text=text, bbox=bbox, confidence=conf))

from src.extract.rules import extract_net_quantity
claimed = set()
nq, nq_indices = extract_net_quantity(results, claimed)
print("Net Quantity Field:", nq.extracted_value, nq.status, nq.extraction_confidence)
print("Source Text:", nq.source_text)
