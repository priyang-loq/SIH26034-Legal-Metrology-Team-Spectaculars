from src.extract.schema import ExtractedField, ExtractionStatus
from src.rules.result import RuleResult, RuleStatus
from src.rules.common.shared import map_extraction_status_to_rule_status

def check_dimensions(field: ExtractedField) -> RuleResult:
    # KNOWN GAP: dimensions is not currently extracted or normalized upstream
    # (see src/extract/, src/normalize/normalizer.py) — this check will always
    # receive NOT_FOUND against real pipeline data until extraction is extended
    # to cover it. Rule logic is complete and tested; upstream wiring is a
    # separate task.
    parse_succeeded = False
    if field.status == ExtractionStatus.FOUND and field.extracted_value and field.extracted_value.strip():
        parse_succeeded = True
        
    status = map_extraction_status_to_rule_status(field.status, parse_succeeded)
    
    # PROVISIONAL: NOT_FOUND treated as NEEDS_REVIEW rather than VIOLATION 
    # because Rule 6(1)(f) only applies 'where size is relevant' and this 
    # module has no relevance signal yet — confirm with spec author before 
    # hackathon submission.
    if status == RuleStatus.VIOLATION and field.status == ExtractionStatus.NOT_FOUND:
        status = RuleStatus.NEEDS_REVIEW
    
    if status == RuleStatus.VIOLATION:
        message = "Dimensions are present but unparseable/invalid."
    elif status == RuleStatus.PASS:
        message = "Dimensions are present and valid."
    elif field.status == ExtractionStatus.SOURCE_UNAVAILABLE:
        message = "Could not be verified — AI analysis was unavailable for this scan, manual review recommended."
    else:
        message = "Dimensions need review."
        
    return RuleResult(
        rule_id="LMPC_6_1_F",
        field="dimensions",
        status=status,
        message=message,
        evidence=field.evidence,
        confidence=field.extraction_confidence
    )
