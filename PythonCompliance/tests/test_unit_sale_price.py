"""
tests/test_unit_sale_price.py

RED test suite for LMPC_6_11_USP — Unit Sale Price
Rule 6(11), Legal Metrology (Packaged Commodities) Amendment Rules, 2022
G.S.R. 226(E), dated 28 March 2022.

Architecture contract (mirrors test_country_of_origin.py exactly):
  1. Build raw ExtractedField objects.
  2. Wrap them in NormalizedProductFields.
  3. Call adapt_normalized_fields() -> produce the dict evaluate_general_rules() expects.
  4. Call evaluate_general_rules() and locate the RuleResult with rule_id == USP_RULE_ID.

All tests are RED because "unit_sale_price" is absent from every layer:
  - NormalizedProductFields has no unit_sale_price slot.
  - adapt_normalized_fields() does not emit a unit_sale_price key.
  - engine._RULE_IDS has no "unit_sale_price" entry.
  - engine.core_fields does not include "unit_sale_price".
  - No check_usp dispatch exists in the engine.

Failure mode (identical across all tests):
  StopIteration at:
      next(r for r in results if r.rule_id == USP_RULE_ID)
  The engine runs successfully but never emits a USP result.
  This is genuine missing production capability.

-------------------------------------------------------------------------------
LEGAL SOURCES
  Primary:  G.S.R. 226(E), Rule 6(11), Legal Metrology (PC) Amendment Rules 2022.
  Secondary: DoCA FAQ on Packaged Commodities Rules 2011 (official govt FAQ).
  FAQ guidance is explicitly labelled where it differs from or extends the statute.

MRP == USP SEMANTICS
  USP is a price-PER-UNIT-OF-MEASURE (e.g. Rs.0.30/g).
  MRP is the total retail price of the package (e.g. Rs.60 for 200 g).
  They are measured in different units and cannot be compared numerically.
  The correct package-level equality is:
    USP_numeric x net_qty_numeric == MRP_numeric
  i.e.  0.30 (Rs/g) x 200 (g) == 60 (Rs)
  When this equality holds, the declared USP implies the same sale price as MRP,
  so the USP declaration is not obligatory (Rule 6(11) proviso / DoCA FAQ Q4).

UNIT-THRESHOLD BOUNDARIES (exactly 1 kg / 1 L / 1 m)
  Rule 6(11) uses the phrasing "less than one kilogram" and "more than one kilogram".
  At exactly 1 kg the statute is silent; neither threshold clause applies literally.
  Until a competent authority clarifies the boundary, the safest result is NEEDS_REVIEW.
  Same reasoning applies to 1 litre and 1 metre.

-------------------------------------------------------------------------------
FUTURE PRODUCTION CALL SIGNATURE (documented here for GREEN phase)

  def check_usp(
      usp_field:     NormalizedField,    # unit_sale_price extraction result
      mrp_field:     NormalizedField,    # mrp — for MRP<=35 and package equality
      net_qty_field: NormalizedField,    # net_quantity — for threshold and equality
  ) -> RuleResult:

  Engine dispatch (mirrors check_country_of_origin precedent):
      elif field_id == "unit_sale_price":
          res = check_usp(
              field_data,
              normalized_fields.get("mrp"),
              normalized_fields.get("net_quantity"),
          )
"""

import pytest

from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import NormalizedProductFields, NormalizedField
from src.rules.engine import evaluate_general_rules, RuleStatus
from src.rules.adapters import adapt_normalized_fields

USP_RULE_ID = "LMPC_6_11_USP"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_extracted(val, status=ExtractionStatus.FOUND, confidence=0.9):
    return ExtractedField(
        extracted_value=val,
        status=status,
        extraction_confidence=confidence,
    )


def make_norm(extracted, norm_val=None, field_kind="generic"):
    return NormalizedField(field=extracted, normalized=norm_val, field_kind=field_kind)


