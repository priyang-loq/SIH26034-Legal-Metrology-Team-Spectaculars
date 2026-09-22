import argparse
import os
import json
import logging
import sys
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.config import Config
from src.pipeline import OCRPipeline
from eval.matching import is_match
from src.ai.vlm import MockVLMExtractor, RealVLMExtractor
from src.ai.response_parser import parse_vlm_response
from src.fusion.fusion import fuse_results
from src.extract.extractor import extract_fields
import cv2
from src.preprocess.image_utils import preprocess_for_ocr

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FIELDS = [
    "category", "product_name", "mrp", "net_quantity", "manufacturing_date",
    "manufacturer_name", "manufacturer_address", 
    "packer_name", "packer_address",
    "importer_name", "importer_address",
    "consumer_care_name", "consumer_care_address", "consumer_care_phone", "consumer_care_email"
]

def get_val(fields_obj, field_name):
    if not fields_obj:
        return None
    try:
        if field_name in ["mrp", "net_quantity", "manufacturing_date", "expiry_date", "product_name", "category"]:
            return getattr(fields_obj, field_name)
        elif field_name.startswith("manufacturer_"):
            return getattr(fields_obj.manufacturer, field_name.split("_")[1])
        elif field_name.startswith("packer_"):
            return getattr(fields_obj.packer, field_name.split("_")[1])
        elif field_name.startswith("importer_"):
            return getattr(fields_obj.importer, field_name.split("_")[1])
        elif field_name.startswith("consumer_care_"):
            return getattr(fields_obj.consumer_care, field_name.replace("consumer_care_", ""))
    except AttributeError:
        pass
    return None

def extract_value_and_status(field_obj):
    if field_obj is None:
        return {"value": None, "status": "NOT_FOUND", "confidence": 0.0, "evidence": []}
    
    # Safely convert the string source_text back to a list for the output JSON
    evidence_val = getattr(field_obj, "source_text", "")
    evidence_list = [evidence_val] if evidence_val and str(evidence_val).strip() else []
    
    return {
        "value": field_obj.extracted_value,
        "status": field_obj.status.value,
        "confidence": field_obj.extraction_confidence,
        "evidence": evidence_list
    }

