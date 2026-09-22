from src.normalize.normalizer import NormalizedField
from src.rules.result import RuleResult, RuleStatus
from src.extract.schema import ExtractionStatus
from typing import Optional

def check_consumer_care(phone: Optional[NormalizedField] = None, email: Optional[NormalizedField] = None) -> RuleResult:
    # PROVISIONAL DECISION pending Joyshree's confirmation on whether all sub-parts
    # should be required. Currently passing if any identifiable contact detail is present.
    # limitation: checking phone/email only is correct and satisfies the "any identifiable 
    # contact detail" decision, since name/address don't survive normalization.
    
    has_phone = phone and phone.field.status == ExtractionStatus.FOUND and phone.normalized and phone.normalized.get("validation") == "VALID"
    has_email = email and email.field.status == ExtractionStatus.FOUND and email.normalized and email.normalized.get("validation") == "VALID"
    
    is_phone_found = phone and phone.field.status == ExtractionStatus.FOUND
    is_email_found = email and email.field.status == ExtractionStatus.FOUND
    
    is_phone_low_conf = phone and phone.field.status in (ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS)
    is_email_low_conf = email and email.field.status in (ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS)
    
    if has_phone or has_email:
        status = RuleStatus.PASS
        message = "Consumer care details are present and valid."
    elif is_phone_found or is_email_found:
        status = RuleStatus.VIOLATION
        message = "Consumer care details are present but unparseable/invalid."
    elif is_phone_low_conf or is_email_low_conf:
        status = RuleStatus.NEEDS_REVIEW
        message = "Consumer care details need review."
    elif (phone and phone.field.status == ExtractionStatus.SOURCE_UNAVAILABLE) or (email and email.field.status == ExtractionStatus.SOURCE_UNAVAILABLE):
        status = RuleStatus.NEEDS_REVIEW
        message = "Could not be verified — AI analysis was unavailable for this scan, manual review recommended."
    else:
        status = RuleStatus.VIOLATION
        message = "Consumer care details are missing."
        
    evidence = []
    confidence = 0.0
    if phone:
        evidence.extend(phone.field.evidence)
        confidence = max(confidence, phone.field.extraction_confidence)
    if email:
        evidence.extend(email.field.evidence)
        if email.field.extraction_confidence > confidence:
            confidence = email.field.extraction_confidence
            
    return RuleResult(
        rule_id="LMPC_6_2",
        field="consumer_care",
        status=status,
        message=message,
        evidence=evidence,
        confidence=confidence
    )
