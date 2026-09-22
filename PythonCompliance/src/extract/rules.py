import re
import difflib
from typing import List, Tuple, Set, Optional, Dict, Any
from src.ocr.normalization import OCRText
from src.extract.schema import ExtractedField, ExtractionStatus

def _is_ocr_variant(text: str, keyword: str) -> bool:
    word = re.sub(r'[^a-z]', '', text.lower())
    keyword = re.sub(r'[^a-z]', '', keyword.lower())
    if not word or not keyword: return False
    
    if word == keyword: return True
    if len(keyword) >= 3 and len(word) >= 3:
        if difflib.SequenceMatcher(None, word, keyword).ratio() >= 0.75:
            return True
        if len(keyword) <= 4 and difflib.SequenceMatcher(None, word, keyword).ratio() >= 0.65:
            return True
            
        if len(word) > len(keyword):
            for i in range(len(word) - len(keyword) + 1):
                window = word[i:i+len(keyword)]
                if difflib.SequenceMatcher(None, window, keyword).ratio() >= 0.75:
                    return True
    return False

def _is_valid_date(date_str: str) -> bool:
    patterns = [
        r'^(0?[1-9]|[12][0-9]|3[01])[/\-\.](0?[1-9]|1[0-2])[/\-\.](?:20)?[0-9]{2}$',
        r'^(0?[1-9]|1[0-2])[/\-](?:20)?[0-9]{2}$'
    ]
    cleaned = re.sub(r'^[#\s]+', '', date_str.strip()).rstrip('.,; ')
    return any(re.match(p, cleaned) for p in patterns)

def _is_in_nutrition_table(results: List[OCRText], idx: int) -> bool:
    start = max(0, idx - 5)
    end = min(len(results), idx + 6)
    nutrition_keywords = ["energy", "protein", "carbohydrate", "fat", "sugar", "sodium", "kcal", "cholesterol", "per 100", "composition"]
    for i in range(start, end):
        text_lower = results[i].text.lower()
        if any(k in text_lower for k in nutrition_keywords):
            return True
    return False

def _find_closest_number(results: List[OCRText], keyword_idx: int, claimed_indices: Set[int]) -> Tuple[Optional[str], float, List[int]]:
    start = max(0, keyword_idx - 3)
    end = min(len(results), keyword_idx + 5)
    
    best_val, best_conf, best_idx = None, 0.0, -1
    for i in range(start, end):
        if i == keyword_idx or i in claimed_indices: continue
        text = results[i].text
        if _is_valid_date(text): continue
        if re.search(r'\b[0-2]?[0-9]:[0-5][0-9]\b', text): continue
        
        text_clean = text.replace("=", ".")
        # Remove toll-free numbers to prevent false MRP matches
        text_clean = re.sub(r'\b1800(?:[-\.\s]*\d{2,5})+\b', '', text_clean)
        
        matches = re.finditer(r'(?:rs\.?|₹|inr)?\s*([0-9]+\.?[0-9]*)', text_clean, re.IGNORECASE)
        for match in matches:
            val_str = match.group(1)
            if val_str.endswith('.'): val_str = val_str[:-1]
            if not val_str: continue
            
            if val_str.startswith('0') and not val_str.startswith('0.'): continue
            if len(val_str.replace('.', '')) > 5: continue
            if len(val_str) == 1: continue
            
            dist = abs(i - keyword_idx)
            direction_penalty = 0.0 if i > keyword_idx else 0.05
            conf = 0.8 - (dist * 0.1) - direction_penalty
            
            if any(bad in text.lower() for bad in ["%", "ml", "g", "kg", "batch", "lot", "/g"]):
                conf *= 0.1
                
            if conf > best_conf:
                best_val, best_conf, best_idx = val_str, conf, i
                
    if best_val:
        return best_val, best_conf, [best_idx]
    return None, 0.0, []

def _is_bare_year(val: str) -> bool:
    return bool(re.match(r'^202[3-9]$|^203[0-5]$', val))

