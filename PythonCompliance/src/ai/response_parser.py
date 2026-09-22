import logging
from typing import Dict, Any
from src.extract.schema import ProductFields, ExtractedField, ExtractionStatus

logger = logging.getLogger(__name__)

def _parse_field(data: dict) -> ExtractedField:
    if not isinstance(data, dict):
        return ExtractedField(status=ExtractionStatus.NOT_FOUND)
        
    status_str = data.get("status", "NOT_FOUND")
    try:
        status = ExtractionStatus[status_str]
    except KeyError:
        status = ExtractionStatus.AMBIGUOUS
        
    return ExtractedField(
        status=status,
        extracted_value=str(data.get("value")) if data.get("value") is not None else None,
        normalized_value=str(data.get("value")) if data.get("value") is not None else None,
        extraction_confidence=float(data.get("confidence", 0.0)),
        source_text=" ".join(data.get("evidence", []))
    )

def parse_vlm_response(vlm_dict: Dict[str, Any]) -> ProductFields:
    fields = ProductFields()
    
    if not isinstance(vlm_dict, dict):
        logger.error("VLM output is not a dictionary.")
        return fields
        
    # Flat fields
    flat_keys = ["product_name", "category", "canonical_category", "mrp", "net_quantity", "manufacturing_date", "expiry_date", "batch_number", "fssai", "country_of_origin", "import_status"]
    for k in flat_keys:
        if k in vlm_dict:
            setattr(fields, k, _parse_field(vlm_dict[k]))
            
    # Nested fields (CompanyInfo)
    for company_k in ["manufacturer", "packer", "importer"]:
        if company_k in vlm_dict and isinstance(vlm_dict[company_k], dict):
            comp_obj = getattr(fields, company_k)
            if "name" in vlm_dict[company_k]:
                comp_obj.name = _parse_field(vlm_dict[company_k]["name"])
            if "address" in vlm_dict[company_k]:
                comp_obj.address = _parse_field(vlm_dict[company_k]["address"])
                
    # Nested field (ConsumerCareInfo)
    if "consumer_care" in vlm_dict and isinstance(vlm_dict["consumer_care"], dict):
        cc = vlm_dict["consumer_care"]
        if "name" in cc: fields.consumer_care.name = _parse_field(cc["name"])
        if "address" in cc: fields.consumer_care.address = _parse_field(cc["address"])
        if "phone" in cc: fields.consumer_care.phone = _parse_field(cc["phone"])
        if "email" in cc: fields.consumer_care.email = _parse_field(cc["email"])
        
    return fields
