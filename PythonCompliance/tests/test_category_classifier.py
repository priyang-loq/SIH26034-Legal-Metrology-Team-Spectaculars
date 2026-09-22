"""
tests/test_category_classifier.py

TDD tests for the future Category Classification component.

This component sits after normalization and before the LMPC rule engine.
It determines the product category (general, food, cosmetic, alcohol, seeds, bidi_incense, lpg_cylinder)
based on visible evidence in the NormalizedProductFields.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import NormalizedProductFields, NormalizedField, ValidationStatus

from src.rules.classifier import classify_category, CategoryResult, CategoryStatus


def _mock_normalized_fields(product_name="Unknown", category_text=None, fssai_text=None, canonical_category_text=None) -> NormalizedProductFields:
    """Helper to build a dummy NormalizedProductFields for testing."""
    from src.normalize.normalizer import NormalizedMRP, NormalizedQuantity, NormalizedDate, NormalizedPhone, NormalizedEmail
    
    # Just need minimal valid objects to pass through
    dummy_mrp = NormalizedField(field=ExtractedField(), field_kind="mrp", normalized=NormalizedMRP(raw_value="").model_dump())
    dummy_qty = NormalizedField(field=ExtractedField(), field_kind="quantity", normalized=NormalizedQuantity(raw_value="").model_dump())
    dummy_date = NormalizedField(field=ExtractedField(), field_kind="date", normalized=NormalizedDate(raw_value="").model_dump())
    dummy_phone = NormalizedField(field=ExtractedField(), field_kind="phone", normalized=NormalizedPhone(raw_value="").model_dump())
    dummy_email = NormalizedField(field=ExtractedField(), field_kind="email", normalized=NormalizedEmail(raw_value="").model_dump())
    
    prod_name = ExtractedField(status=ExtractionStatus.FOUND, extracted_value=product_name, source_text=product_name, extraction_confidence=0.9)
    cat_field = ExtractedField(status=ExtractionStatus.FOUND if category_text else ExtractionStatus.NOT_FOUND, 
                               extracted_value=category_text, source_text=category_text, extraction_confidence=0.9 if category_text else 0.0)
    fssai_field = ExtractedField(status=ExtractionStatus.FOUND if fssai_text else ExtractionStatus.NOT_FOUND,
                                 extracted_value=fssai_text, source_text=fssai_text, extraction_confidence=0.9 if fssai_text else 0.0)
    canonical_cat_field = ExtractedField(
        status=ExtractionStatus.FOUND if canonical_category_text else ExtractionStatus.NOT_FOUND,
        extracted_value=canonical_category_text, source_text=canonical_category_text,
        extraction_confidence=0.95 if canonical_category_text else 0.0
    )
    
    fields = NormalizedProductFields(
        mrp=dummy_mrp,
        net_quantity=dummy_qty,
        manufacturing_date=dummy_date,
        expiry_date=dummy_date,
        consumer_care_phone=dummy_phone,
        consumer_care_email=dummy_email,
        product_name=prod_name,
        category=cat_field,
        canonical_category=canonical_cat_field,
        manufacturer_name=ExtractedField(),
        manufacturer_address=ExtractedField(),
        batch_number=ExtractedField(),
        fssai=fssai_field,
        country_of_origin=ExtractedField()
    )
    
    return fields


def test_category_general():
    """1. GENERAL: Ordinary packaged commodity."""
    fields = _mock_normalized_fields(product_name="Standard Notebook", category_text="Stationery")
    result = classify_category(fields)
    assert result.category == "general"
    assert result.status == CategoryStatus.CONFIDENT


def test_category_food():
    """2. FOOD: Evidence such as FSSAI-related text."""
    fields = _mock_normalized_fields(product_name="Potato Chips", fssai_text="FSSAI Lic. No. 10012011000168")
    result = classify_category(fields)
    assert result.category == "food"
    assert result.status == CategoryStatus.CONFIDENT
    assert "FSSAI" in str(result.evidence)


def test_category_cosmetic():
    """3. COSMETIC: Product-type evidence such as cream, shampoo, lotion."""
    fields = _mock_normalized_fields(product_name="Moisturizing Cream", category_text="Skin Care")
    result = classify_category(fields)
    assert result.category == "cosmetic"
    assert result.status == CategoryStatus.CONFIDENT


def test_category_alcohol():
    """4. ALCOHOL: Excise/liquor labelling evidence."""
    fields = _mock_normalized_fields(product_name="Premium Whisky", category_text="For Sale in Delhi Only - Liquor")
    result = classify_category(fields)
    assert result.category == "alcohol"
    assert result.status == CategoryStatus.CONFIDENT


def test_category_seeds():
    """5. SEEDS: Evidence indicating certified seeds."""
    fields = _mock_normalized_fields(product_name="Tomato Seeds", category_text="Certified Seeds")
    result = classify_category(fields)
    assert result.category == "seeds"
    assert result.status == CategoryStatus.CONFIDENT


def test_category_bidi_incense():
    """6. BIDI / INCENSE: Evidence indicating bidi or incense-stick."""
    fields = _mock_normalized_fields(product_name="Premium Agarbatti", category_text="Incense Sticks")
    result = classify_category(fields)
    assert result.category == "bidi_incense"
    assert result.status == CategoryStatus.CONFIDENT


def test_category_lpg_cylinder():
    """7. LPG CYLINDER: Domestic cylinder context."""
    fields = _mock_normalized_fields(product_name="14.2 kg Domestic Cylinder", category_text="LPG")
    result = classify_category(fields)
    assert result.category == "lpg_cylinder"
    assert result.status == CategoryStatus.CONFIDENT


def test_category_uncertain():
    """8. UNCERTAIN CATEGORY: Ambiguous or insufficient evidence."""
    # Product name is generic, category extracted with low confidence
    fields = _mock_normalized_fields(product_name="Item")
    fields.category.status = ExtractionStatus.LOW_CONFIDENCE
    fields.category.extracted_value = "Maybe Food"
    fields.category.extraction_confidence = 0.3
    
    result = classify_category(fields)
    assert result.category == "general"
    assert result.status == CategoryStatus.LOW_CONFIDENCE


def test_category_no_evidence():
    """9. NO CATEGORY EVIDENCE: Empty/minimal evidence must NOT invent a special category."""
    fields = _mock_normalized_fields(product_name=None, category_text=None)
    result = classify_category(fields)
    assert result.category == "general"
    # Could be CONFIDENT general or LOW_CONFIDENCE general depending on design, 
    # but it MUST be "general".
    assert result.status in [CategoryStatus.CONFIDENT, CategoryStatus.LOW_CONFIDENCE]


def test_category_conflicting_evidence():
    """10. CONFLICTING EVIDENCE: Strongly suggests two different categories."""
    fields = _mock_normalized_fields(product_name="Shampoo", fssai_text="FSSAI Lic. No. 10012011000168")
    result = classify_category(fields)
    # Should not silently choose. Default to general with LOW_CONFIDENCE/review.
    assert result.category == "general"
    assert result.status == CategoryStatus.LOW_CONFIDENCE


def test_category_evidence_preservation():
    """11. EVIDENCE PRESERVATION: Must preserve evidence that caused classification."""
    fields = _mock_normalized_fields(product_name="Face Wash", category_text="Cosmetics")
    result = classify_category(fields)
    assert "Face Wash" in str(result.evidence) or "Cosmetics" in str(result.evidence)


def test_category_determinism():
    """12. DETERMINISM: Same input must always produce the same result."""
    fields1 = _mock_normalized_fields(product_name="Hair Oil")
    fields2 = _mock_normalized_fields(product_name="Hair Oil")
    res1 = classify_category(fields1)
    res2 = classify_category(fields2)
    assert res1.category == res2.category
    assert res1.status == res2.status


def test_category_case_punctuation_robustness():
    """13. CASE / PUNCTUATION ROBUSTNESS."""
    f1 = _mock_normalized_fields(product_name="MOISTURIZING CREAM!")
    f2 = _mock_normalized_fields(product_name="moisturizing cream.")
    res1 = classify_category(f1)
    res2 = classify_category(f2)
    assert res1.category == "cosmetic"
    assert res2.category == "cosmetic"


def test_category_false_positive_protection():
    """14. FALSE POSITIVE PROTECTION: Generic words shouldn't trigger special categories."""
    # 'cream' is in cosmetic, but 'ice cream' is food
    fields = _mock_normalized_fields(product_name="Ice Cream", fssai_text="FSSAI")
    result = classify_category(fields)
    assert result.category == "food"


