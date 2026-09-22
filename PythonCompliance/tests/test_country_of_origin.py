import pytest
from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import NormalizedProductFields, NormalizedField
from src.rules.engine import evaluate_general_rules, RuleStatus
from src.rules.common.country_of_origin import COUNTRY_OF_ORIGIN_RULE_ID
from src.rules.adapters import adapt_normalized_fields

def make_extracted(val, status=ExtractionStatus.FOUND):
    return ExtractedField(extracted_value=val, status=status, extraction_confidence=0.9)

def make_norm(field_id, extracted, norm_val=None, field_kind="generic"):
    return NormalizedField(field=extracted, normalized=norm_val, field_kind=field_kind)

def get_base_fields():
    # Provide the minimum required fields to satisfy NormalizedProductFields constructor
    return {
        "mrp": make_norm("mrp", make_extracted("100")),
        "net_quantity": make_norm("net_quantity", make_extracted("100g")),
        "manufacturing_date": make_norm("manufacturing_date", make_extracted("Jan 2024")),
        "expiry_date": make_norm("expiry_date", make_extracted("Jan 2025")),
        "consumer_care_phone": make_norm("phone", make_extracted("123")),
        "consumer_care_email": make_norm("email", make_extracted("a@b.com")),
        "product_name": make_extracted("Test"),
        "category": make_extracted("general"),
        "canonical_category": make_extracted("general"),
        "manufacturer_name": make_extracted("M"),
        "manufacturer_address": make_extracted("A"),
        "batch_number": make_extracted("B1"),
        "fssai": make_extracted("F1"),
        "country_of_origin": make_extracted(None, ExtractionStatus.NOT_FOUND),
        "import_status": make_extracted(None, ExtractionStatus.NOT_FOUND)
    }

def test_coo_domestic_not_applicable():
    fields_dict = get_base_fields()
    fields_dict["import_status"] = make_extracted("DOMESTIC")
    fields_dict["country_of_origin"] = make_extracted(None, ExtractionStatus.NOT_FOUND)
    norm_fields = NormalizedProductFields(**fields_dict)
    
    adapted = adapt_normalized_fields(norm_fields)
    rule_evals = evaluate_general_rules("general", adapted)
    coo_eval = next(r for r in rule_evals if r.rule_id == COUNTRY_OF_ORIGIN_RULE_ID)
    
    assert coo_eval.status == RuleStatus.NOT_APPLICABLE
    assert "NOT_APPLICABLE" in coo_eval.message

def test_coo_missing_unknown_needs_review():
    fields_dict = get_base_fields()
    fields_dict["import_status"] = make_extracted(None, ExtractionStatus.NOT_FOUND)
    norm_fields = NormalizedProductFields(**fields_dict)
    
    adapted = adapt_normalized_fields(norm_fields)
    rule_evals = evaluate_general_rules("general", adapted)
    coo_eval = next(r for r in rule_evals if r.rule_id == COUNTRY_OF_ORIGIN_RULE_ID)
    
    assert coo_eval.status == RuleStatus.NEEDS_REVIEW
    assert "import_status" in coo_eval.message.lower()

def test_coo_imported_found_pass():
    fields_dict = get_base_fields()
    fields_dict["import_status"] = make_extracted("IMPORTED")
    fields_dict["country_of_origin"] = make_extracted("USA", ExtractionStatus.FOUND)
    norm_fields = NormalizedProductFields(**fields_dict)
    
    adapted = adapt_normalized_fields(norm_fields)
    rule_evals = evaluate_general_rules("general", adapted)
    coo_eval = next(r for r in rule_evals if r.rule_id == COUNTRY_OF_ORIGIN_RULE_ID)
    
    assert coo_eval.status == RuleStatus.PASS

def test_coo_imported_not_found_violation():
    fields_dict = get_base_fields()
    fields_dict["import_status"] = make_extracted("IMPORTED")
    fields_dict["country_of_origin"] = make_extracted(None, ExtractionStatus.NOT_FOUND)
    norm_fields = NormalizedProductFields(**fields_dict)
    
    adapted = adapt_normalized_fields(norm_fields)
    rule_evals = evaluate_general_rules("general", adapted)
    coo_eval = next(r for r in rule_evals if r.rule_id == COUNTRY_OF_ORIGIN_RULE_ID)
    
    assert coo_eval.status == RuleStatus.VIOLATION
    assert "required for imported" in coo_eval.message.lower()

def test_coo_domestic_found_pass():
    fields_dict = get_base_fields()
    fields_dict["import_status"] = make_extracted("DOMESTIC")
    fields_dict["country_of_origin"] = make_extracted("India", ExtractionStatus.FOUND)
    norm_fields = NormalizedProductFields(**fields_dict)
    
    adapted = adapt_normalized_fields(norm_fields)
    rule_evals = evaluate_general_rules("general", adapted)
    coo_eval = next(r for r in rule_evals if r.rule_id == COUNTRY_OF_ORIGIN_RULE_ID)
    
    assert coo_eval.status == RuleStatus.PASS
    assert "found for domestic product" in coo_eval.message.lower()
