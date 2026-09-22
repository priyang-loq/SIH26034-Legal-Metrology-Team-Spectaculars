import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.ai.response_parser import parse_vlm_response
from src.extract.schema import ExtractionStatus

def test_parse_valid_vlm_response():
    data = {
        "mrp": {"value": "199.50", "confidence": 0.95, "status": "FOUND", "evidence": ["199.50"]},
        "manufacturer": {
            "name": {"value": "ABC Food Co", "confidence": 0.9, "status": "FOUND", "evidence": ["ABC Food Co"]},
            "address": {"value": "Delhi", "confidence": 0.8, "status": "FOUND", "evidence": ["Delhi"]}
        },
        "consumer_care": {
            "phone": {"value": "1800-123", "confidence": 0.9, "status": "FOUND", "evidence": []}
        }
    }
    
    fields = parse_vlm_response(data)
    
    assert fields.mrp.status == ExtractionStatus.FOUND
    assert fields.mrp.extracted_value == "199.50"
    
    assert fields.manufacturer.name.extracted_value == "ABC Food Co"
    assert fields.manufacturer.address.extracted_value == "Delhi"
    
    assert fields.consumer_care.phone.extracted_value == "1800-123"

def test_parse_invalid_and_malformed():
    fields = parse_vlm_response(None)
    assert fields.mrp.status == ExtractionStatus.NOT_FOUND
    
    fields2 = parse_vlm_response([])
    assert fields2.mrp.status == ExtractionStatus.NOT_FOUND

def test_parse_missing_and_ambiguous():
    data = {
        "net_quantity": {"value": "500", "confidence": 0.4, "status": "AMBIGUOUS", "evidence": []}
    }
    fields = parse_vlm_response(data)
    assert fields.net_quantity.status == ExtractionStatus.AMBIGUOUS
    assert fields.net_quantity.extracted_value == "500"

def test_parse_hallucinated_fields():
    data = {
        "mrp": {"value": "199", "confidence": 0.95, "status": "FOUND", "evidence": []},
        "random_field": {"value": "ABC"}
    }
    fields = parse_vlm_response(data)
    assert not hasattr(fields, "random_field")

def test_parse_canonical_category():
    data = {
        "canonical_category": {"value": "food", "confidence": 0.9, "status": "FOUND", "evidence": []},
        "mrp": {"value": "199", "confidence": 0.95, "status": "FOUND", "evidence": []}
    }
    fields = parse_vlm_response(data)
    
    assert hasattr(fields, "canonical_category"), "ProductFields missing canonical_category"
    assert fields.canonical_category.extracted_value == "food"