def test_category_status_propagation():
    """15. STATUS PROPAGATION: Low confidence source fields -> don't manufacture high-confidence category."""
    fields = _mock_normalized_fields(product_name="Lipstick")
    # Mark the source extraction as low confidence
    fields.product_name.status = ExtractionStatus.LOW_CONFIDENCE
    fields.product_name.extraction_confidence = 0.4
    
    result = classify_category(fields)
    assert result.status == CategoryStatus.LOW_CONFIDENCE

# --- NEW TESTS FOR VLM CANONICAL CATEGORY SIGNAL ---

def test_canonical_food_and_keyword_food():
    """VLM canonical_category='food' + weak keyword match -> CONFIDENT food"""
    fields = _mock_normalized_fields(product_name="Item", canonical_category_text="food")
    fields.category.status = ExtractionStatus.LOW_CONFIDENCE
    fields.category.extracted_value = "Maybe Food"
    fields.category.extraction_confidence = 0.3
    
    result = classify_category(fields)
    assert result.category == "food"
    assert result.status == CategoryStatus.CONFIDENT

def test_canonical_food_and_keyword_nothing():
    """VLM canonical_category='food' + keyword match finds nothing -> LOW_CONFIDENCE food (not general)"""
    fields = _mock_normalized_fields(product_name="Chips", canonical_category_text="food")
    result = classify_category(fields)
    assert result.category == "food"
    assert result.status == CategoryStatus.LOW_CONFIDENCE

