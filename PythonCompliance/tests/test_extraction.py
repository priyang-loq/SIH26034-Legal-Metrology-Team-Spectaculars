import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.extract.rules import extract_mrp, extract_net_quantity, extract_all_dates, extract_batch, extract_usp
from src.ocr.normalization import OCRText, BoundingBox
from src.extract.schema import ExtractionStatus

def make_dummy_text(text: str, y_offset: float = 0.0) -> OCRText:
    return OCRText(text=text, confidence=0.99, bbox=BoundingBox(points=[[0,y_offset], [1,y_offset], [1,y_offset+1], [0,y_offset+1]]))

def test_source_unavailable_enum():
    assert hasattr(ExtractionStatus, "SOURCE_UNAVAILABLE")
    assert ExtractionStatus.SOURCE_UNAVAILABLE != ExtractionStatus.NOT_FOUND
    assert ExtractionStatus.SOURCE_UNAVAILABLE.value == "SOURCE_UNAVAILABLE"

def test_extract_mrp():
    results = [make_dummy_text("MRP Rs. 199.50")]
    field, indices = extract_mrp(results, set())
    assert field.status == ExtractionStatus.FOUND
    assert field.extracted_value == "199.50"
    assert indices == [0]

def test_extract_net_quantity():
    results = [make_dummy_text("Net Quantity 400 g")]
    field, indices = extract_net_quantity(results, set())
    assert field.status == ExtractionStatus.FOUND
    assert field.extracted_value == "400 g"
    
    # Ignore serve size aggressively
    results = [make_dummy_text("Serving Size: 35 g")]
    field, indices = extract_net_quantity(results, set())
    assert field.status == ExtractionStatus.NOT_FOUND

def test_extract_all_dates():
    results = [make_dummy_text("Mfg Date: 12/05/2023")]
    mfg_field, exp_field, indices = extract_all_dates(results, set())
    assert mfg_field.status == ExtractionStatus.FOUND
    assert mfg_field.extracted_value == "12/05/2023"
    
    # Deferral
    results = [make_dummy_text("Mfg Date:"), make_dummy_text("See Bottom")]
    mfg_field, exp_field, indices = extract_all_dates(results, set())
    assert mfg_field.status == ExtractionStatus.DEFERRED_TO_OTHER_SURFACE

def test_row_pairing():
    # Parallel columns layout
    results = [
        make_dummy_text("Mfg Date:", y_offset=10),
        make_dummy_text("Expiry Date:", y_offset=20),
        make_dummy_text("12/05/2023", y_offset=11), # closest vertically to mfg
        make_dummy_text("12/05/2024", y_offset=21)  # closest vertically to exp
    ]
    mfg_field, exp_field, indices = extract_all_dates(results, set())
    assert mfg_field.extracted_value == "12/05/2023"
    assert exp_field.extracted_value == "12/05/2024"

def test_batch_substring_rejection():
    # Batch should not steal from a valid date string
    results = [make_dummy_text("Batch No."), make_dummy_text("12/05/2025")]
    field, indices = extract_batch(results, set())
    assert field.status == ExtractionStatus.NOT_FOUND

def test_batch_from_multiblock():
    results = [make_dummy_text("B00695 28/03/25 27/03/27")]
    field, indices = extract_batch(results, set())
    assert field.status == ExtractionStatus.FOUND
    assert field.extracted_value == "B00695"

@pytest.mark.parametrize("ocr_text,expected_val", [
    ("₹0.30/g", "₹0.30/g"),
    ("Rs.0.30/g", "rs.0.30/g"),
    ("INR 0.30/g", "inr 0.30/g"),
    ("₹0.30 per g", "₹0.30 per g"),
])
def test_extract_usp_valid(ocr_text, expected_val):
    item = make_dummy_text(ocr_text)
    field, indices = extract_usp([item], set())
    assert field.status == ExtractionStatus.FOUND
    assert field.extracted_value == expected_val
    assert field.evidence == [item]
    assert indices == [0]

def test_extract_usp_negative_cases():
    # "200 g" must NOT become USP
    field, indices = extract_usp([make_dummy_text("200 g")], set())
    assert field.status == ExtractionStatus.NOT_FOUND
    assert indices == []

    # "₹60" must NOT become USP
    field, indices = extract_usp([make_dummy_text("₹60")], set())
    assert field.status == ExtractionStatus.NOT_FOUND
    assert indices == []

def test_is_ocr_variant_strictness():
    from src.extract.rules import _is_ocr_variant
    # Legitimate expiry matches
    assert _is_ocr_variant("exp.", "exp") is True
    assert _is_ocr_variant("expiry", "exp") is True
    assert _is_ocr_variant("best before exp", "exp") is True # exact match in long string
    assert _is_ocr_variant("cxp", "exp") is True # fuzzy match in short string
    assert _is_ocr_variant("best before cxp", "exp") is False # fuzzy match in long string rejected
    
    # Legitimate MFG matches
    assert _is_ocr_variant("mfd.", "mfd") is True
    assert _is_ocr_variant("mfg.", "mfg") is True
    
    # Unrelated long text shouldn't match short keywords
    assert _is_ocr_variant("thepackaging", "exp") is False
    assert _is_ocr_variant("see coding area", "exp") is False

def test_mfg_date_extraction_not_stolen_by_unrelated_exp():
    results = [
        make_dummy_text("THE PACKAGING"), 
        make_dummy_text("#02/26"), 
        make_dummy_text("MFD")
    ]
    mfg_field, exp_field, indices = extract_all_dates(results, set())
    assert mfg_field.status == ExtractionStatus.FOUND
    assert mfg_field.extracted_value == "02/26"
    assert exp_field.status == ExtractionStatus.NOT_FOUND

def test_extract_mrp_ignores_toll_free():
    results = [
        make_dummy_text("MRP Rs. 10.00"),
        make_dummy_text("Toll Free: 1800-10-22-221")
    ]
    field, indices = extract_mrp(results, set())
    assert field.status == ExtractionStatus.FOUND
    assert field.extracted_value == "10.00"

def test_extract_usp_from_shared_token():
    # If a token contains both date and USP, USP should still be extracted even if date claimed it
    # We pass empty set for claimed_indices to extract_usp, but realistically the pipeline
    # will claim it for date. Our new logic ignores claimed_indices for the token itself.
    results = [make_dummy_text("0.14 per g #02/26")]
    claimed = {0}
    field, indices = extract_usp(results, claimed)
    assert field.status == ExtractionStatus.FOUND
    assert field.extracted_value == "0.14 per g"