def make_norm_mrp(numeric_str):
    """Build NormalizedField for mrp with a validated numeric value."""
    if numeric_str is None:
        return NormalizedField(
            field=make_extracted(None, ExtractionStatus.NOT_FOUND),
            normalized=None,
            field_kind="mrp",
        )
    raw = "Rs.{}".format(numeric_str)
    return NormalizedField(
        field=make_extracted(raw),
        normalized={
            "raw_value": raw,
            "numeric": float(numeric_str),
            "currency": "INR",
            "validation": "VALID",
            "notes": None,
        },
        field_kind="mrp",
    )


def make_norm_quantity(raw, numeric, canonical_unit, validation="VALID"):
    """Build NormalizedField for net_quantity with canonical numeric and unit."""
    if raw is None:
        return NormalizedField(
            field=make_extracted(None, ExtractionStatus.NOT_FOUND),
            normalized=None,
            field_kind="quantity",
        )
    return NormalizedField(
        field=make_extracted(raw),
        normalized={
            "raw_value": raw,
            "numeric": numeric,
            "canonical_unit": canonical_unit,
            "is_count": False,
            "validation": validation,
            "notes": None,
        },
        field_kind="quantity",
    )


def get_base_fields():
    """
    Minimum fields required by NormalizedProductFields.
    Default: MRP Rs.65, net quantity 200 g — no exemption applies.
    Mirrors get_base_fields() in test_country_of_origin.py.
    """
    return {
        "mrp":                make_norm_mrp("65.00"),
        "net_quantity":       make_norm_quantity("200g", 200.0, "g"),
        "manufacturing_date": make_norm(make_extracted("Jan 2024"), field_kind="date"),
        "expiry_date":        make_norm(make_extracted("Jan 2026"), field_kind="date"),
        "consumer_care_phone": make_norm(make_extracted("1800111111"), field_kind="phone"),
        "consumer_care_email": make_norm(make_extracted("care@brand.com"), field_kind="email"),
        "product_name":        make_extracted("Widget"),
        "category":            make_extracted("general"),
        "canonical_category":  make_extracted("general"),
        "manufacturer_name":   make_extracted("ABC Ltd."),
        "manufacturer_address": make_extracted("123, Delhi"),
        "batch_number":        make_extracted("B001"),
        "fssai":               make_extracted("12345678901234"),
        "country_of_origin":   make_extracted(None, ExtractionStatus.NOT_FOUND),
        "import_status":       make_extracted(None, ExtractionStatus.NOT_FOUND),
    }


def _run_and_get_usp(fields_dict):
    """
    Run the full production engine pipeline and return the USP RuleResult.

    RED failure: raises StopIteration because the engine never emits a result
    with rule_id == "LMPC_6_11_USP".  This is the missing-capability signal.
    """
    norm_fields = NormalizedProductFields(**fields_dict)
    adapted = adapt_normalized_fields(norm_fields)
    results = evaluate_general_rules("general", adapted)
    return next(r for r in results if r.rule_id == USP_RULE_ID)


