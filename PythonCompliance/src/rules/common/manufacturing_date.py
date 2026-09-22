from src.normalize.normalizer import NormalizedField
from src.rules.result import RuleResult, RuleStatus
from src.rules.common.shared import map_extraction_status_to_rule_status
from src.extract.schema import ExtractionStatus

def check_manufacturing_date(field: NormalizedField) -> RuleResult:
    parse_succeeded = False
    if field.normalized and field.normalized.get("validation") == "VALID":
        parse_succeeded = True
    elif (not field.normalized or field.normalized.get("validation") != "VALID") and field.field.extracted_value:
        from src.normalize.normalizer import normalize_date
        renorm = normalize_date(field.field)
        if renorm.normalized and renorm.normalized.get("validation") == "VALID":
            parse_succeeded = True
            field.normalized = renorm.normalized
        
    status = map_extraction_status_to_rule_status(field.field.status, parse_succeeded)
    
    if status == RuleStatus.VIOLATION:
        if field.field.status == ExtractionStatus.NOT_FOUND:
            message = "Manufacturing date declaration is missing."
        else:
            message = "Manufacturing date is present but unparseable/invalid."
    elif status == RuleStatus.PASS:
        message = "Manufacturing date is present and valid."
    elif field.field.status == ExtractionStatus.SOURCE_UNAVAILABLE:
        message = "Could not be verified — AI analysis was unavailable for this scan, manual review recommended."
    else:
        message = "Manufacturing date needs review."
        
    return RuleResult(
        rule_id="LMPC_6_1_D",
        field="mfg_date",
        status=status,
        message=message,
        evidence=field.field.evidence,
        confidence=field.field.extraction_confidence
    )