def run_benchmark(data_dir=None, results_dir=None, fail_vlm=False, limit=None):
    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test_images")
    if results_dir is None:
        results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval", "results")
    
    os.makedirs(os.path.join(results_dir, "baseline"), exist_ok=True)
    os.makedirs(os.path.join(results_dir, "vlm"), exist_ok=True)
    os.makedirs(os.path.join(results_dir, "fusion"), exist_ok=True)
    
    pipeline = OCRPipeline()
    
    if getattr(Config, "VLM_PROVIDER", "mock").lower() == "real":
        logger.info("Using Real VLM Extractor")
        vlm_engine = RealVLMExtractor()
    else:
        logger.info("Using Mock VLM Extractor")
        vlm_engine = MockVLMExtractor()
        
    imgs = []
    for root_dir, _, files in os.walk(data_dir):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                rel_path = os.path.relpath(os.path.join(root_dir, file), data_dir).replace("\\", "/")
                imgs.append(rel_path)
                
    imgs.sort()
    if limit is not None:
        imgs = imgs[:limit]
        
    logger.info(f"Data Directory: {data_dir}")
    logger.info(f"Number of Images Selected: {len(imgs)}")
    logger.info(f"Number of VLM API Calls Expected: {0 if fail_vlm else len(imgs)}")
                
    summary = {
        "metrics": {f: {"baseline_detected": 0, "vlm_detected": 0, "fusion_detected": 0,
                        "agreement": 0, "ocr_only": 0, "vlm_only": 0, 
                        "disagreement": 0, "both_missing": 0} for f in FIELDS},
        "total_images": 0
    }

    for rel_path in imgs:
        img_path = os.path.join(data_dir, rel_path)
        if not os.path.exists(img_path):
            continue
            
        summary["total_images"] += 1
        logger.info(f"Processing {img_path}...")
        
        try:
            Config.USE_VLM = False
            img = cv2.imread(img_path)
            if img is None:
                continue
                
            processed_img = preprocess_for_ocr(img)
            ocr_result = pipeline.ocr_engine.extract_text(processed_img)
            baseline_fields_obj = extract_fields(ocr_result, img_path).fields
            
            vlm_fields_obj = None
            if not fail_vlm:
                try:
                    vlm_dict = vlm_engine.extract(img_path, ocr_result)
                    vlm_fields_obj = parse_vlm_response(vlm_dict)
                except Exception as e:
                    logger.error(f"VLM extraction failed: {e}")
                    
            if vlm_fields_obj:
                fused_fields_obj = fuse_results(baseline_fields_obj, vlm_fields_obj)
            else:
                fused_fields_obj = baseline_fields_obj
            
            baseline_out = {"image": rel_path, "result": {}}
            vlm_out = {"image": rel_path, "result": {}}
            fusion_out = {"image": rel_path, "result": {}}
            
            for f in FIELDS:
                base_obj = get_val(baseline_fields_obj, f)
                vlm_obj = get_val(vlm_fields_obj, f)
                fuse_obj = get_val(fused_fields_obj, f)
                
                base_data = extract_value_and_status(base_obj)
                vlm_data = extract_value_and_status(vlm_obj)
                fuse_data = extract_value_and_status(fuse_obj)
                
                baseline_out["result"][f] = base_data
                vlm_out["result"][f] = vlm_data
                fusion_out["result"][f] = fuse_data
                
                b_found = base_data["status"] == "FOUND"
                v_found = vlm_data["status"] == "FOUND"
                f_found = fuse_data["status"] == "FOUND"
                
                if b_found: summary["metrics"][f]["baseline_detected"] += 1
                if v_found: summary["metrics"][f]["vlm_detected"] += 1
                if f_found: summary["metrics"][f]["fusion_detected"] += 1
                
                if b_found and v_found:
                    if is_match(base_data["value"], vlm_data["value"], f):
                        summary["metrics"][f]["agreement"] += 1
                    else:
                        summary["metrics"][f]["disagreement"] += 1
                elif b_found and not v_found:
                    summary["metrics"][f]["ocr_only"] += 1
                elif not b_found and v_found:
                    summary["metrics"][f]["vlm_only"] += 1
                else:
                    summary["metrics"][f]["both_missing"] += 1
                
            safe_name = rel_path.replace("/", "_").replace("\\", "_") + ".json"
            
            with open(os.path.join(results_dir, "baseline", safe_name), "w") as f_out:
                json.dump(baseline_out, f_out, indent=4)
            with open(os.path.join(results_dir, "vlm", safe_name), "w") as f_out:
                json.dump(vlm_out, f_out, indent=4)
            with open(os.path.join(results_dir, "fusion", safe_name), "w") as f_out:
                json.dump(fusion_out, f_out, indent=4)
                
        except Exception as e:
            logger.error(f"Failed processing {img_path}: {e}")
            
    with open(os.path.join(results_dir, "summary.json"), "w") as f_out:
        json.dump(summary, f_out, indent=4)
        
    print("\n" + "="*95)
    print(f"{'Field':<25s} | {'OCR (Det)':<15s} | {'VLM (Det)':<15s} | {'Fusion (Det)':<15s} | {'Agreement':<10s}")
    print("-" * 95)
    t_imgs = summary["total_images"]
    if t_imgs == 0:
        print("No images processed.")
        return summary
        
    for f in FIELDS:
        m = summary["metrics"][f]
        b_pct = (m['baseline_detected'] / t_imgs) * 100
        v_pct = (m['vlm_detected'] / t_imgs) * 100
        f_pct = (m['fusion_detected'] / t_imgs) * 100
        a_pct = (m['agreement'] / t_imgs) * 100
        
        print(f"{f:<25s} | {b_pct:>5.1f}% ({m['baseline_detected']:2d}) | {v_pct:>5.1f}% ({m['vlm_detected']:2d}) | {f_pct:>5.1f}% ({m['fusion_detected']:2d}) | {a_pct:>5.1f}%")
    print("="*95 + "\n")
    logger.info("Benchmark complete.")
    return summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run VLM/OCR Benchmark")
    parser.add_argument("--data-dir", type=str, default=None, help="Process images recursively from the specified directory")
    parser.add_argument("--limit", type=int, default=None, help="Process only the first N discovered images")
    
    args = parser.parse_args()
    run_benchmark(data_dir=args.data_dir, limit=args.limit)
