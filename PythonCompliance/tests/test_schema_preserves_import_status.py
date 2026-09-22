import pytest
from src.extract.schema import StructuredExtractionResult, ExtractionStatus

def test_schema_preserves_import_status():
    raw_data = {
        "image_path": "dummy.jpg",
        "ocr_info": {"device": "test", "results": []},
        "fields": {
            "import_status": {"status": "FOUND", "extracted_value": "DOMESTIC"},
            "country_of_origin": {"status": "NOT_FOUND"},
        }
    }
    
    result = StructuredExtractionResult.model_validate(raw_data)
    
    assert hasattr(result.fields, "import_status")
    assert result.fields.import_status.extracted_value == "DOMESTIC"
    assert result.fields.import_status.status == ExtractionStatus.FOUND