def extract_mrp(results: List[OCRText], claimed_indices: Set[int]) -> Tuple[ExtractedField, List[int]]:
    best_val, best_conf, best_evidence, best_indices = None, 0.0, [], []
    mrp_keywords = ["mrp", "m.r.p", "mrp:", "rs.", "rs", "₹", "inr", "maximumretailprice", "price"]
    
    for i, item in enumerate(results):
        if i in claimed_indices: continue
        text = item.text
        text_lower = text.lower().replace(" ", "")
        
        is_nutrition = _is_in_nutrition_table(results, i)
        penalty = 0.5 if is_nutrition else 1.0
        
        if any(bad in text_lower for bad in ["per", "serve", "%", "ml", "g", "kg", "batch", "lot"]):
            penalty *= 0.1
            
        if any(k in text_lower for k in mrp_keywords):
            clean_text = text.replace("=", ".").replace("<", " ")
            # Remove toll-free numbers
            clean_text = re.sub(r'\b1800(?:[-\.\s]*\d{2,5})+\b', '', clean_text)
            pattern = r'(?:m\.?r\.?p\.?|rs\.?|₹|inr|price)[:\-\s]*([0-9]+\.[0-9]{2}|[0-9]+)'
            match = re.search(pattern, clean_text, re.IGNORECASE)
            if match:
                val = match.group(1)
                conf = 0.9 * item.confidence * penalty
                if _is_bare_year(val): conf *= 0.1
                if conf > best_conf:
                    best_val, best_conf, best_evidence, best_indices = val, conf, [item], [i]
                continue
                
            val, ext_conf, indices = _find_closest_number(results, i, claimed_indices)
            if val:
                conf = ext_conf * item.confidence * penalty
                if _is_bare_year(val): conf *= 0.1
                if conf > best_conf:
                    best_val, best_conf, best_evidence, best_indices = val, conf, [item, results[indices[0]]], [i] + indices
                continue
                
            if "₹" in clean_text or "rs." in text_lower or re.search(r'\brs\b', item.text.lower()):
                # Re-clean for the fallback regex
                clean_text = re.sub(r'\b1800(?:[-\.\s]*\d{2,5})+\b', '', clean_text)
                match = re.search(r'(?:₹|rs\.?)\s*([0-9]+\.?[0-9]*)', clean_text, re.IGNORECASE)
                if match:
                    val = match.group(1)
                    conf = 0.8 * item.confidence * penalty
                    if _is_bare_year(val): conf *= 0.1
                    if conf > best_conf:
                        best_val, best_conf, best_evidence, best_indices = val, conf, [item], [i]

    if not best_val:
        for i, item in enumerate(results):
            if i in claimed_indices: continue
            text_lower = item.text.lower()
            if "weight" in text_lower or "net" in text_lower or re.search(r'[0-9]\s*(g|kg|ml|l)\b', text_lower):
                continue
            is_nutrition = _is_in_nutrition_table(results, i)
            
            text = item.text.replace("=", ".").replace("<", " ")
            text = re.sub(r'\b1800(?:[-\.\s]*\d{2,5})+\b', '', text)
            match = re.search(r'(?:^|[^0-9\.])([1-9][0-9]{1,3}\.00)(?:$|[^0-9\.])', text)
            if match:
                val = match.group(1)
                conf = 0.5 * item.confidence
                if is_nutrition:
                    conf *= 0.5
                if _is_bare_year(val): conf *= 0.1
                if conf > best_conf:
                    best_val, best_conf, best_evidence, best_indices = val, conf, [item], [i]

    if best_val and best_conf >= 0.1:
        return ExtractedField(
            status=ExtractionStatus.FOUND,
            extracted_value=best_val, normalized_value=best_val,
            source_text=" ".join(e.text for e in best_evidence), evidence=best_evidence,
            extraction_confidence=best_conf, bbox=best_evidence[0].bbox
        ), best_indices
        
    deferral_keywords = ["see bottom", "see back", "see cap", "printed below", "see the bottom"]
    has_deferral = False
    deferral_evidence = []
    has_mrp_kw = False
    for i, item in enumerate(results):
        text_lower = item.text.lower()
        if any(k in text_lower.replace(" ", "") for k in [dk.replace(" ", "") for dk in deferral_keywords]) or (("see" in text_lower or "bottom" in text_lower) and len(text_lower) < 15):
            has_deferral = True
            deferral_evidence.append(item)
        if any(k in text_lower.replace(" ", "") for k in mrp_keywords):
            has_mrp_kw = True
            
    if has_deferral and has_mrp_kw:
        return ExtractedField(status=ExtractionStatus.DEFERRED_TO_OTHER_SURFACE, evidence=deferral_evidence), []
        
    return ExtractedField(status=ExtractionStatus.NOT_FOUND), []

