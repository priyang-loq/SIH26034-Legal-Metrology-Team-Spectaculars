import pytest
from src.pipeline import enrich_with_database
from src.extract.schema import ProductFields, ExtractedField, ExtractionStatus

def test_barcode_gap_fills_missing_product_name():
    fields = ProductFields()
    fields.product_name = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    
    lookup = {
        "success": True,
        "barcode": "123",
        "product_name": "Test Brand Chips",
        "company": "Test Co"
    }
    
    from src.extract.schema import StructuredExtractionResult
    from src.ocr.normalization import NormalizedOCRResult
    struct_data = StructuredExtractionResult(image_path='', ocr_info=NormalizedOCRResult(results=[], extraction_confidence=1.0, device='cpu'), fields=fields)
    enrich_with_database(struct_data, lookup)
    
    assert fields.product_name.status == ExtractionStatus.FOUND
    assert fields.product_name.extracted_value == "Test Brand Chips"
    assert "Barcode" in fields.product_name.source_text
    
    assert fields.manufacturer.name.status == ExtractionStatus.FOUND
    assert fields.manufacturer.name.extracted_value == "Test Co"

def test_barcode_does_not_overwrite_found_product_name():
    fields = ProductFields()
    fields.product_name = ExtractedField(
        status=ExtractionStatus.FOUND, 
        extracted_value="Original Name",
        source_text="OCR"
    )
    
    lookup = {
        "success": True,
        "barcode": "123",
        "product_name": "Different Name"
    }
    
    from src.extract.schema import StructuredExtractionResult
    from src.ocr.normalization import NormalizedOCRResult
    struct_data = StructuredExtractionResult(image_path='', ocr_info=NormalizedOCRResult(results=[], extraction_confidence=1.0, device='cpu'), fields=fields)
    enrich_with_database(struct_data, lookup)
    
    assert fields.product_name.status == ExtractionStatus.FOUND
    assert fields.product_name.extracted_value == "Original Name"
    assert "Original Name" in fields.product_name.extracted_value
    assert "Different Name" in fields.product_name.source_text
    assert "OCR" in fields.product_name.source_text

def test_barcode_does_not_populate_country_of_origin():
    fields = ProductFields()
    fields.country_of_origin = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    
    lookup = {
        "success": True,
        "barcode": "123",
        "countries": "India"
    }
    
    from src.extract.schema import StructuredExtractionResult
    from src.ocr.normalization import NormalizedOCRResult
    struct_data = StructuredExtractionResult(image_path='', ocr_info=NormalizedOCRResult(results=[], extraction_confidence=1.0, device='cpu'), fields=fields)
    enrich_with_database(struct_data, lookup)
    
    assert fields.country_of_origin.status == ExtractionStatus.NOT_FOUND
    assert fields.country_of_origin.extracted_value is None

def test_barcode_unavailable_does_not_break():
    fields = ProductFields()
    fields.product_name = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    
    enrich_with_database(fields, None)
    assert fields.product_name.status == ExtractionStatus.NOT_FOUND
    
    enrich_with_database(fields, {"success": False, "message": "Failed"})
    assert fields.product_name.status == ExtractionStatus.NOT_FOUND