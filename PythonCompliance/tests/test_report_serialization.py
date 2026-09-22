import json
import pytest
from src.rules.result import RuleResult, RuleStatus
from src.rules.report import build_evidence_report
from src.ocr.normalization import OCRText, BoundingBox

def test_report_serialization_with_ocr_evidence():
    # 1. Create a dummy OCRText instance representing the evidence
    bbox = BoundingBox(points=[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]])
    ocr_text = OCRText(text="Dummy Manufacturer", confidence=0.95, bbox=bbox)
    
    # 2. Create a RuleResult that includes the OCRText in its evidence
    result = RuleResult(
        rule_id="LMPC_6_1_A",
        field="manufacturer",
        status=RuleStatus.PASS,
        message="Found manufacturer",
        evidence=[ocr_text],
        confidence=0.95
    )
    
    # 3. Build the evidence report
    report = build_evidence_report(
        product_id="test_image.jpg",
        category="general",
        results=[result]
    )
    
    # 4. Attempt to serialize the report (This should fail if serialization is not handled)
    json_str = json.dumps(report, indent=4)
    
    # 5. Deserialize to prove data integrity is maintained
    parsed_report = json.loads(json_str)
    
    # Verify structure and contents
    assert parsed_report["product_id"] == "test_image.jpg"
    assert parsed_report["overall_decision"] == "COMPLIANT"
    
    # Check that the passed fields list includes manufacturer
    assert "manufacturer" in [f["field"] for f in parsed_report["passed_fields"]]
    
    # The summary passed count should be 1
    assert parsed_report["summary"]["passed"] == 1
    
    # Note: passed_fields in the report currently only lists field names,
    # it doesn't output the full result for passed items in the top-level report by default.
    # Wait, the bug was reported on `smoke_test_pipeline.py` when violations exist or needs_review.
    # Let's add a violation result so it's included in the formatted lists.
    
    violation_result = RuleResult(
        rule_id="LMPC_6_1_B",
        field="common_name",
        status=RuleStatus.VIOLATION,
        message="Missing common name",
        evidence=[ocr_text], # Adding evidence here to ensure it's formatted
        confidence=0.8
    )
    
    report_with_violation = build_evidence_report(
        product_id="test_image2.jpg",
        category="general",
        results=[result, violation_result]
    )
    
    json_str_violation = json.dumps(report_with_violation, indent=4)
    parsed_report_violation = json.loads(json_str_violation)
    
    # Verify the violation evidence was serialized correctly
    violations = parsed_report_violation["violations"]
    assert len(violations) == 1
    
    evidence_list = violations[0]["evidence"]
    assert len(evidence_list) == 1
    evidence_item = evidence_list[0]
    
    assert evidence_item["text"] == "Dummy Manufacturer"
    assert evidence_item["confidence"] == 0.95
    assert evidence_item["bbox"]["points"] == [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]]
