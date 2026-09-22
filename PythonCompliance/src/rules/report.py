from typing import List, Dict, Any
from src.rules.result import RuleResult, format_clause_citation
from src.rules.compliance import build_compliance_summary

def _format_result(r: RuleResult) -> Dict[str, Any]:
    evidence_formatted = [
        e.model_dump() if hasattr(e, 'model_dump') else e 
        for e in r.evidence
    ]
    return {
        "field": r.field,
        "rule_clause": format_clause_citation(r.rule_id),
        "message": r.message,
        "evidence": evidence_formatted,
        "confidence": r.confidence,
        "extracted_value": r.extracted_value,
        "original_value": r.original_value,
        "officer_override": r.officer_override,
    }

def build_evidence_report(
    product_id: str,
    category: str,
    results: List[RuleResult],
) -> Dict[str, Any]:
    
    summary_data = build_compliance_summary(results)
    
    passed_results = summary_data["passed"]
    violation_results = summary_data["violations"]
    needs_review_results = summary_data["needs_review"]
    na_results = summary_data["not_applicable"]
    
    total_checked = len(passed_results) + len(violation_results) + len(needs_review_results)
    
    violations_formatted = [_format_result(r) for r in violation_results]
    needs_review_formatted = [_format_result(r) for r in needs_review_results]
    
    passed_fields = [_format_result(r) for r in passed_results]
    na_fields = [_format_result(r) for r in na_results]
    
    return {
        "product_id": product_id,
        "category": category,
        "overall_decision": summary_data["decision"].value,
        "summary": {
            "total_fields_checked": total_checked,
            "passed": len(passed_results),
            "violations": len(violation_results),
            "needs_review": len(needs_review_results),
            "not_applicable": len(na_results),
        },
        "violations": violations_formatted,
        "needs_review": needs_review_formatted,
        "passed_fields": passed_fields,
        "not_applicable_fields": na_fields,
    }