def extract_net_quantity(results: List[OCRText], claimed_indices: Set[int]) -> Tuple[ExtractedField, List[int]]:
    best_val, best_norm, best_unit, best_conf = None, None, None, 0.0
    best_evidence, best_indices = [], []
    for i, item in enumerate(results):
        if i in claimed_indices: continue
        text = item.text.lower()
        
        if any(bad in text for bad in ["per 100", "composition", "energy", "protein", "serve", "serving", "free", "allowance"]):
            continue
            
        pattern = r'\b([0-9]+\.?[0-9]*)\s*(g|kg|ml|l|liter|litre|gm|gms|grams)\b'
        match = re.search(pattern, text)
        if match:
            num_str = match.group(1)
            raw_unit = match.group(2)
            try: num = float(num_str)
            except ValueError: continue
            unit, norm_val = "g", num
            if raw_unit in ["kg"]: unit, norm_val = "g", num * 1000
            elif raw_unit in ["l", "liter", "litre"]: unit, norm_val = "ml", num * 1000
            elif raw_unit in ["ml"]: unit, norm_val = "ml", num
                
            start_idx = max(0, i - 3)
            end_idx = min(len(results), i + 4)
            context_text = " ".join(r.text.lower() for r in results[start_idx:end_idx])
            
            dosage_keywords = ["dosage", "dose", "children", "adults", "take", "serving", "each", "contains", "per 5 ml", "per 10 ml"]
            net_keywords = ["net volume", "net weight", "net qty", "net quantity", "contents", "net", "qty", "weight", "wt", "volume"]
            
            if any(k in context_text for k in dosage_keywords):
                conf = 0.1 * item.confidence
            elif any(k in context_text for k in net_keywords):
                conf = 0.95 * item.confidence
            else:
                conf = 0.5 * item.confidence
                
            if conf > best_conf:
                best_val, best_norm, best_unit, best_conf = match.group(0), str(norm_val), unit, conf
                best_evidence, best_indices = [item], [i]
                
    if best_val:
        return ExtractedField(
            status=ExtractionStatus.FOUND if best_conf >= 0.5 else ExtractionStatus.LOW_CONFIDENCE,
            extracted_value=best_val, normalized_value=best_norm, unit=best_unit,
            source_text=best_evidence[0].text, evidence=best_evidence,
            extraction_confidence=best_conf, bbox=best_evidence[0].bbox
        ), best_indices
    return ExtractedField(status=ExtractionStatus.NOT_FOUND), []



def _get_y_center(item: OCRText) -> float:
    return sum(p[1] for p in item.bbox.points) / 4.0

def extract_all_dates(results: List[OCRText], claimed_indices: Set[int]) -> Tuple[ExtractedField, ExtractedField, List[int]]:
    mfg_keywords = ["mfg", "manufacturing", "pkd", "packed", "date of manufacture", "mfd"]
    exp_keywords = ["exp", "expiry", "use by", "best before", "expires"]
    date_pattern = r'(?<!\d)((?:0?[1-9]|[12][0-9]|3[01])[/\-\.](?:0?[1-9]|1[0-2])[/\-\.](?:20)?[0-9]{2}|(?:0?[1-9]|1[0-2])[/\-](?:20)?[0-9]{2})(?!\d)'
    deferral_keywords = ["see bottom", "see back", "see cap", "printed below", "see the bottom"]
    
    mfg_kw_items, exp_kw_items = [], []
    date_candidates = []
    has_deferral = False
    deferral_evidence = []
    
    for i, item in enumerate(results):
        text_lower = item.text.lower()
        text_nospace = text_lower.replace(" ", "")
        text_no_date = re.sub(date_pattern, '', text_lower)
        
        if any(_is_ocr_variant(text_no_date, k) for k in mfg_keywords): 
            mfg_kw_items.append((i, item))
        if any(_is_ocr_variant(text_no_date, k) for k in exp_keywords): 
            exp_kw_items.append((i, item))
        if any(k.replace(" ", "") in text_nospace for k in deferral_keywords) or (("see" in text_lower or "bottom" in text_lower) and len(text_lower) < 15):
            has_deferral = True
            deferral_evidence.append(item)
            
    for i, item in enumerate(results):
        # Allow dates to be found in tokens claimed by MRP (e.g. "* 10.00,  0.14 per g #02/26")
        # Strip toll-free numbers so sub-segments like 10-22 aren't matched as dates
        text = re.sub(r'\b1800(?:[-\.\s]*\d{2,5})+\b', '', item.text)
        matches = list(re.finditer(date_pattern, text))
        for match in matches:
            val = match.group(1)
            if _is_valid_date(val):
                date_candidates.append({'val': val, 'idx': i, 'item': item, 'y': _get_y_center(item)})
                
    mfg_field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    exp_field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    claimed = []
    
    if not date_candidates and has_deferral and (mfg_kw_items or exp_kw_items):
        if mfg_kw_items:
            mfg_field.status = ExtractionStatus.DEFERRED_TO_OTHER_SURFACE
            mfg_field.evidence = deferral_evidence
        if exp_kw_items:
            exp_field.status = ExtractionStatus.DEFERRED_TO_OTHER_SURFACE
            exp_field.evidence = deferral_evidence
        return mfg_field, exp_field, []
        
    if not date_candidates:
        return mfg_field, exp_field, []

    if (mfg_kw_items or exp_kw_items) and date_candidates:
        all_kw = []
        for i, item in mfg_kw_items: all_kw.append({'type': 'mfg', 'item': item, 'idx': i, 'y': _get_y_center(item)})
        for i, item in exp_kw_items: all_kw.append({'type': 'exp', 'item': item, 'idx': i, 'y': _get_y_center(item)})
        
        all_kw.sort(key=lambda x: x['y'])
        date_candidates.sort(key=lambda x: x['y'])
        
        for k_obj, d_obj in zip(all_kw, date_candidates):
            f = ExtractedField(
                status=ExtractionStatus.FOUND, extracted_value=d_obj['val'], normalized_value=d_obj['val'],
                source_text=f"{k_obj['item'].text} {d_obj['item'].text}", evidence=[k_obj['item'], d_obj['item']],
                extraction_confidence=0.8, bbox=d_obj['item'].bbox
            )
            if k_obj['type'] == 'mfg' and mfg_field.status != ExtractionStatus.FOUND: 
                mfg_field = f
                claimed.extend([k_obj['idx'], d_obj['idx']])
            elif k_obj['type'] == 'exp' and exp_field.status != ExtractionStatus.FOUND: 
                exp_field = f
                claimed.extend([k_obj['idx'], d_obj['idx']])
            
    return mfg_field, exp_field, list(set(claimed))

