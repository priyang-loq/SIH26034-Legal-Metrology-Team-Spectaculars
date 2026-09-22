from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import NormalizedProductFields

def _combine_entity(name: ExtractedField, address: ExtractedField) -> ExtractedField:
    # Status priority (highest to lowest):
    #   NOT_FOUND > AMBIGUOUS > LOW_CONFIDENCE > SOURCE_UNAVAILABLE > FOUND
    # Crucially: if the name is FOUND (e.g. from an officer override or OCR),
    # SOURCE_UNAVAILABLE on the address must NOT downgrade the entity to unavailable.
    # The address is an optional secondary sub-field; the name alone is sufficient.
    name_found = name.status == ExtractionStatus.FOUND and name.extracted_value
    addr_found = address.status == ExtractionStatus.FOUND and address.extracted_value

    if name_found or addr_found:
        # At least one sub-field is genuinely present — entity is FOUND.
        status = ExtractionStatus.FOUND
    elif ExtractionStatus.NOT_FOUND in (name.status, address.status):
        # Neither is present; name is explicitly missing.
        status = ExtractionStatus.NOT_FOUND
    elif ExtractionStatus.LOW_CONFIDENCE in (name.status, address.status):
        status = ExtractionStatus.LOW_CONFIDENCE
    elif ExtractionStatus.AMBIGUOUS in (name.status, address.status):
        status = ExtractionStatus.AMBIGUOUS
    else:
        # Both are SOURCE_UNAVAILABLE or some other fallback state.
        status = ExtractionStatus.SOURCE_UNAVAILABLE

    vals = []
    if name.extracted_value:
        vals.append(name.extracted_value)
    if address.extracted_value:
        vals.append(address.extracted_value)

    # Propagate officer_override from name (primary field)
    officer_override = name.officer_override or address.officer_override
    original_value = name.original_value or address.original_value

    return ExtractedField(
        extracted_value=", ".join(vals) if vals else None,
        status=status,
        extraction_confidence=(name.extraction_confidence + address.extraction_confidence) / 2.0,
        evidence=name.evidence + address.evidence,
        officer_override=officer_override,
        original_value=original_value,
    )

def adapt_normalized_fields(normalized: NormalizedProductFields) -> dict:
    mfg = _combine_entity(normalized.manufacturer_name, normalized.manufacturer_address)
    pck = _combine_entity(normalized.packer_name, normalized.packer_address)
    imp = _combine_entity(normalized.importer_name, normalized.importer_address)
    
    if mfg.status != ExtractionStatus.NOT_FOUND:
        mfg_combined = mfg
    elif pck.status != ExtractionStatus.NOT_FOUND:
        mfg_combined = pck
    elif imp.status != ExtractionStatus.NOT_FOUND:
        mfg_combined = imp
    else:
        mfg_combined = mfg
    return {
        "manufacturer_packer_importer": mfg_combined,
        "common_name": normalized.product_name,
        "net_quantity": normalized.net_quantity,
        "mfg_date": normalized.manufacturing_date,
        "mrp": normalized.mrp,
        "dimensions": ExtractedField(
            extracted_value=None,
            status=ExtractionStatus.NOT_FOUND,
            extraction_confidence=0.0,
            evidence=[]
        ),
        "consumer_care": {
            "phone": normalized.consumer_care_phone,
            "email": normalized.consumer_care_email,
        },
        "country_of_origin": normalized.country_of_origin,
        "import_status": normalized.import_status,
        "unit_sale_price": normalized.unit_sale_price,
    }
