import re
import logging
from typing import Optional
from src.extract.schema import ProductFields, ExtractedField, ExtractionStatus

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.6

# ---------------------------------------------------------------------------
# Normalisation helpers – return a canonical string or None on failure.
# Two values are "format-equivalent" when their canonical forms match.
# ---------------------------------------------------------------------------

_MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

def _normalize_date(val: str) -> Optional[str]:
    """Return a canonical (MM, YYYY) tuple string, or None if unparseable.

    Handles formats such as:
      "01/28"         -> (1, 2028)
      "01/2028"       -> (1, 2028)
      "January 2028"  -> (1, 2028)
      "Jan 2028"      -> (1, 2028)
      "Jan/2028"      -> (1, 2028)
      "2028/01"       -> (1, 2028)
      "01-2028"       -> (1, 2028)
    """
    v = re.sub(r'^[#\s]+', '', val.strip()).rstrip('.,; ').lower()

    # Try "Month YYYY" or "Month/YYYY"
    m = re.match(r'^([a-z]+)[\s/\-,]+(\d{2,4})$', v)
    if m:
        month_name, year_str = m.group(1), m.group(2)
        month = _MONTH_MAP.get(month_name)
        if month:
            year = int(year_str)
            if year < 100:
                year += 2000
            return f"({month:02d},{year})"

    # Try numeric: MM/YY, MM/YYYY, YYYY/MM, MM-YY, MM-YYYY
    m = re.match(r'^(\d{1,2})[/\-\.](\d{2,4})$', v)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        # Distinguish MM/YY from YYYY/MM
        if a > 12:
            # a is likely a year — treat as YYYY/MM
            year, month = a, b
        elif b > 31:
            # b is a year
            year = b if b >= 100 else b + 2000
            month = a
        else:
            # Ambiguous short year: MM/YY -> assume 20xx
            month, year = a, b + 2000
        if 1 <= month <= 12:
            return f"({month:02d},{year})"

    # Try DD/MM/YYYY or DD-MM-YYYY (full date) — extract MM/YYYY
    m = re.match(r'^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$', v)
    if m:
        d, month, year_raw = int(m.group(1)), int(m.group(2)), int(m.group(3))
        year = year_raw if year_raw >= 100 else year_raw + 2000
        if 1 <= month <= 12:
            return f"({month:02d},{year})"

    return None


def _normalize_numeric(val: str) -> Optional[str]:
    """Return a canonical float string for MRP / net-quantity comparisons.

    Strips currency symbols, spaces, and normalises units so that
    "Rs. 199", "199.00", "₹199" all become "199.0".
    Different numeric values return different strings, preserving
    genuine contradictions.
    """
    # Keep only digits and dots, then strip any leading/trailing dots
    v = re.sub(r'[^\d.]', '', val.strip().replace('=', '.')).strip('.')
    if not v:
        return None
    try:
        return str(float(v))
    except ValueError:
        return None


def _normalize_quantity(val: str) -> Optional[str]:
    """Normalise quantity strings like '250 ml', '250ml', '0.25 l' -> '250.0ml'.

    Only ml/g/kg/l unit equivalences are handled.  Different numeric values
    after unit normalisation are still different.
    """
    v = val.strip().lower().replace(" ", "")
    m = re.match(r'^([\d.]+)(ml|g|kg|l|liter|litre)$', v)
    if not m:
        return None
    num, unit = float(m.group(1)), m.group(2)
    # Normalise to base units: ml and g
    if unit in ("l", "liter", "litre"):
        num, unit = num * 1000, "ml"
    elif unit == "kg":
        num, unit = num * 1000, "g"
    return f"{num}{unit}"


# ---------------------------------------------------------------------------
# Core fusion logic
# ---------------------------------------------------------------------------

def _are_semantically_equivalent(val_a: str, val_b: str, field_type: str) -> bool:
    """Return True when two different strings represent the same value."""
    if field_type == "date":
        na, nb = _normalize_date(val_a), _normalize_date(val_b)
        return na is not None and na == nb
    if field_type == "numeric":
        na, nb = _normalize_numeric(val_a), _normalize_numeric(val_b)
        return na is not None and na == nb
    if field_type == "quantity":
        na, nb = _normalize_quantity(val_a), _normalize_quantity(val_b)
        return na is not None and na == nb
    return False


