from src.normalize.normalizer import NormalizedField
from src.rules.result import RuleResult, RuleStatus
from src.rules.common.shared import map_extraction_status_to_rule_status
from src.extract.schema import ExtractionStatus

def check_mrp(field: NormalizedField) -> RuleResult:
    parse_succeeded = False
    if field.normalized and field.normalized.get("validation") == "VALID":
        parse_succeeded = True
        
    status = map_extraction_status_to_rule_status(field.field.status, parse_succeeded)
    
    if status == RuleStatus.PASS:
        numeric = field.normalized.get("numeric")
        if numeric is None or numeric <= 0:
            status = RuleStatus.VIOLATION
            
    if status == RuleStatus.VIOLATION:
        if field.field.status == ExtractionStatus.NOT_FOUND:
            message = "MRP declaration is missing."
        else:
            message = "MRP is present but unparseable or invalid."
    elif status == RuleStatus.PASS:
        message = "MRP is present and valid."
    elif field.field.status == ExtractionStatus.SOURCE_UNAVAILABLE:
        message = "Could not be verified — AI analysis was unavailable for this scan, manual review recommended."
    else:
        message = "MRP needs review."
        
    return RuleResult(
        rule_id="LMPC_6_1_E",
        field="mrp",
        status=status,
        message=message,
        evidence=field.field.evidence,
        confidence=field.field.extraction_confidence
    )