def extract_batch(results: List[OCRText], claimed_indices: Set[int]) -> Tuple[ExtractedField, List[int]]:
    best_val, best_conf, best_evidence, best_indices = None, 0.0, [], []
    for i, item in enumerate(results):
        text = item.text
        text_lower = text.lower()
        
        if any(kw in text_lower for kw in ["query", "feedback", "toll free", "toll-free", "consumer care", "care"]):
            continue
            
        if re.search(r'\b(?:batch|lot|pkd[,\.]code)\b', text_lower):
            match = re.search(r'\b(?:batch|lot|pkd[,\.]code)\b\s*(?:no\.?|number)?[:\-]?\s*([A-Za-z0-9]{4,})', text, re.IGNORECASE)
            if match:
                val = match.group(1)
                if val.lower() not in ["number", "no", "see", "below", "refer", "and", "date"]:
                    if not _is_valid_date(val):
                        conf = 0.9 * item.confidence
                        if conf > best_conf: best_val, best_conf, best_evidence, best_indices = val, conf, [item], [i]
                        continue
            if i + 1 < len(results) and (i + 1) not in claimed_indices:
                next_text = results[i+1].text
                match = re.search(r'^([A-Za-z0-9]{4,})', next_text)
                if match:
                    val = match.group(1)
                    if not _is_valid_date(val) and val.lower() not in ["number", "no", "see", "date"]:
                        conf = 0.8 * results[i+1].confidence
                        if conf > best_conf: best_val, best_conf, best_evidence, best_indices = val, conf, [item, results[i+1]], [i, i+1]
                        continue
        
        date_pattern = r'(?<!\d)((?:0?[1-9]|[12][0-9]|3[01])[/\-\.](?:0?[1-9]|1[0-2])[/\-\.](?:20)?[0-9]{2}|(?:0?[1-9]|1[0-2])[/\-](?:20)?[0-9]{2})(?!\d)'
        if re.search(date_pattern, text):
            parts = text.split()
            if len(parts) >= 2 and not re.search(date_pattern, parts[0]) and len(parts[0]) >= 4:
                val = parts[0]
                if not _is_valid_date(val) and val.lower() not in ["mfg", "exp", "lot", "batch", "date"]:
                    conf = 0.6 * item.confidence
                    if conf > best_conf: best_val, best_conf, best_evidence, best_indices = val, conf, [item], [i]
                    
    if best_val:
        return ExtractedField(
            status=ExtractionStatus.FOUND, extracted_value=best_val, normalized_value=best_val,
            source_text=" ".join(e.text for e in best_evidence), evidence=best_evidence,
            extraction_confidence=best_conf, bbox=best_evidence[-1].bbox
        ), best_indices
    return ExtractedField(status=ExtractionStatus.NOT_FOUND), []
import re
from typing import List, Tuple, Set
from src.ocr.normalization import OCRText
from src.extract.schema import ExtractedField, ExtractionStatus