def fuse_field(
    ocr_f: ExtractedField,
    vlm_f: ExtractedField,
    field_type: str = "generic",
) -> ExtractedField:
    """Fuse one field from OCR and VLM sources.

    field_type controls semantic normalisation before disagreement is declared:
      "date"     – manufacturing_date, expiry_date
      "numeric"  – mrp
      "quantity" – net_quantity
      "generic"  – all other fields (string equality only)
    """
    # ── Trivial cases ────────────────────────────────────────────────────────
    if ocr_f.status == ExtractionStatus.NOT_FOUND and vlm_f.status == ExtractionStatus.NOT_FOUND:
        return ExtractedField(status=ExtractionStatus.NOT_FOUND)

    if vlm_f.status == ExtractionStatus.NOT_FOUND or vlm_f.extracted_value is None:
        return ocr_f

    if ocr_f.status == ExtractionStatus.NOT_FOUND or ocr_f.extracted_value is None:
        return vlm_f

    # ── Both have a value ────────────────────────────────────────────────────
    val_ocr = str(ocr_f.extracted_value).lower().strip()
    val_vlm = str(vlm_f.extracted_value).lower().strip()
    val_ocr_clean = val_ocr.replace(" ", "")
    val_vlm_clean = val_vlm.replace(" ", "")

    # ── Case A: Surface-level agreement (exact / substring) ──────────────────
    surface_agree = (
        val_ocr_clean == val_vlm_clean
        or val_ocr_clean in val_vlm_clean
        or val_vlm_clean in val_ocr_clean
    )

    # ── Case A': Semantic equivalence (format difference only) ───────────────
    semantic_agree = (
        not surface_agree
        and _are_semantically_equivalent(val_ocr, val_vlm, field_type)
    )

    if surface_agree or semantic_agree:
        conf = max(ocr_f.extraction_confidence, vlm_f.extraction_confidence)
        if ocr_f.status == ExtractionStatus.FOUND and vlm_f.status == ExtractionStatus.FOUND:
            conf = max(conf, 0.95)
        # Prefer the cleaner string if one has leading symbols like '#'
        clean_ocr = re.sub(r'^[#\s]+', '', val_ocr).rstrip('.,; ')
        clean_vlm = re.sub(r'^[#\s]+', '', val_vlm).rstrip('.,; ')
        if val_ocr.startswith("#") and not val_vlm.startswith("#"):
            best_val = vlm_f.extracted_value
        elif val_vlm.startswith("#") and not val_ocr.startswith("#"):
            best_val = ocr_f.extracted_value
        elif len(clean_ocr) >= len(clean_vlm):
            best_val = ocr_f.extracted_value
        else:
            best_val = vlm_f.extracted_value
        return ExtractedField(
            status=ExtractionStatus.FOUND,
            extracted_value=best_val,
            extraction_confidence=conf,
            source_text=ocr_f.source_text or vlm_f.source_text,
            evidence=ocr_f.evidence or vlm_f.evidence,
            bbox=ocr_f.bbox,
        )

    # ── Resolve format mismatch by checking validity ─────────────────────────
    if field_type != "generic":
        ocr_valid = _are_semantically_equivalent(val_ocr, val_ocr, field_type)
        vlm_valid = _are_semantically_equivalent(val_vlm, val_vlm, field_type)
        if ocr_valid and not vlm_valid and ocr_f.extraction_confidence >= CONFIDENCE_THRESHOLD:
            return ocr_f
        if vlm_valid and not ocr_valid and vlm_f.extraction_confidence >= CONFIDENCE_THRESHOLD:
            return vlm_f

    # ── Genuine disagreement past this point ─────────────────────────────────
    ocr_high = ocr_f.extraction_confidence >= CONFIDENCE_THRESHOLD
    vlm_high = vlm_f.extraction_confidence >= CONFIDENCE_THRESHOLD

    # Case B: Only OCR is high-confidence
    if ocr_high and not vlm_high:
        return ocr_f

    # Case C: Only VLM is high-confidence
    if vlm_high and not ocr_high:
        return vlm_f

    # Case D: Both high confidence — AMBIGUOUS.
    # We do NOT silently resolve genuine contradictions by confidence.
    # The compliance auditor must review.
    return ExtractedField(
        status=ExtractionStatus.AMBIGUOUS,
        extracted_value=None,
        extraction_confidence=min(ocr_f.extraction_confidence, vlm_f.extraction_confidence),
        source_text=f"OCR: {ocr_f.extracted_value} | VLM: {vlm_f.extracted_value}",
        evidence=ocr_f.evidence,
    )


# ---------------------------------------------------------------------------
# Top-level fusion entry point
# ---------------------------------------------------------------------------

# Maps field key -> field_type for semantic normalisation
_FIELD_TYPES = {
    "mrp": "numeric",
    "net_quantity": "quantity",
    "manufacturing_date": "date",
    "expiry_date": "date",
}


def fuse_results(ocr_fields: ProductFields, vlm_fields: ProductFields) -> ProductFields:
    fused = ProductFields()

    flat_keys = [
        "product_name", "category", "canonical_category", "mrp", "net_quantity",
        "manufacturing_date", "expiry_date", "batch_number",
        "fssai", "country_of_origin", "import_status", "unit_sale_price"
    ]
    for k in flat_keys:
        ftype = _FIELD_TYPES.get(k, "generic")
        setattr(fused, k, fuse_field(getattr(ocr_fields, k), getattr(vlm_fields, k), ftype))

    for comp_k in ["manufacturer", "packer", "importer"]:
        comp_ocr = getattr(ocr_fields, comp_k)
        comp_vlm = getattr(vlm_fields, comp_k)
        comp_fused = getattr(fused, comp_k)
        comp_fused.name = fuse_field(comp_ocr.name, comp_vlm.name)
        comp_fused.address = fuse_field(comp_ocr.address, comp_vlm.address)

    cc_ocr = ocr_fields.consumer_care
    cc_vlm = vlm_fields.consumer_care
    cc_fused = fused.consumer_care
    cc_fused.name = fuse_field(cc_ocr.name, cc_vlm.name)
    cc_fused.address = fuse_field(cc_ocr.address, cc_vlm.address)
    cc_fused.phone = fuse_field(cc_ocr.phone, cc_vlm.phone)
    cc_fused.email = fuse_field(cc_ocr.email, cc_vlm.email)

    return fused
