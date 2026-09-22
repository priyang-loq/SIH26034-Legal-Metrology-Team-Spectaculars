import cv2
import os
import json
import logging
from src.preprocess.image_utils import preprocess_for_ocr, preprocess_grayscale_adaptive
from src.ocr.engine import OCREngine
from src.extract.extractor import extract_fields
from src.utils.visualize import draw_ocr_results, draw_extracted_fields
from src.config import Config
from src.normalize.normalizer import normalize_product_fields, NormalizedProductFields
from src.extract.schema import StructuredExtractionResult

# Both schema and normalizer are now fully loaded — resolve the forward reference.
StructuredExtractionResult.model_rebuild()


def enrich_with_database(structured_data, lookup_result):
    from src.extract.schema import ExtractedField, ExtractionStatus

    if not lookup_result or not lookup_result.get("success"):
        return structured_data

    structured_data.product_intelligence = lookup_result
    fields = structured_data.fields

    barcode = lookup_result.get("barcode")
    if barcode:
        fields.barcode = ExtractedField(status=ExtractionStatus.FOUND, extracted_value=barcode, source_text="Barcode Scanner")

    def _enrich(field_obj, db_val):
        if not db_val:
            return
        db_val_str = str(db_val).strip()
        if not db_val_str:
            return

        if field_obj.status == ExtractionStatus.NOT_FOUND or field_obj.extracted_value is None:
            field_obj.status = ExtractionStatus.FOUND
            field_obj.extracted_value = db_val_str
            field_obj.source_text = "Barcode Database Lookup"
            field_obj.extraction_confidence = 0.9
        else:
            existing_source = field_obj.source_text or "OCR"
            field_obj.source_text = f"{existing_source} | DB: {db_val_str}"

    _enrich(fields.product_name, lookup_result.get("product_name"))

    company = lookup_result.get("company")
    if company:
        _enrich(fields.manufacturer.name, company)

    qty = lookup_result.get("quantity")
    if qty:
        _enrich(fields.net_quantity, qty)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OCRPipeline:
    def __init__(self):
        logger.info("Initializing OCR Pipeline...")
        self.ocr_engine = OCREngine()

    def process_image(self, image_path: str, save_debug: bool = Config.DEBUG_MODE) -> str:
        """
        Runs the full pipeline on a single image and returns the JSON result.
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")

        logger.info(f"Processing image: {image_path}")
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to read image at {image_path}")

        # 1. Preprocessing
        # We start with standard preprocessing
        processed_img = preprocess_for_ocr(image)

        # 2. OCR Inference
        ocr_result = self.ocr_engine.extract_text(processed_img)

        # Fallback mechanism: if OCR didn't find much, try adaptive grayscale
        if len(ocr_result.results) < 3:
            logger.info("Standard preprocessing yielded very few results. Retrying with adaptive thresholding...")
            alt_img = preprocess_grayscale_adaptive(image)
            alt_ocr_result = self.ocr_engine.extract_text(alt_img)

            # If the fallback yields more results, use it
            if len(alt_ocr_result.results) > len(ocr_result.results):
                logger.info("Fallback preprocessing yielded better results. Using them.")
                processed_img = alt_img
                ocr_result = alt_ocr_result
                ocr_result.preprocessing_variant = "grayscale_adaptive"

        # 3. Field Extraction
        structured_data = extract_fields(ocr_result, image_path)

        # 3.5 VLM + Fusion
        if getattr(Config, 'USE_VLM', False):
            logger.info("Running VLM Extraction...")
            try:
                from src.ai.vlm import MockVLMExtractor, RealVLMExtractor
                from src.ai.response_parser import parse_vlm_response
                from src.fusion.fusion import fuse_results

                provider = getattr(Config, 'VLM_PROVIDER', 'mock').lower()
                if provider == 'real':
                    vlm_engine = RealVLMExtractor()
                else:
                    vlm_engine = MockVLMExtractor()

                vlm_dict = vlm_engine.extract(image_path, ocr_result)
                vlm_fields = parse_vlm_response(vlm_dict)

                logger.info("Fusing OCR and VLM results...")
                structured_data.fields = fuse_results(structured_data.fields, vlm_fields)
            except Exception as e:
                logger.error(f"VLM Extraction/Fusion failed: {e}")
                if not hasattr(structured_data, 'warnings'):
                    structured_data.warnings = []
                structured_data.warnings.append("AI_UNAVAILABLE")

                # Apply SOURCE_UNAVAILABLE for fields lacking deterministic extractors
                from src.extract.schema import ExtractionStatus
                fields = structured_data.fields
                vlm_only_fields = [
                    (fields, "product_name"),
                    (fields, "category"),
                    (fields, "canonical_category"),
                    (fields, "fssai"),
                    (fields.manufacturer, "name"),
                    (fields.manufacturer, "address"),
                    (fields.packer, "name"),
                    (fields.packer, "address"),
                    (fields.importer, "name"),
                    (fields.importer, "address"),
                    (fields.consumer_care, "name"),
                    (fields.consumer_care, "address"),
                    (fields.consumer_care, "phone"),
                    (fields.consumer_care, "email"),
                ]
                for parent, attr in vlm_only_fields:
                    field_obj = getattr(parent, attr)
                    if field_obj.status == ExtractionStatus.NOT_FOUND:
                        field_obj.status = ExtractionStatus.SOURCE_UNAVAILABLE

        # 3.8 Barcode / Product Intelligence Enrichment
        logger.info("Running Barcode/QR scan and Product Lookup...")
        try:
            from src.barcode.barcode_scanner import scan_barcode
            from src.barcode.qr_scanner import scan_qr
            from src.barcode.product_lookup import lookup_product

            lookup_result = None
            barcode_res = scan_barcode(image)
            if barcode_res.get("detected") and barcode_res.get("data"):
                lookup_result = lookup_product(barcode_res["data"])
            else:
                qr_res = scan_qr(image)
                if qr_res.get("detected") and qr_res.get("data"):
                    lookup_result = lookup_product(qr_res["data"])

            if lookup_result:
                enrich_with_database(structured_data, lookup_result)

        except Exception as e:
            logger.error(f"Barcode/Lookup failed: {e}")
            if not hasattr(structured_data, 'warnings'):
                structured_data.warnings = []
            structured_data.warnings.append("BARCODE_LOOKUP_FAILED")

        # 4. Debug Visualization
        if save_debug:
            base_name = os.path.basename(image_path)
            name, ext = os.path.splitext(base_name)

            ocr_debug_path = os.path.join(Config.OUTPUT_DIR, f"{name}_debug_ocr{ext}")
            fields_debug_path = os.path.join(Config.OUTPUT_DIR, f"{name}_debug_fields{ext}")

            img_ocr_drawn = draw_ocr_results(processed_img, ocr_result)
            img_fields_drawn = draw_extracted_fields(processed_img, structured_data)

            cv2.imwrite(ocr_debug_path, img_ocr_drawn)
            cv2.imwrite(fields_debug_path, img_fields_drawn)
            logger.info(f"Saved debug images to {Config.OUTPUT_DIR}")

        # Normalize nested structures into canonical ExtractedFields
        structured_data.fields = normalize_product_fields(structured_data.fields)

        # Convert to JSON string
        return structured_data.model_dump_json(indent=4)
