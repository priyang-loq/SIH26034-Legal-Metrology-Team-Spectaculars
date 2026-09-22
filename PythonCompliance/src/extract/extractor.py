from typing import List, Optional, Set, Dict
from src.ocr.normalization import NormalizedOCRResult
from src.extract.schema import ProductFields, ExtractedField, StructuredExtractionResult, ExtractionStatus
from src.extract.rules import extract_mrp, extract_net_quantity, extract_all_dates, extract_batch, extract_usp, extract_country_and_import_status

def extract_fields(ocr_data: NormalizedOCRResult, image_path: str) -> StructuredExtractionResult:
    """
    Takes normalized OCR results and extracts all defined fields.
    Maintains a set of claimed indices to prevent overlapping extractions.
    """
    results = ocr_data.results
    fields = ProductFields()
    claimed_indices: Set[int] = set()
    
    # 1. Net Quantity
    fields.net_quantity, claimed = extract_net_quantity(results, claimed_indices)
    claimed_indices.update(claimed)
        
    # 2. MRP
    fields.mrp, claimed = extract_mrp(results, claimed_indices)
    claimed_indices.update(claimed)
        
    # 3. Dates (Mfg and Exp)
    fields.manufacturing_date, fields.expiry_date, claimed_dates = extract_all_dates(results, claimed_indices)
    claimed_indices.update(claimed_dates)
    
    # Chronological validation
    if fields.manufacturing_date.status == ExtractionStatus.FOUND and fields.expiry_date.status == ExtractionStatus.FOUND:
        try:
            from datetime import datetime
            def parse_dt(dstr):
                # Try multiple formats
                for fmt in ["%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d.%m.%Y", "%m/%Y", "%m/%y"]:
                    try: return datetime.strptime(dstr, fmt)
                    except ValueError: pass
                return None
                
            mfg_dt = parse_dt(fields.manufacturing_date.extracted_value)
            exp_dt = parse_dt(fields.expiry_date.extracted_value)
            
            if mfg_dt and exp_dt and mfg_dt > exp_dt:
                # Contradiction
                fields.manufacturing_date.status = ExtractionStatus.AMBIGUOUS
                fields.expiry_date.status = ExtractionStatus.AMBIGUOUS
        except Exception:
            pass
        
    # 4. Batch Number
    fields.batch_number, claimed = extract_batch(results, claimed_indices)
    claimed_indices.update(claimed)
        
    # 5. USP
    fields.unit_sale_price, claimed = extract_usp(results, claimed_indices)
    claimed_indices.update(claimed)
        
    # 6. Country of Origin & Import Status
    fields.country_of_origin, fields.import_status, claimed = extract_country_and_import_status(results, claimed_indices)
    claimed_indices.update(claimed)
        
    return StructuredExtractionResult(
        image_path=image_path,
        ocr_info=ocr_data,
        fields=fields
    )
