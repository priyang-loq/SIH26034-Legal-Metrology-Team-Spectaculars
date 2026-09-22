import sys, os, pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.fusion.fusion import fuse_field
from src.extract.schema import ExtractedField, ExtractionStatus

def _found(val, conf=0.9):
    return ExtractedField(status=ExtractionStatus.FOUND, extracted_value=val, extraction_confidence=conf)

# Test 1: OCR "199.00" vs VLM "199=00"
def test_mrp_equals_sign_ocr_dot_vlm_equals():
    fused = fuse_field(_found("199.00", 0.9), _found("199=00", 0.8), field_type="numeric")
    assert fused.status == ExtractionStatus.FOUND
    # The fused value may be either original OCR or VLM representation; we only assert it is not ambiguous
    assert fused.extracted_value in ("199.00", "199=00")
    # Confidence should be boosted per fusion logic
    assert fused.extraction_confidence == pytest.approx(0.95)

# Test 2: OCR "199=00" vs VLM "199.00"
def test_mrp_equals_sign_ocr_equals_vlm_dot():
    fused = fuse_field(_found("199=00", 0.9), _found("199.00", 0.8), field_type="numeric")
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value in ("199=00", "199.00")
    assert fused.extraction_confidence == pytest.approx(0.95)

# Test 3: Genuine mismatch should stay ambiguous
def test_mrp_genuine_mismatch_maintains_ambiguous():
    fused = fuse_field(_found("199.00", 0.9), _found("199.50", 0.8), field_type="numeric")
    assert fused.status == ExtractionStatus.AMBIGUOUS
    assert fused.extracted_value is None

# Test 4: Ensure existing numeric equivalence still passes (sanity)
def test_mrp_existing_equivalence_still_found():
    fused = fuse_field(_found("Rs. 199", 0.9), _found("199.00", 0.8), field_type="numeric")
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value is not None
