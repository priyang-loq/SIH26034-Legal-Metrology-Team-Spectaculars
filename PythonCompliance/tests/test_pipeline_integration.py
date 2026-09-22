import pytest
from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import (
    NormalizedProductFields, NormalizedField, NormalizedMRP,
    NormalizedQuantity, NormalizedDate, NormalizedPhone, NormalizedEmail, ValidationStatus
)
from src.rules.pipeline import run_compliance_pipeline

def make_extracted(val, status=ExtractionStatus.FOUND):
    return ExtractedField(
        extracted_value=val,
        status=status,
        extraction_confidence=0.9,
        evidence=[]
    )

def make_norm_field(ext, norm_val, field_kind):
    return NormalizedField(
        field=ext,
        normalized=norm_val,
        field_kind=field_kind
    )

@pytest.fixture
def base_fields():
    return NormalizedProductFields(
        mrp=make_norm_field(make_extracted("100"), NormalizedMRP(raw_value="100", numeric=100.0, validation=ValidationStatus.VALID).model_dump(), "mrp"),
        net_quantity=make_norm_field(make_extracted("500g"), NormalizedQuantity(raw_value="500g", numeric=500.0, canonical_unit="g", validation=ValidationStatus.VALID).model_dump(), "quantity"),
        manufacturing_date=make_norm_field(make_extracted("Jan 2024"), NormalizedDate(raw_value="Jan 2024", month=1, year=2024, validation=ValidationStatus.VALID).model_dump(), "date"),
        expiry_date=make_norm_field(make_extracted("Jan 2025"), NormalizedDate(raw_value="Jan 2025", month=1, year=2025, validation=ValidationStatus.VALID).model_dump(), "date"),
        consumer_care_phone=make_norm_field(make_extracted("1234567890"), NormalizedPhone(raw_value="1234567890", digits_only="1234567890", validation=ValidationStatus.VALID).model_dump(), "phone"),
        consumer_care_email=make_norm_field(make_extracted("a@b.com"), NormalizedEmail(raw_value="a@b.com", lower="a@b.com", validation=ValidationStatus.VALID).model_dump(), "email"),
        product_name=make_extracted("Test Product"),
        category=make_extracted("general"),
        canonical_category=make_extracted(None, ExtractionStatus.NOT_FOUND),
        manufacturer_name=make_extracted("Test Co"),
        manufacturer_address=make_extracted("Test Address"),
        batch_number=make_extracted("B1"),
        fssai=make_extracted("10012022000264"),
        country_of_origin=make_extracted("India"),
        import_status=make_extracted("DOMESTIC"),
        unit_sale_price=make_norm_field(make_extracted("0.20/g"), {"numeric": 0.20, "canonical_unit": "g", "validation": "VALID"}, "unit_sale_price")
    )

def test_pipeline_general_compliant(base_fields):
    report = run_compliance_pipeline("prod_1", base_fields, "general")
    assert report["overall_decision"] == "COMPLIANT"

def test_pipeline_general_non_compliant(base_fields):
    # Make product name NOT_FOUND
    base_fields.product_name = make_extracted(None, status=ExtractionStatus.NOT_FOUND)
    report = run_compliance_pipeline("prod_2", base_fields, "general")
    assert report["overall_decision"] == "NON_COMPLIANT"
    
    # Verify violation citation
    assert len(report["violations"]) == 1
    vio = report["violations"][0]
    assert vio["field"] == "common_name"
    assert "Rule 6" in vio["rule_clause"]
    assert "missing" in vio["message"].lower()

def test_pipeline_cosmetic_mrp_exempt(base_fields):
    # MRP is present in fixture, but cosmetic should exempt it
    report = run_compliance_pipeline("prod_3", base_fields, "cosmetic", sub_category=None)
    assert report["overall_decision"] == "COMPLIANT"
    assert "mrp" in [f["field"] for f in report["not_applicable_fields"]]

def test_pipeline_food_short_circuit(base_fields):
    report = run_compliance_pipeline("prod_4", base_fields, "food", sub_category=None)
    assert report["overall_decision"] == "COMPLIANT"
    assert report["summary"]["total_fields_checked"] == 0
    assert report["summary"]["not_applicable"] == 8
    assert len(report["not_applicable_fields"]) == 8
    assert report["violations"] == []
    assert report["needs_review"] == []

def test_pipeline_food_low_confidence_fallback(base_fields):
    """FOOD with LOW_CONFIDENCE: Must fall back to general rules and check all core fields, NOT mark them all NOT_APPLICABLE."""
    report = run_compliance_pipeline("prod_low_conf", base_fields, "food", is_low_confidence=True)
    assert report["overall_decision"] == "COMPLIANT"  # base_fields has valid data
    assert report["summary"]["total_fields_checked"] > 0
    assert "mrp" not in [f["field"] for f in report["not_applicable_fields"]]
    assert "net_quantity" not in [f["field"] for f in report["not_applicable_fields"]]


def test_pipeline_lpg_apm_none(base_fields):
    report = run_compliance_pipeline("prod_5", base_fields, "lpg_cylinder", sub_category=None, is_apm=None)
    print(report)
    assert report["overall_decision"] == "NEEDS_REVIEW"
    
    nr_fields = [r["field"] for r in report["needs_review"]]
    assert "mrp" in nr_fields
    mrp_nr = next(r for r in report["needs_review"] if r["field"] == "mrp")
    assert "unknown" in mrp_nr["message"].lower()