def extract_usp(results: List[OCRText], claimed_indices: Set[int]) -> Tuple[ExtractedField, List[int]]:
    best_val, best_conf, best_evidence, best_indices = None, 0.0, [], []
    pattern = r'(?:rs\.?|₹|inr)?\s*([0-9]+\.?[0-9]*)\s*(?:/|per)\s*(g|kg|ml|l|liter|litre|cm|m|unit|number|n|1n|1u|u)\b'
    
    for i, item in enumerate(results):
        # We do NOT skip claimed_indices here because a token might contain both USP and Date
        # e.g., "0.14 per g #02/26"
        text = item.text.lower()
        
        match = re.search(pattern, text)
        if match:
            val = match.group(0).strip()
            conf = 0.9 * item.confidence
            if conf > best_conf:
                best_val, best_conf, best_evidence, best_indices = val, conf, [item], [i]
        elif i + 1 < len(results):
            # We also allow inspecting claimed_indices for i+1
            combined_text = text + " " + results[i+1].text.lower()
            match = re.search(pattern, combined_text)
            if match:
                val = match.group(0).strip()
                conf = 0.8 * min(item.confidence, results[i+1].confidence)
                if conf > best_conf:
                    best_val, best_conf, best_evidence, best_indices = val, conf, [item, results[i+1]], [i, i+1]
                    
    if best_val:
        return ExtractedField(
            status=ExtractionStatus.FOUND,
            extracted_value=best_val, normalized_value=best_val,
            source_text=" ".join([e.text for e in best_evidence]), evidence=best_evidence,
            extraction_confidence=best_conf, bbox=best_evidence[0].bbox
        ), best_indices
    return ExtractedField(status=ExtractionStatus.NOT_FOUND), []

def extract_country_and_import_status(results: List[OCRText], claimed_indices: Set[int]) -> Tuple[ExtractedField, ExtractedField, List[int]]:
    best_coo, best_is = None, None
    best_conf, best_evidence, best_indices = 0.0, [], []
    
    domestic_pattern = r'\b(?:made.{0,20}in|country\s*of\s*origin\s*[:\-]?|mfg\s*in|product\s*of|manufactured\s*in|product\s*made\s*in)\s*india\b'
    imported_pattern = r'\b(?:made.{0,20}in|country\s*of\s*origin\s*[:\-]?|mfg\s*in|product\s*of|manufactured\s*in|product\s*made\s*in)\s+([a-z]{2,})\b'
    
    for i in range(len(results)):
        if i in claimed_indices: continue
        
        current_text = ""
        current_evidence = []
        current_indices = []
        
        for j in range(i, min(len(results), i + 4)):
            if j in claimed_indices: break
            current_text += (" " if current_text else "") + results[j].text.lower()
            current_evidence.append(results[j])
            current_indices.append(j)
            
            match_dom = re.search(domestic_pattern, current_text)
            if match_dom:
                conf = sum(e.confidence for e in current_evidence) / len(current_evidence)
                conf = conf * (1.0 - 0.05 * (len(current_evidence) - 1))
                if conf > best_conf:
                    best_conf = conf
                    best_coo = "India"
                    best_is = "DOMESTIC"
                    best_evidence = list(current_evidence)
                    best_indices = list(current_indices)
                break
                
            match_imp = re.search(imported_pattern, current_text)
            if match_imp:
                country = match_imp.group(1).capitalize()
                if country.lower() != "india" and country.lower() not in ["this", "the", "a", "an", "all"]:
                    conf = sum(e.confidence for e in current_evidence) / len(current_evidence)
                    conf = conf * (1.0 - 0.05 * (len(current_evidence) - 1))
                    if conf > best_conf:
                        best_conf = conf
                        best_coo = country
                        best_is = "IMPORTED"
                        best_evidence = list(current_evidence)
                        best_indices = list(current_indices)
                    break
                    
    coo_field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    is_field = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    
    if best_coo:
        source_text = " ".join([e.text for e in best_evidence])
        coo_field = ExtractedField(
            status=ExtractionStatus.FOUND,
            extracted_value=best_coo, normalized_value=best_coo,
            source_text=source_text, evidence=best_evidence,
            extraction_confidence=best_conf, bbox=best_evidence[0].bbox
        )
        is_field = ExtractedField(
            status=ExtractionStatus.FOUND,
            extracted_value=best_is, normalized_value=best_is,
            source_text=source_text, evidence=best_evidence,
            extraction_confidence=best_conf, bbox=best_evidence[0].bbox
        )
        
    return coo_field, is_field, best_indices

