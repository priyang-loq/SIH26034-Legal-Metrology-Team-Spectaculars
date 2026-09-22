import pytest
from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import NormalizedField
from src.rules.result import RuleStatus
from src.rules.common.shared import map_extraction_status_to_rule_status
from src.rules.common.manufacturing_date import check_manufacturing_date
from src.rules.common.mrp import check_mrp

def test_mapping_function():
    # FOUND + parse succeeded -> PASS (candidate)
    assert map_extraction_status_to_rule_status(ExtractionStatus.FOUND, True) == RuleStatus.PASS
    # FOUND + parse failed -> VIOLATION
    assert map_extraction_status_to_rule_status(ExtractionStatus.FOUND, False) == RuleStatus.VIOLATION
    # LOW_CONFIDENCE -> NEEDS_REVIEW
    assert map_extraction_status_to_rule_status(ExtractionStatus.LOW_CONFIDENCE, True) == RuleStatus.NEEDS_REVIEW
    assert map_extraction_status_to_rule_status(ExtractionStatus.LOW_CONFIDENCE, False) == RuleStatus.NEEDS_REVIEW
    # AMBIGUOUS -> NEEDS_REVIEW
    assert map_extraction_status_to_rule_status(ExtractionStatus.AMBIGUOUS, True) == RuleStatus.NEEDS_REVIEW
    assert map_extraction_status_to_rule_status(ExtractionStatus.AMBIGUOUS, False) == RuleStatus.NEEDS_REVIEW
    # NOT_FOUND -> VIOLATION
    assert map_extraction_status_to_rule_status(ExtractionStatus.NOT_FOUND, True) == RuleStatus.VIOLATION
    assert map_extraction_status_to_rule_status(ExtractionStatus.NOT_FOUND, False) == RuleStatus.VIOLATION
    
    # Try SOURCE_UNAVAILABLE if it exists
    try:
        assert map_extraction_status_to_rule_status(ExtractionStatus.SOURCE_UNAVAILABLE, True) == RuleStatus.NEEDS_REVIEW
        assert map_extraction_status_to_rule_status(ExtractionStatus.SOURCE_UNAVAILABLE, False) == RuleStatus.NEEDS_REVIEW
    except AttributeError:
        # Expected before implementation
        pass

def test_mfg_date_found_valid():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="02/26"),
        normalized={"validation": "VALID", "month": 2, "year": 2026}
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_D"

def test_mfg_date_renormalize_02_26():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="02/26"),
        normalized=None
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_D"

def test_mfg_date_renormalize_hash_02_26():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="#02/26"),
        normalized=None
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_D"

def test_mfg_date_found_invalid():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "INVALID"}
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.VIOLATION
    assert "unparseable" in res.message.lower() or "invalid" in res.message.lower()

def test_mfg_date_not_found():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.VIOLATION
    assert "missing" in res.message.lower()

def test_mfg_date_low_confidence():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE),
        normalized=None
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_mfg_date_ambiguous():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.AMBIGUOUS),
        normalized=None
    )
    res = check_manufacturing_date(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_mrp_found_valid():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "numeric": 150.0}
    )
    res = check_mrp(field)
    assert res.status == RuleStatus.PASS
    assert res.rule_id == "LMPC_6_1_E"

def test_mrp_found_invalid_parse():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "INVALID", "numeric": None}
    )
    res = check_mrp(field)
    assert res.status == RuleStatus.VIOLATION

def test_mrp_found_zero_or_negative():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "numeric": 0.0}
    )
    res = check_mrp(field)
    assert res.status == RuleStatus.VIOLATION
    
    field2 = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "numeric": -5.0}
    )
    res2 = check_mrp(field2)
    assert res2.status == RuleStatus.VIOLATION

def test_mrp_not_found():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.NOT_FOUND),
        normalized=None
    )
    res = check_mrp(field)
    assert res.status == RuleStatus.VIOLATION
    assert "missing" in res.message.lower()

def test_mrp_low_confidence():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.LOW_CONFIDENCE),
        normalized=None
    )
    res = check_mrp(field)
    assert res.status == RuleStatus.NEEDS_REVIEW

def test_mrp_ambiguous():
    field = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.AMBIGUOUS),
        normalized=None
    )
    res = check_mrp(field)
    assert res.status == RuleStatus.NEEDS_REVIEW
