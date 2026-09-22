from enum import Enum
from typing import List, Dict, Any
from src.rules.result import RuleResult, RuleStatus

class ComplianceDecision(str, Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    NEEDS_REVIEW = "NEEDS_REVIEW"

def extract_violations(results: List[RuleResult]) -> List[RuleResult]:
    return [r for r in results if r.status == RuleStatus.VIOLATION]

def decide_compliance(results: List[RuleResult]) -> ComplianceDecision:
    if not results:
        return ComplianceDecision.NEEDS_REVIEW
        
    has_violation = False
    has_needs_review = False
    
    for r in results:
        if r.status == RuleStatus.VIOLATION:
            has_violation = True
        elif r.status == RuleStatus.NEEDS_REVIEW:
            has_needs_review = True
            
    if has_violation:
        return ComplianceDecision.NON_COMPLIANT
    if has_needs_review:
        return ComplianceDecision.NEEDS_REVIEW
        
    return ComplianceDecision.COMPLIANT

def build_compliance_summary(results: List[RuleResult]) -> Dict[str, Any]:
    decision = decide_compliance(results)
    
    violations = []
    needs_review = []
    passed = []
    not_applicable = []
    
    for r in results:
        if r.status == RuleStatus.VIOLATION:
            violations.append(r)
        elif r.status == RuleStatus.NEEDS_REVIEW:
            needs_review.append(r)
        elif r.status == RuleStatus.PASS:
            passed.append(r)
        elif r.status == RuleStatus.NOT_APPLICABLE:
            not_applicable.append(r)
            
    return {
        "decision": decision,
        "violations": violations,
        "needs_review": needs_review,
        "passed": passed,
        "not_applicable": not_applicable
    }
