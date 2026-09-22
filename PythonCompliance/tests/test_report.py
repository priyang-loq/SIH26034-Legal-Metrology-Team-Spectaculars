import pytest
from src.rules.result import RuleResult, RuleStatus
from src.rules.compliance import decide_compliance
from src.rules.report import build_evidence_report

def make_result(rule_id: str, field: str, status: RuleStatus) -> RuleResult:
    return RuleResult(
        rule_id=rule_id,
        field=field,
        status=status,
        message="Test message",
        evidence=["test evidence"],
        confidence=1.0
    )

def test_build_evidence_report_mixed():
    results = [
        make_result("LMPC_6_1_A", "manufacturer_packer_importer", RuleStatus.PASS),
        make_result("LMPC_6_1_B", "common_name", RuleStatus.VIOLATION),
        make_result("LMPC_6_1_C", "net_quantity", RuleStatus.NEEDS_REVIEW),
        make_result("LMPC_6_1_D", "mfg_date", RuleStatus.NOT_APPLICABLE),
        make_result("LMPC_6_1_E", "mrp", RuleStatus.PASS)
    ]
    
    report = build_evidence_report("prod_123", "general", results)
    
    assert report["product_id"] == "prod_123"
    assert report["category"] == "general"
    assert report["overall_decision"] == decide_compliance(results).value
    
    summary = report["summary"]
    # 2 PASS + 1 VIOLATION + 1 NEEDS_REVIEW = 4
    assert summary["total_fields_checked"] == 4
    assert summary["passed"] == 2
    assert summary["violations"] == 1
    assert summary["needs_review"] == 1
    assert summary["not_applicable"] == 1
    
    # Violations
    assert len(report["violations"]) == 1
    vio = report["violations"][0]
    assert vio["field"] == "common_name"
    assert vio["rule_clause"] == "Rule 6(1)(b)"
    assert vio["message"] == "Test message"
    assert vio["evidence"] == ["test evidence"]
    assert vio["confidence"] == 1.0
    
    # Needs Review
    assert len(report["needs_review"]) == 1
    nr = report["needs_review"][0]
    assert nr["field"] == "net_quantity"
    assert nr["rule_clause"] == "Rule 6(1)(c)"
    
    # Passed/NA
    assert {f["field"] for f in report["passed_fields"]} == {"manufacturer_packer_importer", "mrp"}
    assert [f["field"] for f in report["not_applicable_fields"]] == ["mfg_date"]

def test_build_evidence_report_empty():
    report = build_evidence_report("prod_123", "food", [])
    
    assert report["overall_decision"] == decide_compliance([]).value
    assert report["summary"]["total_fields_checked"] == 0
    assert report["summary"]["passed"] == 0
    assert report["summary"]["violations"] == 0
    assert report["summary"]["needs_review"] == 0
    assert report["summary"]["not_applicable"] == 0
    
    assert report["violations"] == []
    assert report["needs_review"] == []
    assert report["passed_fields"] == []
    assert report["not_applicable_fields"] == []

def test_build_evidence_report_all_pass():
    results = [
        make_result("LMPC_6_1_A", "manufacturer_packer_importer", RuleStatus.PASS),
        make_result("LMPC_6_1_E", "mrp", RuleStatus.PASS)
    ]
    
    report = build_evidence_report("prod_123", "general", results)
    
    assert report["overall_decision"] == decide_compliance(results).value
    assert report["summary"]["total_fields_checked"] == 2
    assert report["violations"] == []
    assert report["needs_review"] == []
    assert {f["field"] for f in report["passed_fields"]} == {"manufacturer_packer_importer", "mrp"}
