import pytest
from src.ocr.normalization import OCRText, BoundingBox
from src.extract.schema import ExtractionStatus
from src.extract.rules import extract_country_and_import_status

def make_ocr(text: str) -> OCRText:
    return OCRText(text=text, confidence=0.9, bbox=BoundingBox(points=[(0,0), (1,0), (1,1), (0,1)]))

def test_extract_made_in_india():
    results = [make_ocr(w) for w in ["MADE", "IN", "INDIA", "BY"]]
    coo, is_field, claimed = extract_country_and_import_status(results, set())
    assert coo.status == ExtractionStatus.FOUND
    assert coo.extracted_value == "India"
    assert is_field.status == ExtractionStatus.FOUND
    assert is_field.extracted_value == "DOMESTIC"

def test_extract_product_of_india():
    results = [make_ocr(w) for w in ["PRODUCT", "OF", "INDIA"]]
    coo, is_field, claimed = extract_country_and_import_status(results, set())
    assert coo.status == ExtractionStatus.FOUND
    assert coo.extracted_value == "India"
    assert is_field.status == ExtractionStatus.FOUND
    assert is_field.extracted_value == "DOMESTIC"

def test_extract_manufactured_in_india():
    results = [make_ocr(w) for w in ["MANUFACTURED", "IN", "INDIA"]]
    coo, is_field, claimed = extract_country_and_import_status(results, set())
    assert coo.status == ExtractionStatus.FOUND
    assert coo.extracted_value == "India"
    assert is_field.status == ExtractionStatus.FOUND
    assert is_field.extracted_value == "DOMESTIC"

def test_extract_explicit_foreign_origin():
    results = [make_ocr(w) for w in ["MADE", "IN", "UAE"]]
    coo, is_field, claimed = extract_country_and_import_status(results, set())
    assert coo.status == ExtractionStatus.FOUND
    assert coo.extracted_value == "Uae"
    assert is_field.status == ExtractionStatus.FOUND
    assert is_field.extracted_value == "IMPORTED"

    results = [make_ocr(w) for w in ["PRODUCT", "OF", "CHINA"]]
    coo, is_field, claimed = extract_country_and_import_status(results, set())
    assert coo.status == ExtractionStatus.FOUND
    assert coo.extracted_value == "China"
    assert is_field.status == ExtractionStatus.FOUND
    assert is_field.extracted_value == "IMPORTED"

def test_extract_unknown_origin():
    results = [make_ocr(w) for w in ["SOMETHING", "ELSE"]]
    coo, is_field, claimed = extract_country_and_import_status(results, set())
    assert coo.status == ExtractionStatus.NOT_FOUND
    assert is_field.status == ExtractionStatus.NOT_FOUND
