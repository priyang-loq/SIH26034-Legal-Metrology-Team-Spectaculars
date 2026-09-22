import pytest
from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import NormalizedField
from src.rules.result import RuleStatus

from src.rules.common.manufacturer import check_manufacturer
from src.rules.common.product_name import check_product_name
from src.rules.common.quantity import check_quantity
from src.rules.common.dimensions import check_dimensions
from src.rules.common.consumer_care import check_consumer_care

# 1. manufacturer_packer_importer (ExtractedField)
def test_manufacturer_found_valid():
    field = ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Acme Corp")
    res = check_manufacturer(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_A"

def test_manufacturer_found_invalid():
    field = ExtractedField(status=ExtractionStatus.FOUND, extracted_value="   ")
    res = check_manufacturer(field)
    assert res.status == RuleStatus.VIOLATION

def test_manufacturer_not_found():
    field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    res = check_manufacturer(field)
    assert res.status == RuleStatus.VIOLATION
    assert "missing" in res.message.lower()

def test_manufacturer_low_confidence():
    field = ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE)
    res = check_manufacturer(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_manufacturer_ambiguous():
    field = ExtractedField(status=ExtractionStatus.AMBIGUOUS)
    res = check_manufacturer(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_manufacturer_source_unavailable():
    field = ExtractedField(status=getattr(ExtractionStatus, "SOURCE_UNAVAILABLE", ExtractionStatus.NOT_FOUND))
    res = check_manufacturer(field)
    assert res.status == RuleStatus.NEEDS_REVIEW
    assert "analysis was unavailable" in res.message.lower()

# 2. common_name (ExtractedField)
def test_product_name_found_valid():
    field = ExtractedField(status=ExtractionStatus.FOUND, extracted_value="Biscuits")
    res = check_product_name(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_B"

def test_product_name_found_invalid():
    field = ExtractedField(status=ExtractionStatus.FOUND, extracted_value="")
    res = check_product_name(field)
    assert res.status == RuleStatus.VIOLATION

def test_product_name_not_found():
    field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    res = check_product_name(field)
    assert res.status == RuleStatus.VIOLATION
    assert "missing" in res.message.lower()

def test_product_name_low_confidence():
    field = ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE)
    res = check_product_name(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_product_name_ambiguous():
    field = ExtractedField(status=ExtractionStatus.AMBIGUOUS)
    res = check_product_name(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_product_name_source_unavailable():
    field = ExtractedField(status=getattr(ExtractionStatus, "SOURCE_UNAVAILABLE", ExtractionStatus.NOT_FOUND))
    res = check_product_name(field)
    assert res.status == RuleStatus.NEEDS_REVIEW
    assert "analysis was unavailable" in res.message.lower()

# 3. net_quantity (NormalizedField)
def test_quantity_found_valid():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "numeric": 500.0, "canonical_unit": "g"}
    )
    res = check_quantity(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_C"

def test_quantity_found_invalid_parse():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "INVALID", "numeric": None}
    )
    res = check_quantity(field)
    assert res.status == RuleStatus.VIOLATION

def test_quantity_found_zero_or_negative():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "numeric": 0.0, "canonical_unit": "g"}
    )
    res = check_quantity(field)
    assert res.status == RuleStatus.VIOLATION
    
    field2 = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "numeric": -10.0, "canonical_unit": "g"}
    )
    res2 = check_quantity(field2)
    assert res2.status == RuleStatus.VIOLATION

def test_quantity_not_found():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_quantity(field)
    assert res.status == RuleStatus.VIOLATION
    assert "missing" in res.message.lower()

def test_quantity_low_confidence():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE),
        normalized=None
    )
    res = check_quantity(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_quantity_ambiguous():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.AMBIGUOUS),
        normalized=None
    )
    res = check_quantity(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

# 4. dimensions (ExtractedField - since normalizer lacks it)
def test_dimensions_found_valid():
    field = ExtractedField(status=ExtractionStatus.FOUND, extracted_value="10x10x10 cm")
    res = check_dimensions(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_F"

def test_dimensions_found_invalid():
    field = ExtractedField(status=ExtractionStatus.FOUND, extracted_value="")
    res = check_dimensions(field)
    assert res.status == RuleStatus.VIOLATION

def test_dimensions_not_found():
    field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    res = check_dimensions(field)
    assert res.status == RuleStatus.NEEDS_REVIEW # PROVISIONAL: NEEDS_REVIEW instead of VIOLATION

def test_dimensions_low_confidence():
    field = ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE)
    res = check_dimensions(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_dimensions_ambiguous():
    field = ExtractedField(status=ExtractionStatus.AMBIGUOUS)
    res = check_dimensions(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

# 5. consumer_care (Takes multiple NormalizedFields because normalizer only outputs phone/email)
def test_consumer_care_found_valid():
    phone = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "digits_only": "1234567890"}
    )
    email = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_consumer_care(phone=phone, email=email)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_2"

def test_consumer_care_found_invalid():
    phone = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "INVALID"}
    )
    email = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_consumer_care(phone=phone, email=email)
    assert res.status == RuleStatus.VIOLATION

def test_consumer_care_not_found():
    phone = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    email = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_consumer_care(phone=phone, email=email)
    assert res.status == RuleStatus.VIOLATION
    assert "missing" in res.message.lower()

def test_consumer_care_low_confidence():
    phone = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE),
        normalized=None
    )
    email = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_consumer_care(phone=phone, email=email)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_consumer_care_ambiguous():
    phone = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.AMBIGUOUS),
        normalized=None
    )
    email = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_consumer_care(phone=phone, email=email)
    assert res.status == RuleStatus.NEEDS_REVIEW
