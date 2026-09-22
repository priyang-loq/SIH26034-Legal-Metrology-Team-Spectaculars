import os
import sys
import json
import logging
import cv2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.pipeline import OCRPipeline
from src.ai.vlm import RealVLMExtractor
from src.preprocess.image_utils import preprocess_for_ocr

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def run_smoke_test():
    image_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "test_images", "food", "product01.jpg")
    
    if not os.path.exists(image_path):
        logger.error(f"Image not found at {image_path}")
        sys.exit(1)
        
    logger.info(f"Running OCR on {image_path}...")
    pipeline = OCRPipeline()
    img = cv2.imread(image_path)
    if img is None:
        logger.error(f"Failed to read image {image_path}")
        sys.exit(1)
        
    processed_img = preprocess_for_ocr(img)
    ocr_result = pipeline.ocr_engine.extract_text(processed_img)
    
    logger.info("OCR Extraction complete. Calling Real VLM (gemini-2.5-flash)...")
    try:
        vlm_engine = RealVLMExtractor()
        vlm_dict = vlm_engine.extract(image_path, ocr_result)
        
        print("\n" + "="*60)
        print("GEMINI VLM RAW STRUCTURED RESPONSE")
        print("="*60)
        print(json.dumps(vlm_dict, indent=2))
        print("="*60 + "\n")
        
    except ValueError as ve:
        logger.error(str(ve))
        print("\nPlease set your GEMINI_API_KEY environment variable and try again.")
    except Exception as e:
        logger.error(f"An error occurred during VLM extraction: {e}")

if __name__ == "__main__":
    run_smoke_test()
