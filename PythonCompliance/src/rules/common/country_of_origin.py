import logging
from src.rules.result import RuleResult, RuleStatus
from src.extract.schema import ExtractionStatus, ExtractedField

logger = logging.getLogger(__name__)

COUNTRY_OF_ORIGIN_RULE_ID = "LMPC_6_1_G"

def check_country_of_origin(coo_field_data: ExtractedField, import_status_data: ExtractedField) -> RuleResult:
    """
    Evaluates Country of Origin compliance.
    Requires import_status to determine applicability.
    """
    
    # Safely extract import_status
    if not import_status_data or not import_status_data.extracted_value:
        import_val = "UNKNOWN"
    else:
        import_val = str(import_status_data.extracted_value).upper().strip()
        if import_val == "NONE":
            import_val = "UNKNOWN"
            
    # Safely extract coo
    coo_status = coo_field_data.status if coo_field_data else ExtractionStatus.NOT_FOUND
    evidence = coo_field_data.evidence if coo_field_data else []
    
    if import_val == "UNKNOWN":
        return RuleResult(
            rule_id=COUNTRY_OF_ORIGIN_RULE_ID,
            field="country_of_origin",
            status=RuleStatus.NEEDS_REVIEW,
            message="Country of Origin review required because import_status is UNKNOWN or missing.",
            evidence=evidence,
            confidence=0.5
        )
        
    if import_val == "DOMESTIC":
        if coo_status == ExtractionStatus.FOUND:
            return RuleResult(
                rule_id=COUNTRY_OF_ORIGIN_RULE_ID,
                field="country_of_origin",
                status=RuleStatus.PASS,
                message="Country of Origin found for DOMESTIC product.",
                evidence=evidence,
                confidence=1.0
            )
        return RuleResult(
            rule_id=COUNTRY_OF_ORIGIN_RULE_ID,
            field="country_of_origin",
            status=RuleStatus.NOT_APPLICABLE,
            message="Country of Origin is NOT_APPLICABLE for DOMESTIC products.",
            evidence=[],
            confidence=1.0
        )
        
    if import_val == "IMPORTED":
        if coo_status == ExtractionStatus.FOUND:
            return RuleResult(
                rule_id=COUNTRY_OF_ORIGIN_RULE_ID,
                field="country_of_origin",
                status=RuleStatus.PASS,
                message="Country of Origin found for IMPORTED product.",
                evidence=evidence,
                confidence=1.0
            )
        else:
            return RuleResult(
                rule_id=COUNTRY_OF_ORIGIN_RULE_ID,
                field="country_of_origin",
                status=RuleStatus.VIOLATION,
                message="Country of Origin is required for IMPORTED products but was NOT_FOUND.",
                evidence=evidence,
                confidence=1.0
            )
            
    # Fallback
    return RuleResult(
        rule_id=COUNTRY_OF_ORIGIN_RULE_ID,
        field="country_of_origin",
        status=RuleStatus.NEEDS_REVIEW,
        message=f"Country of Origin review required due to unrecognized import_status: {import_val}",
        evidence=evidence,
        confidence=0.5
    )
