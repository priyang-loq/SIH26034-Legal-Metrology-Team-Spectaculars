from typing import Optional
from src.rules.result import RuleResult, RuleStatus
from src.normalize.normalizer import NormalizedField
from src.extract.schema import ExtractionStatus

USP_RULE_ID = "LMPC_6_11_USP"

def check_usp(
    usp_field: NormalizedField,
    mrp_field: Optional[NormalizedField],
    net_qty_field: Optional[NormalizedField],
) -> RuleResult:
    # Safely extract
    usp_status = usp_field.field.status if usp_field else ExtractionStatus.NOT_FOUND
    evidence = usp_field.field.evidence if usp_field else []
    
    # 1. Determine context sufficient
    if not mrp_field or mrp_field.field.status not in (ExtractionStatus.FOUND, ExtractionStatus.LOW_CONFIDENCE):
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message="Unit Sale Price review required because MRP is not reliably extracted.",
            evidence=evidence,
            confidence=0.5
        )
        
    if not net_qty_field or net_qty_field.field.status not in (ExtractionStatus.FOUND, ExtractionStatus.LOW_CONFIDENCE):
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message="Unit Sale Price review required because Net Quantity is not reliably extracted.",
            evidence=evidence,
            confidence=0.5
        )
        
    # Validation state of context
    mrp_norm = mrp_field.normalized if mrp_field.normalized else {}
    qty_norm = net_qty_field.normalized if net_qty_field.normalized else {}
    
    mrp_val = mrp_norm.get("numeric")
    qty_val = qty_norm.get("numeric")
    qty_unit = qty_norm.get("canonical_unit")
    
    if mrp_val is None or qty_val is None or qty_unit is None:
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message="Unit Sale Price review required due to unparseable MRP or Net Quantity.",
            evidence=evidence,
            confidence=0.5
        )

    # 3. MRP <= 35
    if mrp_val <= 35.00:
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NOT_APPLICABLE,
            message="Unit Sale Price is NOT_APPLICABLE. Source: DoCA official FAQ Q6 (Packages with MRP <= Rs.35).",
            evidence=evidence,
            confidence=1.0
        )
        
    # 2. Check extraction status
    if usp_status == ExtractionStatus.NOT_FOUND:
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.VIOLATION,
            message="Unit Sale Price is required but was not found.",
            evidence=evidence,
            confidence=1.0
        )
        
    if usp_status == getattr(ExtractionStatus, "SOURCE_UNAVAILABLE", None):
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message="Unit Sale Price cannot be evaluated because the source is unavailable.",
            evidence=evidence,
            confidence=0.5
        )
        
    if usp_status in (ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS) or (usp_field.normalized or {}).get("validation") == "INVALID":
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message="Unit Sale Price extraction is ambiguous or unparseable.",
            evidence=evidence,
            confidence=0.5
        )

    # Valid FOUND
    usp_norm = usp_field.normalized or {}
    usp_val = usp_norm.get("numeric")
    usp_unit = usp_norm.get("canonical_unit")
    
    if usp_val is None or usp_unit is None:
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message="Unit Sale Price numeric or unit could not be parsed.",
            evidence=evidence,
            confidence=0.5
        )

    # 5 & 6. Required unit
    req_unit = None
    if qty_unit == "g":
        if qty_val < 1000.0: req_unit = "g"
        elif qty_val > 1000.0: req_unit = "kg"
        else:
            return RuleResult(
                rule_id=USP_RULE_ID,
                field="unit_sale_price",
                status=RuleStatus.NEEDS_REVIEW,
                message="Net quantity is exactly 1 kg; boundary treatment requires legal review.",
                evidence=evidence,
                confidence=0.5
            )
    elif qty_unit == "ml":
        if qty_val < 1000.0: req_unit = "ml"
        elif qty_val > 1000.0: req_unit = "l"
        else:
            return RuleResult(
                rule_id=USP_RULE_ID,
                field="unit_sale_price",
                status=RuleStatus.NEEDS_REVIEW,
                message="Net quantity is exactly 1 L; boundary treatment requires legal review.",
                evidence=evidence,
                confidence=0.5
            )
    elif qty_unit == "m":
        if qty_val < 1.0: req_unit = "cm"
        elif qty_val > 1.0: req_unit = "m"
        else:
            return RuleResult(
                rule_id=USP_RULE_ID,
                field="unit_sale_price",
                status=RuleStatus.NEEDS_REVIEW,
                message="Net quantity is exactly 1 m; boundary treatment requires legal review.",
                evidence=evidence,
                confidence=0.5
            )
    elif qty_unit in ["unit", "piece", "number", "n", "u", "1n", "1u"]:
        req_unit = "unit"
        
    if not req_unit:
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NEEDS_REVIEW,
            message=f"Net quantity unit '{qty_unit}' is not recognized for USP rule.",
            evidence=evidence,
            confidence=0.5
        )

    # 7. Declared vs Required unit
    if usp_unit != req_unit:
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.VIOLATION,
            message=f"Unit Sale Price must be declared per {req_unit} (found per {usp_unit}).",
            evidence=evidence,
            confidence=1.0
        )

    # 4. Package-level MRP == implied USP price
    implied_price = usp_val * qty_val
    if abs(implied_price - mrp_val) < 0.05: # small tolerance
        return RuleResult(
            rule_id=USP_RULE_ID,
            field="unit_sale_price",
            status=RuleStatus.NOT_APPLICABLE,
            message="Unit Sale Price declaration is redundant as implied price equals MRP (DoCA FAQ Q4).",
            evidence=evidence,
            confidence=1.0
        )
        
    # 8. PASS
    return RuleResult(
        rule_id=USP_RULE_ID,
        field="unit_sale_price",
        status=RuleStatus.PASS,
        message="Unit Sale Price is compliant.",
        evidence=evidence,
        confidence=1.0
    )
