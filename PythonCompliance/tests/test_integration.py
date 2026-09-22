import os
import sys
import json
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.config import Config
from src.pipeline import OCRPipeline

def test_pipeline_with_vlm_fusion():
    Config.USE_VLM = True
    
    pipeline = OCRPipeline()
    img_path = os.path.join("data", "test_images", "food", "product01.jpg")
    
    if not os.path.exists(img_path):
        pytest.skip("Test image not found")
        
    output_str = pipeline.process_image(img_path, save_debug=False)
    data = json.loads(output_str)
    
    fields = data.get("fields", {})
    
    # Assert OCR stuff is preserved
    assert fields.get("mrp", {}).get("status") == "FOUND"
    
    # Assert VLM stuff is added via Fusion
    assert fields.get("manufacturer", {}).get("name", {}).get("status") == "FOUND"
    assert fields.get("manufacturer", {}).get("name", {}).get("extracted_value") == "ABC Food Co"
    
    assert fields.get("product_name", {}).get("status") == "FOUND"
    assert fields.get("product_name", {}).get("extracted_value") == "Test Premium Biscuits"
