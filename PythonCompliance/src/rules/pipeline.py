from src.normalize.normalizer import NormalizedProductFields
from src.rules.adapters import adapt_normalized_fields
from src.rules.engine import evaluate_general_rules
from src.rules.report import build_evidence_report

def run_compliance_pipeline(
    product_id: str,
    normalized_fields: NormalizedProductFields,
    category: str,
    sub_category: str | None = None,
    is_apm: bool | None = None,
    warnings: list[str] | None = None,
    is_low_confidence: bool = False,
) -> dict:
    # 1. Adapt fields
    engine_fields = adapt_normalized_fields(normalized_fields)
    
    # 2. Run engine
    results = evaluate_general_rules(
        category=category,
        normalized_fields=engine_fields,
        sub_category=sub_category,
        is_apm=is_apm,
        is_low_confidence=is_low_confidence
    )
    
    # 3. Build report
    report = build_evidence_report(
        product_id=product_id,
        category=category,
        results=results
    )
    
    report["warnings"] = warnings or []
    if report["warnings"] and report["overall_decision"] == "COMPLIANT" and "AI_UNAVAILABLE" in report["warnings"]:
        report["overall_decision"] = "NEEDS_REVIEW"
        
    return report