def test_canonical_general_falls_back_to_keyword():
    """VLM canonical_category='general' (VLM genuinely uncertain) -> falls back to existing keyword logic"""
    fields = _mock_normalized_fields(product_name="Potato Chips", fssai_text="FSSAI", canonical_category_text="general")
    result = classify_category(fields)
    assert result.category == "food"
    assert result.status == CategoryStatus.CONFIDENT

def test_canonical_missing_falls_back_to_keyword():
    """VLM canonical_category missing/None (simulating AI_UNAVAILABLE) -> falls back to keyword logic"""
    fields = _mock_normalized_fields(product_name="Potato Chips", fssai_text="FSSAI", canonical_category_text=None)
    result = classify_category(fields)
    assert result.category == "food"
    assert result.status == CategoryStatus.CONFIDENT

def test_product01_trace_data_now_classifies_food():
    """Reuse the exact real product01.jpg trace data... confirm it now classifies as 'food' instead of 'general'"""
    fields = _mock_normalized_fields(product_name="DATES", category_text="Dry Fruits", fssai_text=None, canonical_category_text="food")
    result = classify_category(fields)
    assert result.category == "food"
    # Wait, the keyword match for DATES/Dry Fruits finds NOTHING. 
    # VLM canonical is 'food'. Disagreement (food vs general) means it should be LOW_CONFIDENCE.
    assert result.status == CategoryStatus.LOW_CONFIDENCE


# ---------------------------------------------------------------------------
# Phase 2C: sub_category propagation for bidi_incense
# ---------------------------------------------------------------------------

def test_subcategory_bidi():
    """CASE 1: Clear bidi evidence -> sub_category='bidi'."""
    fields = _mock_normalized_fields(product_name="Premium Bidi Cigarettes", category_text="Tobacco")
    result = classify_category(fields)
    assert result.category == "bidi_incense"
    assert result.sub_category == "bidi"


def test_subcategory_incense():
    """CASE 2: Clear incense evidence -> sub_category='incense'."""
    fields = _mock_normalized_fields(product_name="Sandalwood Incense Sticks", category_text="Home Fragrance")
    result = classify_category(fields)
    assert result.category == "bidi_incense"
    assert result.sub_category == "incense"


def test_subcategory_agarbatti_maps_to_incense():
    """CASE 3: Agarbatti evidence -> sub_category='incense'."""
    fields = _mock_normalized_fields(product_name="Cycle Pure Agarbatti", category_text="Fragrance")
    result = classify_category(fields)
    assert result.category == "bidi_incense"
    assert result.sub_category == "incense"


def test_subcategory_none_when_no_specific_evidence():
    """CASE 4: Category resolves to bidi_incense but no specific bidi/incense sub-pattern present.
    Uses the canonical_category to force bidi_incense without adding bidi/incense keyword.
    sub_category must be None.
    """
    # Product name has no bidi/incense/agarbatti keyword; canonical forces bidi_incense
    fields = _mock_normalized_fields(
        product_name="Fragrant Sticks",
        category_text="Traditional Product",
        canonical_category_text="bidi_incense"
    )
    result = classify_category(fields)
    assert result.category == "bidi_incense"
    assert result.sub_category is None


def test_subcategory_none_when_ambiguous():
    """CASE 5: Both bidi and incense/agarbatti indicators present -> sub_category=None."""
    fields = _mock_normalized_fields(
        product_name="Bidi Agarbatti Mix Pack",
        category_text="Tobacco and Incense"
    )
    result = classify_category(fields)
    assert result.category == "bidi_incense"
    assert result.sub_category is None