# ---------------------------------------------------------------------------
# Phase 2B: additional integration coverage
# ---------------------------------------------------------------------------

def test_pipeline_alcohol_mrp_not_applicable(base_fields):
    """ALCOHOL: MRP must be NOT_APPLICABLE; all other applicable fields checked."""
    report = run_compliance_pipeline("prod_6", base_fields, "alcohol", sub_category=None)
    # MRP is EXEMPT for alcohol — must appear in not_applicable_fields
    assert "mrp" in [f["field"] for f in report["not_applicable_fields"]]
    # MRP must not be flagged as a violation or needs_review
    violation_fields = [v["field"] for v in report["violations"]]
    nr_fields = [r["field"] for r in report["needs_review"]]
    assert "mrp" not in violation_fields
    assert "mrp" not in nr_fields
    # Remaining applicable fields were evaluated — fixture has valid data, so no violations
    assert report["overall_decision"] == "COMPLIANT"
    # total_fields_checked reflects only evaluated (non-exempt) fields
    assert report["summary"]["not_applicable"] >= 1


def test_pipeline_bidi_mrp_and_mfgdate_not_applicable(base_fields):
    """BIDI: both MRP and mfg_date must be NOT_APPLICABLE (both are EXEMPT for bidi)."""
    report = run_compliance_pipeline("prod_7", base_fields, "bidi_incense", sub_category="bidi")
    na = [f["field"] for f in report["not_applicable_fields"]]
    assert "mrp" in na, f"mrp should be NOT_APPLICABLE for bidi, got not_applicable_fields={na}"
    assert "mfg_date" in na, f"mfg_date should be NOT_APPLICABLE for bidi, got not_applicable_fields={na}"
    # Neither should appear in violations or needs_review
    violation_fields = [v["field"] for v in report["violations"]]
    nr_fields = [r["field"] for r in report["needs_review"]]
    assert "mrp" not in violation_fields
    assert "mrp" not in nr_fields
    assert "mfg_date" not in violation_fields
    assert "mfg_date" not in nr_fields
    # Fixture has valid data for remaining fields -> COMPLIANT
    assert report["overall_decision"] == "COMPLIANT"


def test_pipeline_incense_mfgdate_not_applicable_mrp_applicable(base_fields):
    """INCENSE: mfg_date must be NOT_APPLICABLE; MRP must remain applicable and evaluated."""
    report = run_compliance_pipeline("prod_8", base_fields, "bidi_incense", sub_category="incense")
    na = [f["field"] for f in report["not_applicable_fields"]]
    assert "mfg_date" in na, f"mfg_date should be NOT_APPLICABLE for incense, got not_applicable_fields={na}"
    # MRP must NOT appear in not_applicable_fields
    assert "mrp" not in na, f"mrp should be applicable for incense (not exempt), got not_applicable_fields={na}"
    # MRP should be evaluated — fixture has valid MRP -> appears in passed_fields
    assert "mrp" in [f["field"] for f in report["passed_fields"]], f"mrp should pass for incense with valid fixture, got passed_fields={report['passed_fields']}"
    assert report["overall_decision"] == "COMPLIANT"


def test_pipeline_lpg_apm_true_mrp_and_mfgdate_not_applicable(base_fields):
    """LPG APM=True: both MRP and mfg_date must be NOT_APPLICABLE (both EXEMPT)."""
    report = run_compliance_pipeline("prod_9", base_fields, "lpg_cylinder", sub_category=None, is_apm=True)
    na = [f["field"] for f in report["not_applicable_fields"]]
    assert "mrp" in na, f"mrp should be NOT_APPLICABLE for LPG APM=True, got not_applicable_fields={na}"
    assert "mfg_date" in na, f"mfg_date should be NOT_APPLICABLE for LPG APM=True, got not_applicable_fields={na}"
    violation_fields = [v["field"] for v in report["violations"]]
    nr_fields = [r["field"] for r in report["needs_review"]]
    assert "mrp" not in violation_fields
    assert "mrp" not in nr_fields
    assert "mfg_date" not in violation_fields
    assert "mfg_date" not in nr_fields
    assert report["overall_decision"] == "COMPLIANT"


def test_pipeline_lpg_apm_false_mfgdate_not_applicable_mrp_applicable(base_fields):
    """LPG APM=False: mfg_date NOT_APPLICABLE; MRP remains applicable and evaluated."""
    report = run_compliance_pipeline("prod_10", base_fields, "lpg_cylinder", sub_category=None, is_apm=False)
    na = [f["field"] for f in report["not_applicable_fields"]]
    assert "mfg_date" in na, f"mfg_date should be NOT_APPLICABLE for LPG APM=False, got not_applicable_fields={na}"
    assert "mrp" not in na, f"mrp should be applicable for LPG APM=False, got not_applicable_fields={na}"
    # MRP fixture is valid -> should pass
    assert "mrp" in [f["field"] for f in report["passed_fields"]], f"mrp should pass for LPG APM=False with valid fixture, got passed_fields={report['passed_fields']}"
    assert report["overall_decision"] == "COMPLIANT"

