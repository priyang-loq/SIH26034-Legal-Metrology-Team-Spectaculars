from src.extract.schema import ExtractedField, ExtractionStatus
from src.rules.result import RuleResult, RuleStatus
from src.rules.common.shared import map_extraction_status_to_rule_status

def check_manufacturer(field: ExtractedField) -> RuleResult:
    parse_succeeded = False
    if field.status == ExtractionStatus.FOUND and field.extracted_value and field.extracted_value.strip():
        parse_succeeded = True
        
    status = map_extraction_status_to_rule_status(field.status, parse_succeeded)
    
    if status == RuleStatus.VIOLATION:
        if field.status == ExtractionStatus.NOT_FOUND:
            message = "Manufacturer/packer/importer declaration is missing."
        else:
            message = "Manufacturer/packer/importer is present but unparseable."
    elif status == RuleStatus.PASS:
        message = "Manufacturer/packer/importer is present and valid."
    elif field.status == ExtractionStatus.SOURCE_UNAVAILABLE:
        message = "Could not be verified — AI analysis was unavailable for this scan, manual review recommended."
    else:
        message = "Manufacturer/packer/importer needs review."
        
    return RuleResult(
        rule_id="LMPC_6_1_A",
        field="manufacturer",
        status=status,
        message=message,
        evidence=field.evidence,
        confidence=field.extraction_confidence
    )
