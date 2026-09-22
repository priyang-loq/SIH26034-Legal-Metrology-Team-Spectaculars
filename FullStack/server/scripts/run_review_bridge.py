from src.normalize.normalizer import NormalizedProductFields
import sys
import os
import json
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("raw_json_path", help="Path to raw JSON extraction")
    parser.add_argument("--overrides", dest="overrides", help="JSON string of field overrides")
    args = parser.parse_args()

    raw_path = args.raw_json_path
    overrides_str = args.overrides

    if not os.path.exists(raw_path):
        sys.stderr.write(f"Raw extraction not found: {raw_path}\n")
        sys.exit(1)

    try:
        from src.extract.schema import StructuredExtractionResult, ExtractedField
        from src.rules.pipeline import run_compliance_pipeline
        from src.rules.classifier import classify_category
        from src.normalize.normalizer import normalize_product_fields
    except ImportError as e:
        sys.stderr.write(f"ImportError: {e}\n")
        sys.exit(1)

    try:
        with open(raw_path, "r", encoding="utf-8") as f:
            json_in = f.read()

        StructuredExtractionResult.model_rebuild(_types_namespace={'NormalizedProductFields': NormalizedProductFields})
        structured_data = StructuredExtractionResult.model_validate_json(json_in)

        # Apply overrides
        overrides = {}
        if overrides_str:
            try:
                overrides = json.loads(overrides_str)
            except Exception as e:
                sys.stderr.write(f"Failed to parse overrides JSON: {e}\n")

        # 1. Map keys
        if "manufacturer" in overrides:
            overrides["manufacturer.name"] = overrides.pop("manufacturer")
        if "manufacturer_details" in overrides:
            overrides["manufacturer.name"] = overrides.pop("manufacturer_details")
        if "common_name" in overrides:
            overrides["product_name"] = overrides.pop("common_name")
        if "mfg_date" in overrides:
            overrides["manufacturing_date"] = overrides.pop("mfg_date")
        if "date_of_manufacture" in overrides:
            overrides["manufacturing_date"] = overrides.pop("date_of_manufacture")

        # 2. Derive import status
        if "country_of_origin" in overrides:
            coo = overrides["country_of_origin"].strip()
            if coo.upper() == "INDIA":
                overrides["import_status"] = "DOMESTIC"
            elif coo:
                overrides["import_status"] = "IMPORTED"

        # 3. Handle nested consumer care
        if "consumer_care" in overrides:
            cc = overrides.pop("consumer_care")
            if isinstance(cc, dict):
                for k, v in cc.items():
                    overrides[f"consumer_care.{k}"] = v
            elif isinstance(cc, str):
                if "@" in cc and "." in cc:
                    overrides["consumer_care.email"] = cc
                else:
                    overrides["consumer_care.phone"] = cc

        # We recursively apply overrides to any ExtractedField that matches the key
        def apply_overrides(obj, prefix=""):
            if hasattr(obj, "__fields__"):
                for key in obj.__fields__:
                    val = getattr(obj, key)
                    full_key = f"{prefix}.{key}" if prefix else key
                    if isinstance(val, ExtractedField):
                        ovr_key = None
                        if full_key in overrides:
                            ovr_key = full_key
                        elif key in overrides and prefix == "":
                            ovr_key = key

                        if ovr_key:
                            # Preserve original value
                            val.original_value = val.extracted_value
                            # Set effective override
                            val.extracted_value = overrides[ovr_key]
                            val.officer_override = overrides[ovr_key]
                            # Optionally set status to FOUND if it was NOT_FOUND
                            if val.status != "FOUND":
                                val.status = "FOUND"
                    else:
                        apply_overrides(val, prefix=full_key)

        if isinstance(structured_data.fields, NormalizedProductFields):
            from src.extract.schema import ExtractionStatus
            normalized = structured_data.fields
            if "import_status" in overrides:
                val = overrides["import_status"]
                if val in ["DOMESTIC", "IMPORTED"]:
                    if normalized.import_status is None:
                        from src.extract.schema import ExtractedField
                        normalized.import_status = ExtractedField()
                    normalized.import_status.original_value = normalized.import_status.extracted_value
                    normalized.import_status.extracted_value = val
                    normalized.import_status.officer_override = val
                    normalized.import_status.status = ExtractionStatus.FOUND
            if "manufacturer.name" in overrides or "manufacturer_name" in overrides or "manufacturer" in overrides:
                val = overrides.get("manufacturer.name") or overrides.get("manufacturer_name") or overrides.get("manufacturer")
                normalized.manufacturer_name.original_value = normalized.manufacturer_name.extracted_value
                normalized.manufacturer_name.extracted_value = val
                normalized.manufacturer_name.officer_override = val
                normalized.manufacturer_name.status = ExtractionStatus.FOUND
            if "product_name" in overrides or "common_name" in overrides:
                val = overrides.get("product_name") or overrides.get("common_name")
                normalized.product_name.original_value = normalized.product_name.extracted_value
                normalized.product_name.extracted_value = val
                normalized.product_name.officer_override = val
                normalized.product_name.status = ExtractionStatus.FOUND
            if "country_of_origin" in overrides:
                val = overrides["country_of_origin"]
                normalized.country_of_origin.original_value = normalized.country_of_origin.extracted_value
                normalized.country_of_origin.extracted_value = val
                normalized.country_of_origin.officer_override = val
                normalized.country_of_origin.status = ExtractionStatus.FOUND
            if "net_quantity" in overrides:
                val = overrides["net_quantity"]
                normalized.net_quantity.field.original_value = normalized.net_quantity.field.extracted_value
                normalized.net_quantity.field.extracted_value = val
                normalized.net_quantity.field.officer_override = val
                normalized.net_quantity.field.status = ExtractionStatus.FOUND
            if "mrp" in overrides:
                val = overrides["mrp"]
                normalized.mrp.field.original_value = normalized.mrp.field.extracted_value
                normalized.mrp.field.extracted_value = val
                normalized.mrp.field.officer_override = val
                normalized.mrp.field.status = ExtractionStatus.FOUND
            if "manufacturing_date" in overrides or "mfg_date" in overrides:
                val = overrides.get("manufacturing_date") or overrides.get("mfg_date")
                normalized.manufacturing_date.field.original_value = normalized.manufacturing_date.field.extracted_value
                normalized.manufacturing_date.field.extracted_value = val
                normalized.manufacturing_date.field.officer_override = val
                normalized.manufacturing_date.field.status = ExtractionStatus.FOUND
            if "consumer_care.phone" in overrides:
                val = overrides["consumer_care.phone"]
                normalized.consumer_care_phone.field.original_value = normalized.consumer_care_phone.field.extracted_value
                normalized.consumer_care_phone.field.extracted_value = val
                normalized.consumer_care_phone.field.officer_override = val
                normalized.consumer_care_phone.field.status = ExtractionStatus.FOUND
                normalized.consumer_care_phone.normalized = {"validation": "VALID", "digits_only": str(val)}
            if "consumer_care.email" in overrides:
                val = overrides["consumer_care.email"]
                normalized.consumer_care_email.field.original_value = normalized.consumer_care_email.field.extracted_value
                normalized.consumer_care_email.field.extracted_value = val
                normalized.consumer_care_email.field.officer_override = val
                normalized.consumer_care_email.field.status = ExtractionStatus.FOUND
                normalized.consumer_care_email.normalized = {"validation": "VALID", "lower": str(val).lower()}
            if "consumer_care" in overrides:
                val = overrides["consumer_care"]
                if "@" in str(val):
                    normalized.consumer_care_email.field.original_value = normalized.consumer_care_email.field.extracted_value
                    normalized.consumer_care_email.field.extracted_value = val
                    normalized.consumer_care_email.field.officer_override = val
                    normalized.consumer_care_email.field.status = ExtractionStatus.FOUND
                    normalized.consumer_care_email.normalized = {"validation": "VALID", "lower": str(val).lower()}
                else:
                    normalized.consumer_care_phone.field.original_value = normalized.consumer_care_phone.field.extracted_value
                    normalized.consumer_care_phone.field.extracted_value = val
                    normalized.consumer_care_phone.field.officer_override = val
                    normalized.consumer_care_phone.field.status = ExtractionStatus.FOUND
                    normalized.consumer_care_phone.normalized = {"validation": "VALID", "digits_only": str(val)}
        else:
            apply_overrides(structured_data.fields)
            normalized = normalize_product_fields(structured_data.fields)
        cat_result = classify_category(normalized)

        # filename was originally the image path basename, but we only have raw_path here
        # we can extract the original image path from structured_data
        filename = os.path.basename(structured_data.image_path) if structured_data.image_path else "unknown"
        warnings = getattr(structured_data, "warnings", [])
        # Officer overrides resolve AI_UNAVAILABLE fields. Remove the AI_UNAVAILABLE
        # warning so that a fully-reviewed scan can graduate to COMPLIANT instead of
        # being permanently pinned at NEEDS_REVIEW by a stale scan-time flag.
        if overrides:
            warnings = [w for w in warnings if w != "AI_UNAVAILABLE"]

        final_report = run_compliance_pipeline(
            product_id=filename,
            normalized_fields=normalized,
            category=cat_result.category,
            sub_category=cat_result.sub_category,
            warnings=warnings, is_low_confidence=(cat_result.status == "LOW_CONFIDENCE")
        )

        pi = structured_data.product_intelligence if structured_data.product_intelligence else {}

        if hasattr(structured_data, "product_intelligence") and structured_data.product_intelligence:
            if "brand" in structured_data.product_intelligence:
                pi["brand"] = structured_data.product_intelligence["brand"]

        if isinstance(final_report, dict):
            final_report["product_intelligence"] = pi
            print(json.dumps(final_report, indent=4))
        else:
            out_dict = final_report.model_dump()
            out_dict["product_intelligence"] = pi
            print(json.dumps(out_dict, indent=4))

        sys.exit(0)
    except Exception as e:
        sys.stderr.write(f"Pipeline error: {str(e)}\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()