# ===========================================================================
# Test A — Explicit valid USP → PASS
#
# net_quantity = 200 g   (< 1 kg → per-gram required by Rule 6(11)(i))
# MRP          = Rs.65
# USP declared = Rs.0.30/g
# USP x qty    = 0.30 x 200 = Rs.60 ≠ Rs.65  → MRP-equality exemption does NOT apply
# Unit matches requirement (g for <1 kg product)
# Legal expectation: PASS
# Future data: unit_sale_price extracted_value="Rs.0.30/g",
#              normalized={"numeric": 0.30, "canonical_unit": "g", "validation": "VALID"}
# ===========================================================================
def test_usp_explicit_valid_pass():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("65.00")
    fields["net_quantity"] = make_norm_quantity("200g", 200.0, "g")
    
    extracted = make_extracted("Rs.0.30/g")
    norm = {"numeric": 0.30, "canonical_unit": "g", "validation": "VALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.PASS


# ===========================================================================
# Test B — Applicable category + missing USP → VIOLATION
#
# No unit_sale_price found on the label.
# MRP = Rs.65 (> Rs.35, so FAQ exemption does not apply).
# No other exemption is determinable.
# Legal expectation: VIOLATION
# ===========================================================================
def test_usp_missing_violation():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("65.00")
    fields["net_quantity"] = make_norm_quantity("200g", 200.0, "g")
    
    extracted = make_extracted(None, ExtractionStatus.NOT_FOUND)
    fields["unit_sale_price"] = make_norm(extracted, None, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.VIOLATION


# ===========================================================================
# Test C — Malformed / ambiguous USP text → NEEDS_REVIEW
#
# OCR produces a price-like string that cannot be parsed to a numeric
# price-per-unit (e.g. "Rs.--/g", extraction_confidence < threshold).
# The engine cannot confirm compliance or violation.
# Legal expectation: NEEDS_REVIEW
# Future data: unit_sale_price extracted_value="Rs.--/g",
#              normalized={"numeric": None, "canonical_unit": "g", "validation": "INVALID"}
# ===========================================================================
def test_usp_ambiguous_needs_review():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("65.00")
    fields["net_quantity"] = make_norm_quantity("200g", 200.0, "g")
    
    extracted = make_extracted("Rs.--/g", ExtractionStatus.LOW_CONFIDENCE)
    norm = {"numeric": None, "canonical_unit": "g", "validation": "INVALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.NEEDS_REVIEW


# ===========================================================================
# Test D — MRP == USP (package-level equality) → NOT_APPLICABLE
#
# Rule 6(11) proviso / DoCA FAQ Q4:
#   When the unit sale price is equal to the retail sale price (MRP), declaring
#   USP separately is not required.
#
# CORRECT SEMANTICS:
#   USP is expressed per unit-of-measure (Rs./g, Rs./kg, …).
#   MRP is the total package price.
#   Equality must be tested at the package level:
#     USP_numeric x net_qty_numeric == MRP_numeric
#
# Example used here:
#   net_quantity = 200 g     (canonical_unit="g", numeric=200.0)
#   MRP          = Rs.60.00
#   USP declared = Rs.0.30/g
#   Package price implied by USP = 0.30 x 200 = Rs.60.00 == MRP
#   → Equality holds → NOT_APPLICABLE
#
# Legal expectation: NOT_APPLICABLE
# Future data: unit_sale_price extracted_value="Rs.0.30/g",
#              normalized={"numeric": 0.30, "canonical_unit": "g", "validation": "VALID"}
# ===========================================================================
def test_usp_mrp_equals_usp_package_price_not_applicable():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("60.00")           # total package price
    fields["net_quantity"] = make_norm_quantity("200g", 200.0, "g")
    
    extracted = make_extracted("Rs.0.30/g")
    norm = {"numeric": 0.30, "canonical_unit": "g", "validation": "VALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.NOT_APPLICABLE


# ===========================================================================
# Test E — net_quantity 200 g + USP declared per kg → VIOLATION
#
# Rule 6(11)(i): "price per gram if net quantity is less than one kilogram."
# 200 g < 1000 g → per-gram is mandatory.
# Declaring per kg is non-compliant. Determination is fully deterministic.
# Legal expectation: VIOLATION  (not NEEDS_REVIEW)
#
# Data contract the rule must check:
#   net_qty.normalized["canonical_unit"] == "g"
#   net_qty.normalized["numeric"]        == 200.0  (< 1000 → sub-1-kg)
#   usp.normalized["canonical_unit"]     == "kg"   ← mismatches per-gram requirement
# ===========================================================================
def test_usp_unit_mismatch_subkg_declared_perkg_violation():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("300.00")
    fields["net_quantity"] = make_norm_quantity("200g", 200.0, "g")
    
    extracted = make_extracted("Rs.1.50/kg")
    norm = {"numeric": 1.50, "canonical_unit": "kg", "validation": "VALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.VIOLATION


# ===========================================================================
# Test F (MRP exemption) — MRP ≤ Rs.35 → NOT_APPLICABLE
#
# SOURCE: DoCA official FAQ on Packaged Commodities Rules 2011, Q6.
# Note: this exemption is from the official DoCA FAQ guidance, not from the
# explicit wording of G.S.R. 226(E) itself. It is treated as authoritative
# government guidance but may differ from strict statutory text.
#
# Packages with MRP ≤ Rs.35 are not required to declare USP.
# The exemption check fires BEFORE testing for the presence/format of USP.
# Boundary value: MRP = Rs.35.00 (inclusive per FAQ wording "Rs.35 or less").
# Legal expectation: NOT_APPLICABLE
# ===========================================================================
def test_usp_mrp_lte_35_not_applicable():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("35.00")          # boundary — inclusive
    fields["net_quantity"] = make_norm_quantity("200g", 200.0, "g")
    
    extracted = make_extracted(None, ExtractionStatus.NOT_FOUND)
    fields["unit_sale_price"] = make_norm(extracted, None, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.NOT_APPLICABLE


# ===========================================================================
# Test G (boundary) — exactly 1 kg → NEEDS_REVIEW
#
# Rule 6(11) uses:
#   "less than one kilogram"  → per gram
#   "more than one kilogram"  → per kilogram
# At exactly 1 kg neither threshold clause applies literally.
# The statute does not specify the treatment for the boundary value.
# Until a competent authority (WLMD / court) clarifies, the engine cannot make
# a deterministic compliance decision.
# Legal expectation: NEEDS_REVIEW
#
# Note: if the legal source is later clarified (e.g. "≤1 kg → per gram"),
# this test must be updated to reflect the authoritative ruling.
# ===========================================================================
def test_usp_boundary_exactly_1kg_needs_review():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("200.00")
    # 1 kg → the normaliser converts to 1000 g (canonical unit = "g", numeric = 1000.0)
    fields["net_quantity"] = make_norm_quantity("1kg", 1000.0, "g")
    
    extracted = make_extracted("Rs.0.20/g")
    norm = {"numeric": 0.20, "canonical_unit": "g", "validation": "VALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.NEEDS_REVIEW


# ===========================================================================
# Test H (boundary) — exactly 1 litre → NEEDS_REVIEW
#
# Rule 6(11) uses:
#   "less than one litre"  → per millilitre
#   "more than one litre"  → per litre
# At exactly 1 litre neither clause applies literally.
# Legal expectation: NEEDS_REVIEW (same reasoning as 1 kg boundary)
# ===========================================================================
def test_usp_boundary_exactly_1L_needs_review():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("150.00")
    # 1 L → normaliser converts to 1000 ml (canonical unit = "ml", numeric = 1000.0)
    fields["net_quantity"] = make_norm_quantity("1L", 1000.0, "ml")
    
    extracted = make_extracted("Rs.0.15/ml")
    norm = {"numeric": 0.15, "canonical_unit": "ml", "validation": "VALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.NEEDS_REVIEW


# ===========================================================================
# Test I (boundary) — exactly 1 metre → NEEDS_REVIEW
#
# Rule 6(11) uses:
#   "less than one metre"  → per centimetre
#   "more than one metre"  → per metre
# At exactly 1 metre neither clause applies literally.
# NOTE: The current normalizer does not handle length units (cm, m).
# The extraction gap is therefore dual: no USP field AND no length quantity.
# Legal expectation: NEEDS_REVIEW (ambiguous boundary AND incomplete model)
# ===========================================================================
def test_usp_boundary_exactly_1m_needs_review():
    fields = get_base_fields()
    fields["mrp"]          = make_norm_mrp("120.00")
    # Length quantities are not yet normalised; we use a raw string with
    # canonical_unit="m" and numeric=1.0 to represent the future state.
    # The validation is UNCERTAIN because the normaliser does not parse metres.
    fields["net_quantity"] = make_norm_quantity("1m", 1.0, "m", "UNCERTAIN")
    
    extracted = make_extracted("Rs.1.20/cm")
    norm = {"numeric": 1.20, "canonical_unit": "cm", "validation": "VALID"}
    fields["unit_sale_price"] = make_norm(extracted, norm, "unit_sale_price")
    
    result = _run_and_get_usp(fields)
    assert result.status == RuleStatus.NEEDS_REVIEW
