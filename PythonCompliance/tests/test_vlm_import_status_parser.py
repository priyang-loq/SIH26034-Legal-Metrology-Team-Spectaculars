import pytest
from src.ai.response_parser import parse_vlm_response
from src.extract.schema import ExtractionStatus

def test_vlm_parser_preserves_import_status():
    vlm_dict = {
        "import_status": {"value": "DOMESTIC", "status": "FOUND", "confidence": 0.9},
        "product_name": {"value": "Test", "status": "FOUND", "confidence": 0.9}
    }
    
    fields = parse_vlm_response(vlm_dict)
    
    # Assert that import_status exists and was parsed correctly
    assert hasattr(fields, "import_status"), "Parser incorrectly dropped import_status"
    assert fields.import_status.extracted_value == "DOMESTIC"
    assert fields.import_status.status == ExtractionStatus.FOUND
    assert fields.product_name.extracted_value == "Test"
