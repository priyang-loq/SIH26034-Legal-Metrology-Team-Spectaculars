import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.fusion.fusion import fuse_field, fuse_results
from src.extract.schema import ExtractedField, ExtractionStatus, ProductFields

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _found(val, conf=0.9):
    return ExtractedField(status=ExtractionStatus.FOUND,
                          extracted_value=val, extraction_confidence=conf)

def _low(val, conf=0.4):
    return ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE,
                          extracted_value=val, extraction_confidence=conf)

# ---------------------------------------------------------------------------
# Core fusion cases (generic field type)
# ---------------------------------------------------------------------------
def test_fuse_agreement():
    fused = fuse_field(_found("199.50", 0.9), _found("199.50", 0.8))
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "199.50"
    assert fused.extraction_confidence == 0.95   # boosted

def test_fuse_ocr_high_vlm_low():
    fused = fuse_field(_found("199", 0.9), _found("299", 0.4))
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "199"

def test_fuse_vlm_high_ocr_low():
    fused = fuse_field(_low("19", 0.4), _found("199.50", 0.8))
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "199.50"

def test_fuse_genuine_disagreement_both_high_conf_is_ambiguous():
    """Two genuinely different high-confidence values must NOT be silently resolved."""
    fused = fuse_field(_found("199", 0.95), _found("299", 0.80))
    assert fused.status == ExtractionStatus.AMBIGUOUS
    assert fused.extracted_value is None

def test_fuse_only_one_exists():
    fused = fuse_field(ExtractedField(status=ExtractionStatus.NOT_FOUND),
                       _found("ABC", 0.9))
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "ABC"

# ---------------------------------------------------------------------------
# Date normalisation — field_type="date"
# ---------------------------------------------------------------------------
def test_date_equivalent_formats_found():
    """'01/28' and 'January 2028' are the same date — must remain FOUND."""
    fused = fuse_field(_found("01/28", 0.88), _found("January 2028", 0.95),
                       field_type="date")
    assert fused.status == ExtractionStatus.FOUND, \
        f"Expected FOUND, got {fused.status} value={fused.extracted_value!r}"
    assert fused.extracted_value is not None

def test_date_jan_abbrev_equivalent():
    """'Jan 2028' must be treated the same as 'January 2028'."""
    fused = fuse_field(_found("Jan 2028", 0.90), _found("January 2028", 0.85),
                       field_type="date")
    assert fused.status == ExtractionStatus.FOUND

def test_date_mm_slash_yyyy_equivalent():
    """'01/2028' == '01/28' (both normalise to Jan 2028)."""
    fused = fuse_field(_found("01/2028", 0.90), _found("01/28", 0.85),
                       field_type="date")
    assert fused.status == ExtractionStatus.FOUND

def test_fuse_date_ocr_valid_vlm_hallucination():
    """OCR finds a valid date, VLM hallucinates non-date text -> OCR wins."""
    fused = fuse_field(_found("02/26", 0.95), _found("FOR MFD SEE CODING AREA", 0.90), field_type="date")
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "02/26"

def test_fuse_date_vlm_valid_ocr_hallucination():
    """OCR hallucinates non-date text, VLM finds a valid date -> VLM wins."""
    fused = fuse_field(_found("MFG. BY HINDUSTAN UNILEVER", 0.95), _found("02/26", 0.90), field_type="date")
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "02/26"

def test_date_genuine_mismatch_is_ambiguous():
    """'January 2028' vs 'March 2026' are genuinely different dates -> AMBIGUOUS."""
    fused = fuse_field(_found("January 2028", 0.90), _found("March 2026", 0.85),
                       field_type="date")
    assert fused.status == ExtractionStatus.AMBIGUOUS
    assert fused.extracted_value is None

def test_date_both_low_conf_stays_ambiguous():
    fused = fuse_field(_low("01/28", 0.4), _low("March 2029", 0.3),
                       field_type="date")
    assert fused.status == ExtractionStatus.AMBIGUOUS
    assert fused.extracted_value is None

# ---------------------------------------------------------------------------
# MRP normalisation — field_type="numeric"
# ---------------------------------------------------------------------------
def test_mrp_equivalent_formatting_found():
    """'Rs. 199', '199.00', '₹199' all represent the same MRP."""
    fused = fuse_field(_found("Rs. 199", 0.88), _found("199.00", 0.92),
                       field_type="numeric")
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value is not None

def test_mrp_with_decimal_equivalent():
    fused = fuse_field(_found("199", 0.90), _found("199.00", 0.85),
                       field_type="numeric")
    assert fused.status == ExtractionStatus.FOUND

def test_fuse_numeric_valid_vs_hallucination():
    """One valid numeric value vs invalid alphabetic text -> numeric wins."""
    fused = fuse_field(_found("Rs. 199", 0.90), _found("SEE BOTTOM OF PACK", 0.95), field_type="numeric")
    assert fused.status == ExtractionStatus.FOUND
    assert fused.extracted_value == "Rs. 199"

def test_mrp_genuine_mismatch_is_ambiguous():
    """199 vs 299 is a genuine MRP contradiction — AMBIGUOUS, not silently resolved."""
    fused = fuse_field(_found("199", 0.90), _found("299", 0.85),
                       field_type="numeric")
    assert fused.status == ExtractionStatus.AMBIGUOUS
    assert fused.extracted_value is None

# ---------------------------------------------------------------------------
# Net quantity normalisation — field_type="quantity"
# ---------------------------------------------------------------------------
def test_quantity_equivalent_spacing_found():
    """'250 ml' and '250ml' are the same."""
    fused = fuse_field(_found("250 ml", 0.90), _found("250ml", 0.85),
                       field_type="quantity")
    assert fused.status == ExtractionStatus.FOUND

def test_quantity_unit_conversion_equivalent():
    """'0.25 l' and '250ml' are the same quantity."""
    fused = fuse_field(_found("0.25 l", 0.88), _found("250ml", 0.92),
                       field_type="quantity")
    assert fused.status == ExtractionStatus.FOUND

def test_quantity_kg_to_g_equivalent():
    """'1 kg' and '1000g' are the same quantity."""
    fused = fuse_field(_found("1 kg", 0.90), _found("1000g", 0.85),
                       field_type="quantity")
    assert fused.status == ExtractionStatus.FOUND

def test_quantity_genuine_mismatch_is_ambiguous():
    """250 ml vs 500 ml is a genuine contradiction."""
    fused = fuse_field(_found("250ml", 0.90), _found("500ml", 0.85),
                       field_type="quantity")
    assert fused.status == ExtractionStatus.AMBIGUOUS
    assert fused.extracted_value is None

# ---------------------------------------------------------------------------
# Regression: manufacturing_date end-to-end via fuse_results
# ---------------------------------------------------------------------------
def test_fuse_manufacturing_date_format_mismatch_stays_found():
    """Regression: manufacturing_date FOUND in both OCR and VLM with different
    format strings (e.g. '01/28' vs 'January 2028') must remain FOUND after
    full fuse_results() call (not just fuse_field directly)."""
    ocr_fields = ProductFields()
    ocr_fields.manufacturing_date = _found("01/28", 0.88)

    vlm_fields = ProductFields()
    vlm_fields.manufacturing_date = _found("January 2028", 0.95)

    fused = fuse_results(ocr_fields, vlm_fields)
    f = fused.manufacturing_date
    assert f.status == ExtractionStatus.FOUND, \
        f"Expected FOUND, got {f.status} value={f.extracted_value!r}"
    assert f.extracted_value is not None
