"""
src/normalize/normalizer.py

Normalization + Validation layer.

This module sits AFTER fusion and BEFORE the Legal Metrology Rule Engine.
It enriches each ExtractedField with:
  - a normalized representation  (NormalizedValue)
  - a validation status          (ValidationStatus)

Rules:
  - Raw values, evidence, confidences, and extraction statuses are NEVER modified.
  - LOW_CONFIDENCE / AMBIGUOUS fields are normalised technically but their
    validation status reflects the underlying uncertainty.
  - Normalization never invents missing information.
"""

from __future__ import annotations

import re
import logging
from enum import Enum
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field

from src.extract.schema import (
    ExtractedField,
    ExtractionStatus,
    ProductFields,
    CompanyInfo,
    ConsumerCareInfo,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Validation status
# ---------------------------------------------------------------------------

class ValidationStatus(str, Enum):
    VALID     = "VALID"       # Value present, normalised, no issues found
    INVALID   = "INVALID"     # Value present but fails structural rules
    UNCERTAIN = "UNCERTAIN"   # Value present but extraction confidence is low
                               # or extraction status is ambiguous


# ---------------------------------------------------------------------------
# Normalized value containers
# ---------------------------------------------------------------------------

class NormalizedMRP(BaseModel):
    raw_value: str
    numeric: Optional[float] = None      # Parsed float, None if unparseable
    currency: str = "INR"                # Always INR for Legal Metrology India
    validation: ValidationStatus = ValidationStatus.UNCERTAIN
    notes: Optional[str] = None


class NormalizedQuantity(BaseModel):
    raw_value: str
    numeric: Optional[float] = None      # Numeric magnitude in canonical unit
    canonical_unit: Optional[str] = None # "ml", "g", or original unit if count
    is_count: bool = False               # True for tablets/capsules/pieces etc.
    validation: ValidationStatus = ValidationStatus.UNCERTAIN
    notes: Optional[str] = None

class NormalizedUSP(BaseModel):
    raw_value: str
    numeric: Optional[float] = None
    canonical_unit: Optional[str] = None
    validation: ValidationStatus = ValidationStatus.UNCERTAIN
    notes: Optional[str] = None


class NormalizedDate(BaseModel):
    raw_value: str
    month: Optional[int] = None          # 1-12, None if not parsed
    year: Optional[int] = None           # 4-digit, None if not parsed
    day: Optional[int] = None            # Only set when clearly present in raw
    validation: ValidationStatus = ValidationStatus.UNCERTAIN
    notes: Optional[str] = None


class NormalizedPhone(BaseModel):
    raw_value: str
    digits_only: Optional[str] = None    # Stripped to digits
    validation: ValidationStatus = ValidationStatus.UNCERTAIN
    notes: Optional[str] = None


class NormalizedEmail(BaseModel):
    raw_value: str
    lower: Optional[str] = None          # Lowercased
    validation: ValidationStatus = ValidationStatus.UNCERTAIN
    notes: Optional[str] = None


class NormalizedField(BaseModel):
    """Wraps an ExtractedField with its normalised representation.

    The original ExtractedField is NEVER mutated.
    """
    field: ExtractedField                          # original, unchanged
    normalized: Optional[Dict[str, Any]] = None   # one of the Normalized* models, serialised
    field_kind: Optional[str] = None              # "mrp", "quantity", "date", "phone", "email"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_MONTH_MAP: Dict[str, int] = {
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

# Units where we can safely convert to a canonical base unit.
# ml and g are the base units.
_VOLUME_TO_ML: Dict[str, float] = {
    "ml": 1.0,
    "l": 1000.0, "liter": 1000.0, "litre": 1000.0, "liters": 1000.0, "litres": 1000.0,
}
_MASS_TO_G: Dict[str, float] = {
    "g": 1.0, "gm": 1.0, "gms": 1.0, "gram": 1.0, "grams": 1.0,
    "kg": 1000.0, "kgs": 1000.0, "kilogram": 1000.0, "kilograms": 1000.0,
}
_COUNT_UNITS = {
    "tablet", "tablets", "tab", "tabs",
    "capsule", "capsules", "cap", "caps",
    "piece", "pieces", "pc", "pcs",
    "sachet", "sachets",
    "unit", "units",
    "strip", "strips",
    "pouch", "pouches",
    "pack", "packs",
}


def _extraction_is_uncertain(field: ExtractedField) -> bool:
    """Return True when the extraction itself is unreliable."""
    return field.status in (
        ExtractionStatus.LOW_CONFIDENCE,
        ExtractionStatus.AMBIGUOUS,
        ExtractionStatus.NOT_FOUND,
        ExtractionStatus.DEFERRED_TO_OTHER_SURFACE,
    )


def _base_validation(field: ExtractedField, parse_ok: bool, parse_note: str) -> ValidationStatus:
    """Derive a ValidationStatus that respects extraction uncertainty.

    A successful normalisation does NOT upgrade a LOW_CONFIDENCE field.
    """
    if _extraction_is_uncertain(field):
        return ValidationStatus.UNCERTAIN
    if not parse_ok:
        return ValidationStatus.INVALID
    return ValidationStatus.VALID


# ---------------------------------------------------------------------------
# MRP normalizer
# ---------------------------------------------------------------------------

def normalize_mrp(field: ExtractedField) -> NormalizedField:
    """Normalize an MRP ExtractedField.

    Strips currency prefixes/suffixes (₹, Rs., INR, etc.) and parses a float.
    """
    if field.extracted_value is None:
        return NormalizedField(field=field, field_kind="mrp")

    raw = field.extracted_value
    # Remove currency symbols and whitespace; keep digits and decimal point
    cleaned = re.sub(r'[^\d.]', '', raw).strip('.')

    numeric: Optional[float] = None
    parse_ok = False
    note: Optional[str] = None

    if cleaned:
        try:
            numeric = float(cleaned)
            parse_ok = True
            if numeric <= 0:
                parse_ok = False
                note = "MRP must be positive"
        except ValueError:
            note = f"Could not parse numeric MRP from {raw!r}"
    else:
        note = f"No numeric content found in {raw!r}"

    validation = _base_validation(field, parse_ok, note or "")

    norm = NormalizedMRP(
        raw_value=raw,
        numeric=numeric,
        currency="INR",
        validation=validation,
        notes=note,
    )
    return NormalizedField(field=field, normalized=norm.model_dump(), field_kind="mrp")


# ---------------------------------------------------------------------------
# Net quantity normalizer
# ---------------------------------------------------------------------------

def normalize_quantity(field: ExtractedField) -> NormalizedField:
    """Normalize a net_quantity ExtractedField.

    Converts to a canonical base unit (ml or g) where safe.
    Count-based quantities (tablets, capsules …) are flagged but not converted.
    """
    if field.extracted_value is None:
        return NormalizedField(field=field, field_kind="quantity")

    raw = field.extracted_value
    v = raw.strip().lower().replace(" ", "")

    # Pattern: <number><unit>  e.g. "250ml", "1kg", "0.25l", "10tablets"
    m = re.match(r'^([\d.]+)([a-z]+)$', v)

    numeric: Optional[float] = None
    canonical_unit: Optional[str] = None
    is_count = False
    parse_ok = False
    note: Optional[str] = None

    if m:
        try:
            num = float(m.group(1))
        except ValueError:
            num = None

        unit = m.group(2)

        if num is not None:
            if unit in _VOLUME_TO_ML:
                numeric = num * _VOLUME_TO_ML[unit]
                canonical_unit = "ml"
                parse_ok = True
            elif unit in _MASS_TO_G:
                numeric = num * _MASS_TO_G[unit]
                canonical_unit = "g"
                parse_ok = True
            elif unit in _COUNT_UNITS:
                numeric = num
                canonical_unit = unit
                is_count = True
                parse_ok = True
            else:
                note = f"Unknown unit {unit!r} in {raw!r}"
        else:
            note = f"Could not parse number from {raw!r}"
    else:
        note = f"Could not parse quantity pattern from {raw!r}"

    validation = _base_validation(field, parse_ok, note or "")

    norm = NormalizedQuantity(
        raw_value=raw,
        numeric=numeric,
        canonical_unit=canonical_unit,
        is_count=is_count,
        validation=validation,
        notes=note,
    )
    return NormalizedField(field=field, normalized=norm.model_dump(), field_kind="quantity")


# ---------------------------------------------------------------------------
# Date normalizer
# ---------------------------------------------------------------------------

def normalize_date(field: ExtractedField) -> NormalizedField:
    """Normalize a manufacturing_date / expiry_date ExtractedField.

    Only extracts month/year (and day when unambiguously present).
    Never invents missing date components.
    """
    if field.extracted_value is None:
        return NormalizedField(field=field, field_kind="date")

    raw = field.extracted_value
    v = re.sub(r'^[#\s]+', '', raw.strip()).rstrip('.,; ').lower()

    month: Optional[int] = None
    year: Optional[int] = None
    day: Optional[int] = None
    parse_ok = False
    note: Optional[str] = None

    # Pattern 1: "Month YYYY" or "Month/YYYY" — e.g. "January 2028", "Jan/2028"
    m = re.match(r'^([a-z]+)[\s/\-,]+(\d{2,4})$', v)
    if m:
        month_name, year_str = m.group(1), m.group(2)
        month = _MONTH_MAP.get(month_name)
        if month:
            yr = int(year_str)
            year = yr if yr >= 100 else yr + 2000
            parse_ok = True
        else:
            note = f"Unrecognised month name {month_name!r}"

    # Pattern 2: MM/YY, MM/YYYY, MM-YY, MM-YYYY
    if not parse_ok:
        m = re.match(r'^(\d{1,2})[/\-\.](\d{2,4})$', v)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if a > 12:
                # Likely YYYY/MM
                year, month = (a if a >= 100 else a + 2000), b
            elif b > 31:
                year = b if b >= 100 else b + 2000
                month = a
            else:
                # MM/YY — short year; ambiguous century but we assume 20xx
                month = a
                year = b + 2000
            if 1 <= month <= 12:
                parse_ok = True
            else:
                parse_ok = False
                note = f"Month value {month} out of range in {raw!r}"

    # Pattern 3: DD/MM/YYYY or DD-MM-YYYY (full date)
    if not parse_ok:
        m = re.match(r'^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$', v)
        if m:
            d_raw, mo_raw, yr_raw = int(m.group(1)), int(m.group(2)), int(m.group(3))
            yr = yr_raw if yr_raw >= 100 else yr_raw + 2000
            if 1 <= mo_raw <= 12 and 1 <= d_raw <= 31:
                day, month, year = d_raw, mo_raw, yr
                parse_ok = True
            else:
                note = f"Date components out of range in {raw!r}"

    if not parse_ok and note is None:
        note = f"Could not parse date from {raw!r}"

    validation = _base_validation(field, parse_ok, note or "")

    norm = NormalizedDate(
        raw_value=raw,
        month=month,
        year=year,
        day=day,
        validation=validation,
        notes=note,
    )
    return NormalizedField(field=field, normalized=norm.model_dump(), field_kind="date")


# ---------------------------------------------------------------------------
# Phone normalizer
# ---------------------------------------------------------------------------

def normalize_phone(field: ExtractedField) -> NormalizedField:
    """Safe formatting normalisation for phone numbers."""
    if field.extracted_value is None:
        return NormalizedField(field=field, field_kind="phone")

    raw = field.extracted_value
    digits = re.sub(r'\D', '', raw)

    parse_ok = 7 <= len(digits) <= 15  # E.164 bounds
    note = None if parse_ok else f"Phone digit count {len(digits)} out of expected range 7-15"

    validation = _base_validation(field, parse_ok, note or "")

    norm = NormalizedPhone(
        raw_value=raw,
        digits_only=digits if digits else None,
        validation=validation,
        notes=note,
    )
    return NormalizedField(field=field, normalized=norm.model_dump(), field_kind="phone")


# ---------------------------------------------------------------------------
# Email normalizer
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

def normalize_email(field: ExtractedField) -> NormalizedField:
    """Safe structural validation for email addresses."""
    if field.extracted_value is None:
        return NormalizedField(field=field, field_kind="email")

    raw = field.extracted_value
    lower = raw.strip().lower()

    parse_ok = bool(_EMAIL_RE.match(lower))
    note = None if parse_ok else f"Value {raw!r} does not look like an email address"

    validation = _base_validation(field, parse_ok, note or "")

    norm = NormalizedEmail(
        raw_value=raw,
        lower=lower if parse_ok else None,
        validation=validation,
        notes=note,
    )
    return NormalizedField(field=field, normalized=norm.model_dump(), field_kind="email")


# ---------------------------------------------------------------------------
# USP normalizer
# ---------------------------------------------------------------------------

def normalize_usp(field: ExtractedField) -> NormalizedField:
    if field.extracted_value is None:
        return NormalizedField(field=field, field_kind="unit_sale_price")
        
    raw = field.extracted_value.lower()
    
    pattern = r'([0-9]+\.?[0-9]*)\s*(?:/|per)\s*(g|kg|ml|l|liter|litre|cm|m|unit|number|n|1n|1u|u)'
    match = re.search(pattern, raw)
    
    numeric: Optional[float] = None
    canonical_unit: Optional[str] = None
    parse_ok = False
    note: Optional[str] = None
    
    if match:
        try:
            num = float(match.group(1))
            raw_unit = match.group(2)
            
            unit_map = {
                "g": "g", "kg": "kg",
                "ml": "ml", "l": "l", "liter": "l", "litre": "l",
                "cm": "cm", "m": "m",
                "unit": "unit", "number": "unit", "n": "unit", "1n": "unit", "1u": "unit", "u": "unit"
            }
            
            unit = unit_map.get(raw_unit)
            if unit:
                numeric = num
                canonical_unit = unit
                parse_ok = True
            else:
                note = f"Unknown unit {raw_unit!r} in {raw!r}"
        except ValueError:
            note = f"Could not parse number from {raw!r}"
    else:
        note = f"Could not parse USP pattern from {raw!r}"
        
    validation = _base_validation(field, parse_ok, note or "")
    
    norm = NormalizedUSP(
        raw_value=field.extracted_value,
        numeric=numeric,
        canonical_unit=canonical_unit,
        validation=validation,
        notes=note
    )
    return NormalizedField(field=field, normalized=norm.model_dump(), field_kind="unit_sale_price")


# ---------------------------------------------------------------------------
# ProductFields-level entry point
# ---------------------------------------------------------------------------

class NormalizedProductFields(BaseModel):
    """Mirrors ProductFields but every relevant field is a NormalizedField."""
    mrp: NormalizedField
    net_quantity: NormalizedField
    manufacturing_date: NormalizedField
    expiry_date: NormalizedField
    # consumer care contact fields
    consumer_care_phone: NormalizedField
    consumer_care_email: NormalizedField
    # Passthrough — fields that don't need structural normalisation
    product_name: ExtractedField
    category: ExtractedField
    canonical_category: ExtractedField
    manufacturer_name: ExtractedField
    manufacturer_address: ExtractedField
    packer_name: ExtractedField = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    packer_address: ExtractedField = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    importer_name: ExtractedField = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    importer_address: ExtractedField = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    batch_number: ExtractedField
    fssai: ExtractedField
    country_of_origin: ExtractedField
    import_status: ExtractedField = ExtractedField(status=ExtractionStatus.NOT_FOUND)
    unit_sale_price: NormalizedField = Field(default_factory=lambda: NormalizedField(field=ExtractedField(status=ExtractionStatus.NOT_FOUND), field_kind="unit_sale_price"))


def normalize_product_fields(fields: ProductFields) -> NormalizedProductFields:
    """Run field-type-appropriate normalisation over a fused ProductFields object."""
    return NormalizedProductFields(
        mrp=normalize_mrp(fields.mrp),
        net_quantity=normalize_quantity(fields.net_quantity),
        manufacturing_date=normalize_date(fields.manufacturing_date),
        expiry_date=normalize_date(fields.expiry_date),
        consumer_care_phone=normalize_phone(fields.consumer_care.phone),
        consumer_care_email=normalize_email(fields.consumer_care.email),
        # Passthrough
        product_name=fields.product_name,
        category=fields.category,
        canonical_category=fields.canonical_category,
        manufacturer_name=fields.manufacturer.name,
        manufacturer_address=fields.manufacturer.address,
        packer_name=fields.packer.name,
        packer_address=fields.packer.address,
        importer_name=fields.importer.name,
        importer_address=fields.importer.address,
        batch_number=fields.batch_number,
        fssai=fields.fssai,
        country_of_origin=fields.country_of_origin,
        import_status=fields.import_status,
        unit_sale_price=normalize_usp(fields.unit_sale_price),
    )
