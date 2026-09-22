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
from src.ai.vlm import MockVLMExtractor
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
    if field_name in ["mrp", "net_quantity", "manufacturing_date", "expiry_date", "product_name", "category"]:
        return getattr(fields_obj, field_name).extracted_value
    elif field_name.startswith("manufacturer_"):
        return getattr(fields_obj.manufacturer, field_name.split("_")[1]).extracted_value
    elif field_name.startswith("packer_"):
        return getattr(fields_obj.packer, field_name.split("_")[1]).extracted_value
    elif field_name.startswith("importer_"):
        return getattr(fields_obj.importer, field_name.split("_")[1]).extracted_value
    elif field_name.startswith("consumer_care_"):
        return getattr(fields_obj.consumer_care, field_name.replace("consumer_care_", "")).extracted_value
    return None

def run_silver(data_dir: str):
    logger.info("Running SILVER evaluation (generating predictions only)...")
    pipeline = OCRPipeline()
    vlm_engine = MockVLMExtractor()
    silver_results = {}
    
    imgs = []
    for root_dir, _, files in os.walk(data_dir):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                rel_path = os.path.relpath(os.path.join(root_dir, file), data_dir).replace("\\", "/")
                imgs.append(rel_path)
                
    for rel_path in imgs:
        img_path = os.path.join(data_dir, rel_path)
        logger.info(f"Processing {img_path}...")
        
        try:
            Config.USE_VLM = False
            img = cv2.imread(img_path)
            if img is None:
                continue
                
            processed_img = preprocess_for_ocr(img)
            ocr_result = pipeline.ocr_engine.extract_text(processed_img)
            baseline_fields_obj = extract_fields(ocr_result, img_path).fields
            
            vlm_dict = vlm_engine.extract(img_path, ocr_result)
            vlm_fields_obj = parse_vlm_response(vlm_dict)
            
            fused_fields_obj = fuse_results(baseline_fields_obj, vlm_fields_obj)
            
            img_res = {"Baseline": {}, "VLM": {}, "Fusion": {}}
            for f in FIELDS:
                img_res["Baseline"][f] = get_val(baseline_fields_obj, f)
                img_res["VLM"][f] = get_val(vlm_fields_obj, f)
                img_res["Fusion"][f] = get_val(fused_fields_obj, f)
                
            silver_results[rel_path] = img_res
        except Exception as e:
            logger.error(f"Failed processing {img_path}: {e}")
            
    out_path = os.path.join(os.path.dirname(__file__), "silver_predictions.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(silver_results, f, indent=4)
        
    logger.info(f"Silver predictions saved to {out_path}")

def run_gold(ground_truth_path: str, data_dir: str):
    logger.info("Running GOLD evaluation (strict metrics)...")
    if not os.path.exists(ground_truth_path):
        logger.error(f"Gold ground truth {ground_truth_path} not found. Run annotate.py to create it.")
        sys.exit(1)
        
    with open(ground_truth_path, 'r', encoding='utf-8') as f:
        ground_truth = json.load(f)

    pipeline = OCRPipeline()
    vlm_engine = MockVLMExtractor()
    
    metrics_schema = {
        "correct": 0, "incorrect": 0, "missing": 0, 
        "NOT_PRESENT": 0, "UNREADABLE": 0, "ambiguous": 0
    }
    
    systems = {"Baseline": {}, "VLM": {}, "Fusion": {}}
    for sys_name in systems:
        for f in FIELDS:
            systems[sys_name][f] = dict(metrics_schema)

    for rel_path, img_data in ground_truth.items():
        img_path = os.path.join(data_dir, rel_path)
        if not os.path.exists(img_path):
            continue
            
        logger.info(f"Evaluating {img_path}...")
        try:
            Config.USE_VLM = False
            img = cv2.imread(img_path)
            processed_img = preprocess_for_ocr(img)
            ocr_result = pipeline.ocr_engine.extract_text(processed_img)
            baseline_fields_obj = extract_fields(ocr_result, img_path).fields
            
            vlm_dict = vlm_engine.extract(img_path, ocr_result)
            vlm_fields_obj = parse_vlm_response(vlm_dict)
            
            fused_fields_obj = fuse_results(baseline_fields_obj, vlm_fields_obj)
        except Exception as e:
            logger.error(f"Failed processing {img_path}: {e}")
            continue

        for field_name in FIELDS:
            if field_name not in img_data:
                continue
                
            gt_field = img_data[field_name]
            expected_val = gt_field.get("value")
            expected_status = gt_field.get("status")
            
            if expected_status == "UNREADABLE":
                for sys_name in systems:
                    systems[sys_name][field_name]["UNREADABLE"] += 1
                continue

            for sys_name, fields_obj in [("Baseline", baseline_fields_obj), ("VLM", vlm_fields_obj), ("Fusion", fused_fields_obj)]:
                def get_field_obj(f_obj, f_name):
                    if f_name in ["mrp", "net_quantity", "manufacturing_date", "expiry_date", "product_name", "category"]:
                        return getattr(f_obj, f_name)
                    elif f_name.startswith("manufacturer_"):
                        return getattr(f_obj.manufacturer, f_name.split("_")[1])
                    elif f_name.startswith("packer_"):
                        return getattr(f_obj.packer, f_name.split("_")[1])
                    elif f_name.startswith("importer_"):
                        return getattr(f_obj.importer, f_name.split("_")[1])
                    elif f_name.startswith("consumer_care_"):
                        return getattr(f_obj.consumer_care, f_name.replace("consumer_care_", ""))
                    return None
                    
                actual_obj = get_field_obj(fields_obj, field_name)
                actual_val = actual_obj.extracted_value if actual_obj else None
                actual_status = actual_obj.status.value if actual_obj else "NOT_FOUND"
                
                if actual_status == "AMBIGUOUS":
                    systems[sys_name][field_name]["ambiguous"] += 1
                
                if expected_status == "NOT_PRESENT":
                    systems[sys_name][field_name]["NOT_PRESENT"] += 1
                    if actual_val is None:
                        systems[sys_name][field_name]["correct"] += 1
                    else:
                        systems[sys_name][field_name]["incorrect"] += 1
                elif expected_status == "VERIFIED":
                    if actual_val is None:
                        systems[sys_name][field_name]["missing"] += 1
                    elif is_match(expected_val, actual_val, field_name):
                        systems[sys_name][field_name]["correct"] += 1
                    else:
                        systems[sys_name][field_name]["incorrect"] += 1

    print("\n" + "="*95)
    print(f"{'Field':<25s} | {'Baseline (Acc)':<20s} | {'VLM (Acc)':<20s} | {'Fusion (Acc)':<20s}")
    print("-" * 95)
    
    for f in FIELDS:
        totals = {}
        for sys_name in ["Baseline", "VLM", "Fusion"]:
            m = systems[sys_name][f]
            totals[sys_name] = m["correct"] + m["incorrect"] + m["missing"]
            
        if totals["Baseline"] == 0:
            continue
            
        accs = []
        for sys_name in ["Baseline", "VLM", "Fusion"]:
            m = systems[sys_name][f]
            t = totals[sys_name]
            acc = (m["correct"] / t * 100) if t > 0 else 0
            accs.append(f"{acc:.1f}% ({m['correct']}/{t})")
            
        print(f"{f:<25s} | {accs[0]:<20s} | {accs[1]:<20s} | {accs[2]:<20s}")
    print("="*95 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate OCR/VLM Pipeline")
    parser.add_argument("--mode", type=str, choices=["silver", "gold"], required=True, help="silver for development predictions, gold for metrics against ground truth")
    args = parser.parse_args()
    
    gt_path = os.path.join(os.path.dirname(__file__), "ground_truth.json")
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test_images")
    
    if args.mode == "silver":
        run_silver(data_dir)
    elif args.mode == "gold":
        run_gold(gt_path, data_dir)
