import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cv2
from paddleocr import PaddleOCR
from src.ocr.engine import OCREngine

img_path = 'data/test_images/product01.jpg'
print(f"Loading {img_path}...")
img = cv2.imread(img_path)
if img is None:
    print("Failed to load image!")
    sys.exit(1)
    
print("Initializing PaddleOCR...")
ocr = PaddleOCR(use_textline_orientation=True, lang='en', device='gpu:0')

print("Running OCR inference...")
results = ocr.predict(img)
result = list(results) # predict yields an iterator/generator

print("OCR Result format:")
if result and len(result) > 0 and result[0] is not None:
    print(f"Type of result: {type(result)}")
    print(f"Type of result[0]: {type(result[0])}")
    print(f"Sample item from result[0] dict/attr dir: {dir(result[0])}")
    
    # Try to access common paddlex OCRResult fields without printing raw strings
    if hasattr(result[0], 'keys'):
        print(f"Keys: {result[0].keys()}")
    
    try:
        # PaddleX OCRResult is often a dict-like object containing 'dt_polys', 'dt_scores', 'rec_text', 'rec_score'
        for k in ['dt_polys', 'rec_text', 'rec_score']:
            if k in result[0]:
                val = result[0][k]
                print(f"Contains {k}: type {type(val)}, len {len(val) if hasattr(val, '__len__') else 'N/A'}")
    except Exception as e:
        print(f"Error accessing keys: {e}")
        
else:
    print("No text detected or result is None.")
