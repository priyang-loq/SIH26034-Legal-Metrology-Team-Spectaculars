import sys
import os
import json

import argparse
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image_path")
    parser.add_argument("--raw-out", dest="raw_out", help="Path to save raw JSON extraction")
    args = parser.parse_args()
    image_path = args.image_path
    raw_out = args.raw_out
    if not os.path.exists(image_path):
        sys.stderr.write(f"Image not found: {image_path}\n")
        sys.exit(1)

    try:
        from src.pipeline import OCRPipeline
        from src.extract.schema import StructuredExtractionResult
        from src.rules.pipeline import run_compliance_pipeline
        from src.rules.classifier import classify_category
        from src.normalize.normalizer import normalize_product_fields, NormalizedProductFields
        from src.config import Config
    except ImportError as e:
        sys.stderr.write(f"ImportError: {e}\n")
        sys.exit(1)

    try:
        pipeline = OCRPipeline()
        json_out = pipeline.process_image(image_path, save_debug=False)
        structured_data = StructuredExtractionResult.model_validate_json(json_out)

        if raw_out:
            try:
                os.makedirs(os.path.dirname(raw_out), exist_ok=True)
                with open(raw_out, "w", encoding="utf-8") as f:
                    f.write(json_out)
            except Exception as e:
                sys.stderr.write(f"Failed to save raw output: {e}\n")

        if isinstance(structured_data.fields, NormalizedProductFields):
            normalized = structured_data.fields
        else:
            normalized = normalize_product_fields(structured_data.fields)
        cat_result = classify_category(normalized)

        filename = os.path.basename(image_path)
        warnings = getattr(structured_data, "warnings", [])

        final_report = run_compliance_pipeline(
            product_id=filename,
            normalized_fields=normalized,
            category=cat_result.category,
            sub_category=cat_result.sub_category,
            warnings=warnings, is_low_confidence=(cat_result.status == "LOW_CONFIDENCE")
        )

        # Attach image dimensions so the Node adapter can convert pixel bboxes
        # to percentage coordinates without inventing values.
        try:
            import cv2 as _cv2
            _img = _cv2.imread(image_path)
            if _img is not None:
                _h, _w = _img.shape[:2]
                if isinstance(final_report, dict):
                    final_report["image_width_px"] = _w
                    final_report["image_height_px"] = _h
        except Exception:
            pass  # Non-fatal: Node adapter will omit bbox when dimensions absent

        pi = {
            "barcode": (
                structured_data.fields.barcode.extracted_value
                if getattr(structured_data.fields, "barcode", None) is not None
                and structured_data.fields.barcode.status == "FOUND"
                else None
            ),
            "product_name": (
                structured_data.fields.product_name.extracted_value
                if getattr(structured_data.fields, "product_name", None) is not None
                and structured_data.fields.product_name.status == "FOUND"
                else None
            ),
            "manufacturer": (
                structured_data.fields.manufacturer_name.extracted_value
                if getattr(structured_data.fields, "manufacturer_name", None) is not None
                and structured_data.fields.manufacturer_name.status == "FOUND"
                else None
            ),
        }

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
