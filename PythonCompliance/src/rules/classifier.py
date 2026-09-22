import re
from enum import Enum
from pydantic import BaseModel
from typing import List, Optional, Set, Tuple

from src.extract.schema import ExtractionStatus
from src.normalize.normalizer import NormalizedProductFields


class CategoryStatus(str, Enum):
    CONFIDENT = "CONFIDENT"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"


class CategoryResult(BaseModel):
    category: str
    status: CategoryStatus
    evidence: List[str] = []
    sub_category: Optional[str] = None  # "bidi" | "incense" | None (bidi_incense only)


# Define regular expressions for robust matching
# Avoid false positives using word boundaries or negative lookbehinds where needed.
_FOOD_PATTERNS = [
    r'\bfssai\b',
    r'\bveg\b',
    r'\bnon-veg\b',
    r'\bice\s*cream\b',
    r'\bsnack(s)?\b',
    r'\bfood\b',
]

_COSMETIC_PATTERNS = [
    r'(?<!ice\s)\bcream\b', # cream but not ice cream
    r'\bshampoo\b',
    r'\blotion\b',
    r'\bcosmetics?\b',
    r'\bface\s*wash\b',
    r'\blipstick\b',
    r'\buse\s*before\b', # spec says "use before date format/evidence"
    r'\bhair\s*oil\b',
]

_ALCOHOL_PATTERNS = [
    r'\bexcise\b',
    r'\bliquor\b',
    r'\bwhisky\b',
    r'\bbeer\b',
    r'\bwine\b',
    r'\balcohol\b',
]

_SEEDS_PATTERNS = [
    r'\bcertified\s*seeds?\b',
    r'\bseeds?\b',
]

_BIDI_INCENSE_PATTERNS = [
    r'\bbidi\b',
    r'\bincense\b',
    r'\bagarbatti\b',
]

# Sub-patterns used ONLY after category == "bidi_incense" is confirmed
_BIDI_SUB_PATTERNS = [
    re.compile(r'\bbidi\b', re.IGNORECASE),
]
_INCENSE_SUB_PATTERNS = [
    re.compile(r'\bincense\b', re.IGNORECASE),
    re.compile(r'\bagarbatti\b', re.IGNORECASE),
]

_LPG_CYLINDER_PATTERNS = [
    r'\b14\.2\s*kg\b',
    r'\b5\s*kg\b',
    r'\blpg\b',
    r'\bcylinder\b',
]

_CATEGORY_RULES = {
    "food": [re.compile(p, re.IGNORECASE) for p in _FOOD_PATTERNS],
    "cosmetic": [re.compile(p, re.IGNORECASE) for p in _COSMETIC_PATTERNS],
    "alcohol": [re.compile(p, re.IGNORECASE) for p in _ALCOHOL_PATTERNS],
    "seeds": [re.compile(p, re.IGNORECASE) for p in _SEEDS_PATTERNS],
    "bidi_incense": [re.compile(p, re.IGNORECASE) for p in _BIDI_INCENSE_PATTERNS],
    "lpg_cylinder": [re.compile(p, re.IGNORECASE) for p in _LPG_CYLINDER_PATTERNS],
}


def _is_low_confidence_field(status: ExtractionStatus, confidence: float) -> bool:
    return status in (ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS) or confidence < 0.6


