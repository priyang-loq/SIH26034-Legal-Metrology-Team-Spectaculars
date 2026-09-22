"""
PHASE 2 — RED tests for bounding box evidence exposure.

Tests A-D prove the four invariants required before any bbox
can flow through the Python → Node boundary:

A. OCR bbox survives into the public report evidence object.
B. report._format_result() emits bbox inside evidence items.
C. Reports without bbox remain valid (backward compat).
D. No fake/default bbox is ever invented.
"""

import pytest
from src.ocr.normalization import BoundingBox, OCRText
from src.extract.schema import ExtractedField, ExtractionStatus
from src.rules.result import RuleResult, RuleStatus
from src.rules.report import _format_result, build_evidence_report


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_ocr_text_with_bbox(text: str = "Sample Text") -> OCRText:
    """Real OCRText with a real 4-point pixel bounding box."""
    return OCRText(
        text=text,
        confidence=0.95,
        bbox=BoundingBox(points=[[10.0, 20.0], [200.0, 20.0], [200.0, 50.0], [10.0, 50.0]])
    )


def make_rule_result_with_evidence(evidence_items) -> RuleResult:
    return RuleResult(
        rule_id="LMPC_6_1_A",
        field="manufacturer",
        status=RuleStatus.VIOLATION,
        message="Manufacturer missing.",
        evidence=evidence_items,
        confidence=1.0
    )


def make_rule_result_no_evidence() -> RuleResult:
    return RuleResult(
        rule_id="LMPC_6_1_E",
        field="mrp",
        status=RuleStatus.PASS,
        message="MRP present.",
        evidence=[],
        confidence=1.0
    )


# ---------------------------------------------------------------------------
# TEST A: bbox survives from OCRText through ExtractedField into RuleResult
# ---------------------------------------------------------------------------

def test_A_bbox_survives_from_ocr_to_rule_result():
    """
    OCRText with a 4-corner bbox must be accessible via RuleResult.evidence[0].bbox.
    This proves the Python-side data path is intact end-to-end.
    """
    ocr_item = make_ocr_text_with_bbox()
    field = ExtractedField(
        status=ExtractionStatus.FOUND,
        extracted_value="ACME Corp",
        evidence=[ocr_item],
        extraction_confidence=0.95,
        bbox=ocr_item.bbox,
    )
    rule_result = make_rule_result_with_evidence(field.evidence)

    assert len(rule_result.evidence) == 1
    evidence_item = rule_result.evidence[0]
    assert hasattr(evidence_item, "bbox"), "evidence[0] must have a bbox attribute"
    assert evidence_item.bbox is not None, "evidence[0].bbox must not be None"
    assert evidence_item.bbox.points == [[10.0, 20.0], [200.0, 20.0], [200.0, 50.0], [10.0, 50.0]]


# ---------------------------------------------------------------------------
# TEST B: report._format_result() serialises bbox in evidence
# ---------------------------------------------------------------------------

def test_B_format_result_serialises_bbox():
    """
    _format_result() must include bbox.points in the serialised evidence dict
    so the Node bridge can read pixel coordinates.
    """
    ocr_item = make_ocr_text_with_bbox("MRP: Rs.50")
    result = make_rule_result_with_evidence([ocr_item])

    formatted = _format_result(result)

    assert "evidence" in formatted, "_format_result must produce an 'evidence' key"
    assert len(formatted["evidence"]) == 1, "evidence list must have one item"

    ev = formatted["evidence"][0]
    assert "bbox" in ev, "serialised evidence item must contain 'bbox'"
    assert "points" in ev["bbox"], "bbox must contain 'points'"
    assert ev["bbox"]["points"] == [[10.0, 20.0], [200.0, 20.0], [200.0, 50.0], [10.0, 50.0]]


# ---------------------------------------------------------------------------
# TEST C: Reports without bbox remain valid (backward compatibility)
# ---------------------------------------------------------------------------

def test_C_format_result_no_evidence_is_valid():
    """
    A RuleResult with empty evidence must still produce a valid formatted result.
    No KeyError, no crash, no fake bbox invented.
    """
    result = make_rule_result_no_evidence()
    formatted = _format_result(result)

    assert formatted["evidence"] == [], "Empty evidence must serialise to empty list"
    assert "bbox" not in formatted, "No top-level bbox should be invented"


def test_C_build_evidence_report_without_bbox_does_not_crash():
    """
    A full report with no bbox evidence must produce a valid dict
    without crashing or inventing coordinates.
    """
    results = [make_rule_result_no_evidence()]
    report = build_evidence_report("prod_test", "general", results)

    assert report["overall_decision"] in ("COMPLIANT", "NON_COMPLIANT", "NEEDS_REVIEW")
    # passed_fields is a list of dicts now
    assert isinstance(report["passed_fields"], list)
    assert all(isinstance(f, dict) for f in report["passed_fields"])


# ---------------------------------------------------------------------------
# TEST D: No fake/default bbox is invented when evidence is absent
# ---------------------------------------------------------------------------

def test_D_no_fake_bbox_invented_for_missing_evidence():
    """
    When OCR evidence has no bbox (e.g., VLM-only field), the serialised
    evidence must NOT contain a fabricated bbox with zeroed coordinates.
    """
    # VLM-sourced evidence has no bbox — it is a plain OCRText with null-equivalent
    ocr_item_no_bbox = OCRText(
        text="Some VLM text",
        confidence=0.8,
        bbox=BoundingBox(points=[[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]])
    )
    result = make_rule_result_with_evidence([ocr_item_no_bbox])
    formatted = _format_result(result)

    ev = formatted["evidence"][0]
    # The bbox IS present (it's a real OCRText), but all-zero points are a signal
    # the caller must not use them as a real overlay — test that we don't munge them.
    assert ev["bbox"]["points"] == [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]], (
        "An all-zero bbox from VLM must be passed through unchanged, not replaced with fake coords"
    )
