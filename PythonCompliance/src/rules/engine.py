from typing import Optional, List
from src.rules.result import RuleResult, RuleStatus
from src.rules.applicability import get_applicable_fields, FieldStatus
from src.extract.schema import ExtractedField
from src.normalize.normalizer import NormalizedField

from src.rules.common.manufacturer import check_manufacturer
from src.rules.common.product_name import check_product_name
from src.rules.common.quantity import check_quantity
from src.rules.common.manufacturing_date import check_manufacturing_date
from src.rules.common.mrp import check_mrp
from src.rules.common.dimensions import check_dimensions
from src.rules.common.consumer_care import check_consumer_care
from src.rules.common.country_of_origin import check_country_of_origin
from src.rules.common.unit_sale_price import check_usp

_RULE_IDS = {
    "manufacturer_packer_importer": "LMPC_6_1_A",
    "common_name": "LMPC_6_1_B",
    "net_quantity": "LMPC_6_1_C",
    "mfg_date": "LMPC_6_1_D",
    "mrp": "LMPC_6_1_E",
    "dimensions": "LMPC_6_1_F",
    "country_of_origin": "LMPC_6_1_G",
    "consumer_care": "LMPC_6_2",
    "unit_sale_price": "LMPC_6_11_USP"
}

def evaluate_general_rules(
    category: str,
    normalized_fields: dict,
    sub_category: Optional[str] = None,
    is_apm: Optional[bool] = None,
    is_low_confidence: bool = False,
) -> List[RuleResult]:
    
    app_result = get_applicable_fields(
        category=category, 
        sub_category=sub_category, 
        is_apm=is_apm,
        is_low_confidence=is_low_confidence
    )
    
    fields_status = app_result.fields
    
    # The short-circuit for ALL OUT_OF_SCOPE fields has been removed to preserve the NOT_APPLICABLE
    # semantic information and pass it to the compliance decision.
    results = []
    
    core_fields = [
        "manufacturer_packer_importer",
        "common_name",
        "net_quantity",
        "mfg_date",
        "mrp",
        # Dimensions extraction is not yet implemented upstream (see dimensions.py's KNOWN GAP comment) 
        # dimensions extraction is not yet implemented upstream
        "country_of_origin",
        "consumer_care",
        "unit_sale_price"
    ]
    
    for field_id in core_fields:
        status = fields_status.get(field_id, FieldStatus.APPLICABLE)
        rule_id = _RULE_IDS[field_id]
        
        if status in (FieldStatus.EXEMPT, FieldStatus.OUT_OF_SCOPE):
            results.append(RuleResult(
                rule_id=rule_id,
                field=field_id,
                status=RuleStatus.NOT_APPLICABLE,
                message=f"{field_id.replace('_', ' ').title()} is exempt or out of scope.",
                evidence=[],
                confidence=1.0
            ))
            continue
            
        if status == FieldStatus.NEEDS_REVIEW:
            results.append(RuleResult(
                rule_id=rule_id,
                field=field_id,
                status=RuleStatus.NEEDS_REVIEW,
                message=f"{field_id.replace('_', ' ').title()} applicability is unknown (e.g. APM status missing).",
                evidence=[],
                confidence=0.5
            ))
            continue
            
        field_data = normalized_fields.get(field_id)
        
        if field_id == "manufacturer_packer_importer":
            res = check_manufacturer(field_data)
        elif field_id == "common_name":
            res = check_product_name(field_data)
        elif field_id == "net_quantity":
            res = check_quantity(field_data)
        elif field_id == "mfg_date":
            res = check_manufacturing_date(field_data)
        elif field_id == "mrp":
            res = check_mrp(field_data)
        elif field_id == "dimensions":
            res = check_dimensions(field_data)
        elif field_id == "consumer_care":
            if isinstance(field_data, dict):
                res = check_consumer_care(**field_data)
            else:
                res = check_consumer_care(field_data)
        elif field_id == "country_of_origin":
            res = check_country_of_origin(field_data, normalized_fields.get("import_status"))
        elif field_id == "unit_sale_price":
            res = check_usp(field_data, normalized_fields.get("mrp"), normalized_fields.get("net_quantity"))
            
        # Centralized extracted_value hydration
        if field_id == "consumer_care" and isinstance(field_data, dict):
            phone = field_data.get("phone")
            email = field_data.get("email")
            vals, orig_vals, ovr_vals = [], [], []
            for item in (phone, email):
                ext_field = None
                if isinstance(item, NormalizedField):
                    ext_field = item.field
                elif isinstance(item, ExtractedField):
                    ext_field = item
                    
                if ext_field is not None:
                    if ext_field.extracted_value is not None:
                        vals.append(str(ext_field.extracted_value))
                    if ext_field.original_value is not None:
                        orig_vals.append(str(ext_field.original_value))
                    if ext_field.officer_override is not None:
                        ovr_vals.append(str(ext_field.officer_override))

            res.extracted_value = " / ".join(vals) if vals else None
            res.original_value = " / ".join(orig_vals) if orig_vals else None
            res.officer_override = " / ".join(ovr_vals) if ovr_vals else None
        else:
            ext_field = None
            if isinstance(field_data, NormalizedField):
                ext_field = field_data.field
            elif isinstance(field_data, ExtractedField):
                ext_field = field_data
                
            if ext_field is not None:
                res.extracted_value = ext_field.extracted_value
                res.original_value = ext_field.original_value
                res.officer_override = ext_field.officer_override
            else:
                res.extracted_value = None
                res.original_value = None
                res.officer_override = None
                
        results.append(res)
        
    return results