def classify_category(fields: NormalizedProductFields) -> CategoryResult:
    """Classify the product category based on available extracted evidence."""
    
    # Collect all available text evidence
    # We look at fields that could contain category-defining text.
    evidence_sources: List[Tuple[str, str, bool]] = [] # (source_name, text, is_low_confidence)
    
    def _add_evidence(name: str, field_obj):
        if field_obj and field_obj.extracted_value and field_obj.status != ExtractionStatus.NOT_FOUND:
            is_lc = _is_low_confidence_field(field_obj.status, field_obj.extraction_confidence)
            evidence_sources.append((name, str(field_obj.extracted_value), is_lc))
            
    _add_evidence("product_name", fields.product_name)
    _add_evidence("category", fields.category)
    _add_evidence("fssai", fields.fssai)

    if not evidence_sources:
        return CategoryResult(category="general", status=CategoryStatus.CONFIDENT, evidence=[])

    matched_categories: Set[str] = set()
    high_conf_matched_categories: Set[str] = set()
    supporting_evidence: List[str] = []
    has_low_confidence_trigger = False

    for src_name, text, is_lc in evidence_sources:
        text_matched = False
        for cat_name, patterns in _CATEGORY_RULES.items():
            for p in patterns:
                if p.search(text):
                    matched_categories.add(cat_name)
                    if not is_lc:
                        high_conf_matched_categories.add(cat_name)
                    text_matched = True
        
        if text_matched:
            supporting_evidence.append(text)
            if is_lc:
                has_low_confidence_trigger = True
                
    # Evaluate matches. We only confidently adopt a category if it has at least one high-confidence match.
    keyword_result = None
    if len(high_conf_matched_categories) == 0:
        # Check if there were any low-confidence matches or if everything was just generic
        if len(matched_categories) > 0:
            # We had matches, but ONLY low confidence ones.
            keyword_result = CategoryResult(category="general", status=CategoryStatus.LOW_CONFIDENCE, evidence=supporting_evidence)
        else:
            # No matches at all
            all_lc = all(is_lc for _, _, is_lc in evidence_sources)
            status = CategoryStatus.LOW_CONFIDENCE if all_lc else CategoryStatus.CONFIDENT
            keyword_result = CategoryResult(category="general", status=status, evidence=[text for _, text, _ in evidence_sources])

    elif len(high_conf_matched_categories) == 1:
        cat = high_conf_matched_categories.pop()
        status = CategoryStatus.LOW_CONFIDENCE if has_low_confidence_trigger else CategoryStatus.CONFIDENT
        keyword_result = CategoryResult(category=cat, status=status, evidence=supporting_evidence)
        
    else:
        # Conflicting high-confidence evidence
        keyword_result = CategoryResult(category="general", status=CategoryStatus.LOW_CONFIDENCE, evidence=supporting_evidence)
        
    # Apply VLM Canonical Category Signal (Step 2)
    canonical_cat_value = None
    if hasattr(fields, "canonical_category") and fields.canonical_category and fields.canonical_category.extracted_value:
        if fields.canonical_category.status != ExtractionStatus.NOT_FOUND:
            v = str(fields.canonical_category.extracted_value).strip().lower()
            if v in ["food", "cosmetic", "alcohol", "bidi_incense", "lpg_cylinder"]:
                canonical_cat_value = v

    if canonical_cat_value:
        if canonical_cat_value == keyword_result.category or canonical_cat_value in matched_categories:
            # Agree (either matches the strict final keyword result, or was found as a weak keyword match)
            keyword_result.category = canonical_cat_value
            keyword_result.status = CategoryStatus.CONFIDENT
            if canonical_cat_value not in keyword_result.evidence:
                keyword_result.evidence.append(canonical_cat_value)
        else:
            # Disagree (trust VLM but flag for review)
            keyword_result.category = canonical_cat_value
            keyword_result.status = CategoryStatus.LOW_CONFIDENCE
            if canonical_cat_value not in keyword_result.evidence:
                keyword_result.evidence.append(canonical_cat_value)

    # Phase 2C: Bidi/Incense sub-category resolution
    # Only runs when top-level category resolved to bidi_incense.
    # Inspects the same evidence text already collected above.
    if keyword_result.category == "bidi_incense":
        # Collect all evidence text strings
        all_text = " ".join(keyword_result.evidence)
        has_bidi = any(p.search(all_text) for p in _BIDI_SUB_PATTERNS)
        has_incense = any(p.search(all_text) for p in _INCENSE_SUB_PATTERNS)
        if has_bidi and not has_incense:
            keyword_result.sub_category = "bidi"
        elif has_incense and not has_bidi:
            keyword_result.sub_category = "incense"
        # else: both or neither -> sub_category remains None

    return keyword_result
