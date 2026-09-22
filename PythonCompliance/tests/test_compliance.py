import pytest
from src.rules.result import RuleResult, RuleStatus
from src.rules.compliance import extract_violations, decide_compliance, build_compliance_summary, ComplianceDecision

def make_result(status: RuleStatus) -> RuleResult:
    return RuleResult(
        rule_id="TEST",
        field="test_field",
        status=status,
        message="",
        evidence=[],
        confidence=1.0
    )

def test_extract_violations():
    results = [
        make_result(RuleStatus.PASS),
        make_result(RuleStatus.VIOLATION),
        make_result(RuleStatus.NEEDS_REVIEW),
        make_result(RuleStatus.VIOLATION)
    ]
    violations = extract_violations(results)
    assert len(violations) == 2
    assert all(r.status == RuleStatus.VIOLATION for r in violations)
    
    no_violations = extract_violations([make_result(RuleStatus.PASS)])
    assert len(no_violations) == 0

def test_decide_compliance():
    # all-PASS -> COMPLIANT
    assert decide_compliance([make_result(RuleStatus.PASS), make_result(RuleStatus.PASS)]) == ComplianceDecision.COMPLIANT
    
    # one VIOLATION among mixed -> NON_COMPLIANT
    mixed = [make_result(RuleStatus.PASS), make_result(RuleStatus.VIOLATION), make_result(RuleStatus.NEEDS_REVIEW)]
    assert decide_compliance(mixed) == ComplianceDecision.NON_COMPLIANT
    
    # NEEDS_REVIEW present with no VIOLATION -> NEEDS_REVIEW
    mixed_no_vio = [make_result(RuleStatus.PASS), make_result(RuleStatus.NEEDS_REVIEW)]
    assert decide_compliance(mixed_no_vio) == ComplianceDecision.NEEDS_REVIEW
    
    # empty list -> NEEDS_REVIEW (not COMPLIANT)
    assert decide_compliance([]) == ComplianceDecision.NEEDS_REVIEW
    
    # all-NOT_APPLICABLE -> COMPLIANT
    assert decide_compliance([make_result(RuleStatus.NOT_APPLICABLE), make_result(RuleStatus.NOT_APPLICABLE)]) == ComplianceDecision.COMPLIANT

def test_build_compliance_summary():
    results = [
        make_result(RuleStatus.PASS),
        make_result(RuleStatus.VIOLATION),
        make_result(RuleStatus.NEEDS_REVIEW),
        make_result(RuleStatus.NOT_APPLICABLE),
        make_result(RuleStatus.PASS)
    ]
    summary = build_compliance_summary(results)
    assert summary["decision"] == ComplianceDecision.NON_COMPLIANT
    assert len(summary["violations"]) == 1
    assert len(summary["needs_review"]) == 1
    assert len(summary["passed"]) == 2
    assert len(summary["not_applicable"]) == 1
