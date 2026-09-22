import argparse
import os
import json
import logging
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.config import Config
from src.extract.schema import StructuredExtractionResult
from src.pipeline import OCRPipeline
from src.normalize.normalizer import normalize_product_fields
from src.rules.classifier import classify_category
from src.rules.pipeline import run_compliance_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Run full pipeline smoke test")
    parser.add_argument("--image", type=str, default=None, help="Path to a single image")
    parser.add_argument("--limit", type=int, default=None, help="Max images to process")
    parser.add_argument("--provider", type=str, default="real", choices=["real", "mock"], help="VLM Provider to use")
    args = parser.parse_args()
    
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test_images")
    
    imgs = []
    if args.image:
        imgs.append(args.image)
    else:
        for root_dir, _, files in os.walk(data_dir):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    imgs.append(os.path.join(root_dir, file))
        imgs.sort()
        if args.limit is not None:
            imgs = imgs[:args.limit]
            
    # Enable VLM in the canonical pipeline
    Config.USE_VLM = True
    Config.VLM_PROVIDER = args.provider
    pipeline = OCRPipeline()
    
    failed = []
    
    for img_path in imgs:
        print("\n" + "="*80)
        print(f"Processing: {img_path}")
        print("="*80)
        try:
            # 1. Base pipeline (OCR only)
            json_out = pipeline.process_image(img_path, save_debug=False)
            structured_data = StructuredExtractionResult.model_validate_json(json_out)
            

            
            # 2. Normalization
            normalized = normalize_product_fields(structured_data.fields)
            
            # 3. Category classification
            cat_result = classify_category(normalized)
            category = cat_result.category
            # sub_category comes from cat_result.sub_category (Phase 2C propagation)
            
            # 4. Compliance execution
            filename = os.path.basename(img_path)
            report = run_compliance_pipeline(
                product_id=filename,
                normalized_fields=normalized,
                category=category,
                sub_category=cat_result.sub_category,  # Phase 2C: propagated from classifier
                # is_apm intentionally remains None — LPG APM detection deferred (Phase 2C read-only finding)
                warnings=getattr(structured_data, "warnings", []),
                is_low_confidence=(cat_result.status == "LOW_CONFIDENCE")
            )
            
            print(f"File: {filename}")
            print(f"Category: {category}")
            sub_category = cat_result.sub_category
            if sub_category:
                print(f"Sub-category: {sub_category}")
            print(f"Overall Decision: {report['overall_decision']}")
            print(f"Violations: {len(report['violations'])}")
            print(f"Needs Review: {len(report['needs_review'])}")
            print("\nFull Evidence Report:")
            print(json.dumps(report, indent=4))
            
            # Save actual structured result
            from src.rules.adapters import adapt_normalized_fields
            adapted = adapt_normalized_fields(normalized)
            adapted_dict = {}
            for k, v in adapted.items():
                if hasattr(v, 'model_dump'):
                    adapted_dict[k] = v.model_dump()
                elif isinstance(v, dict):
                    adapted_dict[k] = {k2: (v2.model_dump() if hasattr(v2, 'model_dump') else v2) for k2, v2 in v.items()}
                else:
                    adapted_dict[k] = v
                    
            output_dict = {
                "call_chain": [
                    "pipeline.process_image()",
                    "normalize_product_fields()",
                    "classify_category()",
                    "run_compliance_pipeline()"
                ],
                "vlm_provider_used": args.provider,
                "image_tested": img_path,
                "raw_pipeline_extraction": json.loads(json_out),
                "normalized_fields": {k: (v.model_dump() if hasattr(v, 'model_dump') else v) for k, v in normalized.model_dump().items()} if hasattr(normalized, 'model_dump') else str(normalized),
                "adapted_engine_fields": adapted_dict,
                "category_result": cat_result.model_dump() if hasattr(cat_result, 'model_dump') else str(cat_result),
                "final_compliance_report": report
            }
            
            image_stem = os.path.splitext(os.path.basename(img_path))[0]
            out_name = f"SMOKE_TEST_{image_stem}_REAL_GEMINI.json"
            out_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval", "results", out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(output_dict, f, indent=4)
            print(f"\nSaved structured output to: {out_path}")
            
        except Exception as e:
            print(f"FAILED on {img_path}: {e}")
            logger.exception("Traceback:")
            failed.append(img_path)
            
    if failed:
        print("\nFailed images:")
        for f in failed:
            print(f"- {f}")

if __name__ == "__main__":
    main()
