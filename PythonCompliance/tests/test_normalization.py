"""
tests/test_normalization.py

Unit tests for the src/normalize/normalizer.py module.

Verifies:
  - MRP: equivalent representations, invalid values, raw value preservation
  - Quantity: equivalent representations, unit conversions, invalid units
  - Date: valid/ambiguous/invalid representations, raw value preservation
  - Phone/Email: structural validation
  - Confidence/status pass-through: LOW_CONFIDENCE stays UNCERTAIN, etc.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import (
    normalize_mrp,
    normalize_quantity,
    normalize_date,
    normalize_phone,
    normalize_email,
    ValidationStatus,
    NormalizedMRP,
    NormalizedQuantity,
    NormalizedDate,
    NormalizedPhone,
    NormalizedEmail,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _found(val, conf=0.9) -> ExtractedField:
    return ExtractedField(
        status=ExtractionStatus.FOUND,
        extracted_value=val,
        extraction_confidence=conf,
    )

def _low(val, conf=0.45) -> ExtractedField:
    return ExtractedField(
        status=ExtractionStatus.LOW_CONFIDENCE,
        extracted_value=val,
        extraction_confidence=conf,
    )

def _ambiguous(val) -> ExtractedField:
    return ExtractedField(
        status=ExtractionStatus.AMBIGUOUS,
        extracted_value=val,
        extraction_confidence=0.6,
    )

def _not_found() -> ExtractedField:
    return ExtractedField(status=ExtractionStatus.NOT_FOUND)

def mrp_norm(nf) -> NormalizedMRP:
    return NormalizedMRP(**nf.normalized)

def qty_norm(nf) -> NormalizedQuantity:
    return NormalizedQuantity(**nf.normalized)

def date_norm(nf) -> NormalizedDate:
    return NormalizedDate(**nf.normalized)

def phone_norm(nf) -> NormalizedPhone:
    return NormalizedPhone(**nf.normalized)

def email_norm(nf) -> NormalizedEmail:
    return NormalizedEmail(**nf.normalized)


# ===========================================================================
# MRP
# ===========================================================================

class TestMRP:

    def test_plain_integer(self):
        nf = normalize_mrp(_found("199"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0
        assert n.validation == ValidationStatus.VALID
        assert n.raw_value == "199"

    def test_decimal(self):
        nf = normalize_mrp(_found("199.00"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0
        assert n.validation == ValidationStatus.VALID

    def test_rupee_prefix(self):
        nf = normalize_mrp(_found("₹199"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0
        assert n.validation == ValidationStatus.VALID

    def test_rs_dot_prefix(self):
        nf = normalize_mrp(_found("Rs. 199"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0
        assert n.validation == ValidationStatus.VALID

    def test_rs_prefix_no_space(self):
        nf = normalize_mrp(_found("Rs.199"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0
        assert n.validation == ValidationStatus.VALID

    def test_raw_value_preserved(self):
        """raw_value must exactly match the original extracted string."""
        original = "₹ 183.28"
        nf = normalize_mrp(_found(original))
        n = mrp_norm(nf)
        assert n.raw_value == original
        # Extraction field is also unchanged
        assert nf.field.extracted_value == original

    def test_invalid_nonnumeric(self):
        nf = normalize_mrp(_found("N/A"))
        n = mrp_norm(nf)
        assert n.numeric is None
        assert n.validation == ValidationStatus.INVALID

    def test_currency_field_always_inr(self):
        nf = normalize_mrp(_found("₹99"))
        assert mrp_norm(nf).currency == "INR"

    def test_low_confidence_stays_uncertain(self):
        """A LOW_CONFIDENCE field that normalises OK must still be UNCERTAIN."""
        nf = normalize_mrp(_low("199"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0           # normalised OK
        assert n.validation == ValidationStatus.UNCERTAIN  # but not VALID

    def test_ambiguous_stays_uncertain(self):
        nf = normalize_mrp(_ambiguous("199"))
        n = mrp_norm(nf)
        assert n.numeric == 199.0
        assert n.validation == ValidationStatus.UNCERTAIN

    def test_none_value_returns_no_normalized(self):
        nf = normalize_mrp(_not_found())
        assert nf.normalized is None

    def test_field_kind(self):
        nf = normalize_mrp(_found("99"))
        assert nf.field_kind == "mrp"


# ===========================================================================
# Net Quantity
# ===========================================================================

class TestQuantity:

    def test_ml_no_space(self):
        nf = normalize_quantity(_found("250ml"))
        n = qty_norm(nf)
        assert n.numeric == 250.0
        assert n.canonical_unit == "ml"
        assert n.validation == ValidationStatus.VALID

    def test_ml_with_space(self):
        nf = normalize_quantity(_found("250 ml"))
        n = qty_norm(nf)
        assert n.numeric == 250.0
        assert n.canonical_unit == "ml"
        assert n.validation == ValidationStatus.VALID

    def test_litre_to_ml(self):
        nf = normalize_quantity(_found("0.25 l"))
        n = qty_norm(nf)
        assert n.numeric == pytest.approx(250.0)
        assert n.canonical_unit == "ml"
        assert n.validation == ValidationStatus.VALID

    def test_litre_full_word(self):
        nf = normalize_quantity(_found("1 litre"))
        n = qty_norm(nf)
        assert n.numeric == 1000.0
        assert n.canonical_unit == "ml"

    def test_kg_to_g(self):
        nf = normalize_quantity(_found("1 kg"))
        n = qty_norm(nf)
        assert n.numeric == 1000.0
        assert n.canonical_unit == "g"
        assert n.validation == ValidationStatus.VALID

    def test_kg_fractional(self):
        nf = normalize_quantity(_found("0.5kg"))
        n = qty_norm(nf)
        assert n.numeric == pytest.approx(500.0)
        assert n.canonical_unit == "g"

    def test_g_passthrough(self):
        nf = normalize_quantity(_found("500g"))
        n = qty_norm(nf)
        assert n.numeric == 500.0
        assert n.canonical_unit == "g"

    def test_count_unit_not_converted(self):
        """Tablets must NOT be converted to mass/volume."""
        nf = normalize_quantity(_found("10tablets"))
        n = qty_norm(nf)
        assert n.is_count is True
        assert n.numeric == 10.0
        assert n.canonical_unit == "tablets"
        assert n.validation == ValidationStatus.VALID

    def test_caps_count_unit(self):
        nf = normalize_quantity(_found("30capsules"))
        n = qty_norm(nf)
        assert n.is_count is True

    def test_invalid_unit(self):
        nf = normalize_quantity(_found("250xyz"))
        n = qty_norm(nf)
        assert n.numeric is None
        assert n.validation == ValidationStatus.INVALID

    def test_unparseable_string(self):
        nf = normalize_quantity(_found("large size"))
        n = qty_norm(nf)
        assert n.numeric is None
        assert n.validation == ValidationStatus.INVALID

    def test_raw_value_preserved(self):
        original = "1 kg"
        nf = normalize_quantity(_found(original))
        assert qty_norm(nf).raw_value == original
        assert nf.field.extracted_value == original

    def test_low_confidence_stays_uncertain(self):
        nf = normalize_quantity(_low("250ml"))
        n = qty_norm(nf)
        assert n.numeric == 250.0
        assert n.validation == ValidationStatus.UNCERTAIN

    def test_ambiguous_stays_uncertain(self):
        nf = normalize_quantity(_ambiguous("250ml"))
        n = qty_norm(nf)
        assert n.validation == ValidationStatus.UNCERTAIN

    def test_field_kind(self):
        nf = normalize_quantity(_found("250ml"))
        assert nf.field_kind == "quantity"


# ===========================================================================
# Date
# ===========================================================================

class TestDate:

    def test_mm_slash_yy(self):
        nf = normalize_date(_found("01/28"))
        n = date_norm(nf)
        assert n.month == 1
        assert n.year == 2028
        assert n.day is None        # not present in raw — must NOT be invented
        assert n.validation == ValidationStatus.VALID

    def test_mm_slash_yy_with_hash_prefix(self):
        nf = normalize_date(_found("#02/26"))
        n = date_norm(nf)
        assert n.month == 2
        assert n.year == 2026
        assert n.day is None
        assert n.validation == ValidationStatus.VALID
        assert date_norm(nf).raw_value == "#02/26"

    def test_mm_slash_yyyy(self):
        nf = normalize_date(_found("01/2028"))
        n = date_norm(nf)
        assert n.month == 1
        assert n.year == 2028
        assert n.validation == ValidationStatus.VALID

    def test_month_name_full(self):
        nf = normalize_date(_found("January 2028"))
        n = date_norm(nf)
        assert n.month == 1
        assert n.year == 2028
        assert n.validation == ValidationStatus.VALID

    def test_month_name_abbreviated(self):
        nf = normalize_date(_found("Jan 2028"))
        n = date_norm(nf)
        assert n.month == 1
        assert n.year == 2028
        assert n.validation == ValidationStatus.VALID

    def test_full_date_dd_mm_yyyy(self):
        nf = normalize_date(_found("15/03/2026"))
        n = date_norm(nf)
        assert n.day == 15
        assert n.month == 3
        assert n.year == 2026
        assert n.validation == ValidationStatus.VALID

    def test_invalid_month(self):
        nf = normalize_date(_found("13/2028"))
        n = date_norm(nf)
        # month 13 is invalid
        assert n.validation == ValidationStatus.INVALID

    def test_unrecognised_text(self):
        nf = normalize_date(_found("not a date"))
        n = date_norm(nf)
        assert n.month is None
        assert n.year is None
        assert n.validation == ValidationStatus.INVALID

    def test_raw_value_preserved(self):
        original = "Mfg: Jan 2028"
        nf = normalize_date(_found(original))
        assert date_norm(nf).raw_value == original
        assert nf.field.extracted_value == original

    def test_low_confidence_stays_uncertain(self):
        nf = normalize_date(_low("01/28"))
        n = date_norm(nf)
        assert n.month == 1
        assert n.validation == ValidationStatus.UNCERTAIN   # not VALID

    def test_ambiguous_date_stays_uncertain(self):
        nf = normalize_date(_ambiguous("01/28"))
        n = date_norm(nf)
        assert n.validation == ValidationStatus.UNCERTAIN

    def test_field_kind(self):
        nf = normalize_date(_found("01/28"))
        assert nf.field_kind == "date"


# ===========================================================================
# Phone
# ===========================================================================

class TestPhone:

    def test_plain_digits(self):
        nf = normalize_phone(_found("1800123456"))
        n = phone_norm(nf)
        assert n.digits_only == "1800123456"
        assert n.validation == ValidationStatus.VALID

    def test_with_dashes(self):
        nf = normalize_phone(_found("1800-123-456"))
        n = phone_norm(nf)
        assert n.digits_only == "1800123456"
        assert n.validation == ValidationStatus.VALID

    def test_too_short(self):
        nf = normalize_phone(_found("123"))
        n = phone_norm(nf)
        assert n.validation == ValidationStatus.INVALID

    def test_low_confidence_stays_uncertain(self):
        nf = normalize_phone(_low("1800123456"))
        n = phone_norm(nf)
        assert n.digits_only == "1800123456"
        assert n.validation == ValidationStatus.UNCERTAIN


# ===========================================================================
# Email
# ===========================================================================

class TestEmail:

    def test_valid_email(self):
        nf = normalize_email(_found("care@company.com"))
        n = email_norm(nf)
        assert n.lower == "care@company.com"
        assert n.validation == ValidationStatus.VALID

    def test_uppercase_normalised(self):
        nf = normalize_email(_found("Care@Company.COM"))
        n = email_norm(nf)
        assert n.lower == "care@company.com"
        assert n.validation == ValidationStatus.VALID

    def test_invalid_no_at(self):
        nf = normalize_email(_found("notanemail.com"))
        n = email_norm(nf)
        assert n.validation == ValidationStatus.INVALID
        assert n.lower is None

    def test_low_confidence_stays_uncertain(self):
        nf = normalize_email(_low("care@company.com"))
        n = email_norm(nf)
        assert n.lower == "care@company.com"
        assert n.validation == ValidationStatus.UNCERTAIN

def test_packer_importer_not_dropped():
    from src.extract.schema import ProductFields, ExtractedField, ExtractionStatus, CompanyInfo, ConsumerCareInfo
    from src.normalize.normalizer import normalize_product_fields
    
    fields = ProductFields(
        product_name=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Test Product"),
        category=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="general"),
        mrp=ExtractedField(),
        net_quantity=ExtractedField(),
        manufacturer=CompanyInfo(), # Empty/NOT_FOUND
        packer=CompanyInfo(
            name=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Test Packer"),
            address=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Packer Address")
        ),
        importer=CompanyInfo(
            name=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Test Importer"),
            address=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Importer Address")
        ),
        consumer_care=ConsumerCareInfo(),
        country_of_origin=ExtractedField(),
        manufacturing_date=ExtractedField(),
        expiry_date=ExtractedField(),
        batch_number=ExtractedField(),
        fssai=ExtractedField(),
        canonical_category=ExtractedField()
    )
    
    norm = normalize_product_fields(fields)
    assert hasattr(norm, 'packer_name')
    assert norm.packer_name.extracted_value == "Test Packer"
    assert hasattr(norm, 'importer_name')
    assert norm.importer_name.extracted_value == "Test Importer"
    assert hasattr(norm, 'packer_address')
    assert norm.packer_address.extracted_value == "Packer Address"
    assert hasattr(norm, 'importer_address')
    assert norm.importer_address.extracted_value == "Importer Address"
    assert norm.packer_name.status == ExtractionStatus.FOUND
    assert norm.importer_name.status == ExtractionStatus.FOUND
