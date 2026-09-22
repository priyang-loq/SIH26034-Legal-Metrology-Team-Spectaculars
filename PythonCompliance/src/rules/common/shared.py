from src.extract.schema import ExtractionStatus
from src.rules.result import RuleStatus

def map_extraction_status_to_rule_status(status: ExtractionStatus, parse_succeeded: bool) -> RuleStatus:
    if status == ExtractionStatus.NOT_FOUND:
        return RuleStatus.VIOLATION
    if status in (ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS, ExtractionStatus.SOURCE_UNAVAILABLE):
        return RuleStatus.NEEDS_REVIEW
    if status == ExtractionStatus.FOUND:
        if not parse_succeeded:
            return RuleStatus.VIOLATION
        return RuleStatus.PASS
    # Default fallback
    return RuleStatus.NEEDS_REVIEW
