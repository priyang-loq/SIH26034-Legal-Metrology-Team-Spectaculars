from enum import Enum
from dataclasses import dataclass
from typing import Dict, Optional

class FieldStatus(Enum):
    APPLICABLE = "APPLICABLE"
    EXEMPT = "EXEMPT"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    NEEDS_REVIEW = "NEEDS_REVIEW"

@dataclass
class ApplicabilityResult:
    fields: Dict[str, FieldStatus]
    low_confidence: bool = False
    is_valid_category: bool = True

CORE_FIELDS = [
    "manufacturer_packer_importer",
    "common_name",
    "net_quantity",
    "mfg_date",
    "mrp",
    "dimensions",
    "country_of_origin",
    "consumer_care",
    "layout_checks",
    "unit_sale_price"
]

CATEGORY_RULES = {
    "general": {
        "default": FieldStatus.APPLICABLE,
        "overrides": {}
    },
    "food": {
        "default": FieldStatus.OUT_OF_SCOPE,
        "overrides": {}
    },
    "cosmetic": {
        "default": FieldStatus.APPLICABLE,
        "overrides": {
            "mrp": FieldStatus.EXEMPT
        }
    },
    "alcohol": {
        "default": FieldStatus.APPLICABLE,
        "overrides": {
            "mrp": FieldStatus.EXEMPT
        }
    },
    "bidi_incense": {
        "default": FieldStatus.APPLICABLE,
        "overrides": {
            "mfg_date": FieldStatus.EXEMPT
        },
        "sub_category_overrides": {
            "bidi": {
                "mrp": FieldStatus.EXEMPT
            },
            "incense": {
                "mrp": FieldStatus.APPLICABLE
            }
        }
    },
    "lpg_cylinder": {
        "default": FieldStatus.APPLICABLE,
        "overrides": {
            "mfg_date": FieldStatus.EXEMPT
        },
        "dynamic_overrides": {
            "is_apm": {
                True: {"mrp": FieldStatus.EXEMPT},
                False: {"mrp": FieldStatus.APPLICABLE},
                None: {"mrp": FieldStatus.NEEDS_REVIEW}
            }
        }
    }
}

def get_applicable_fields(
    category: str,
    sub_category: Optional[str] = None,
    is_apm: Optional[bool] = None,
    is_low_confidence: bool = False
) -> ApplicabilityResult:
    
    if is_low_confidence:
        category = "general"
        
    if category not in CATEGORY_RULES:
        raise ValueError(f"Invalid category: {category}")
        
    rule = CATEGORY_RULES[category]
    default_status = rule.get("default", FieldStatus.APPLICABLE)
    overrides = rule.get("overrides", {}).copy()
    
    if "sub_category_overrides" in rule and sub_category in rule["sub_category_overrides"]:
        overrides.update(rule["sub_category_overrides"][sub_category])
        
    if "dynamic_overrides" in rule and "is_apm" in rule["dynamic_overrides"]:
        mapping = rule["dynamic_overrides"]["is_apm"]
        if is_apm in mapping:
            overrides.update(mapping[is_apm])
            
    fields = {}
    for field in CORE_FIELDS:
        fields[field] = overrides.get(field, default_status)
        
    return ApplicabilityResult(
        fields=fields,
        low_confidence=is_low_confidence,
        is_valid_category=True
    )
