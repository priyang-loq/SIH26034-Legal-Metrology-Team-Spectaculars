import pytest
from src.extract.schema import ExtractedField, ExtractionStatus
from src.normalize.normalizer import (
    NormalizedProductFields, NormalizedField, NormalizedMRP,
    NormalizedQuantity, NormalizedDate, NormalizedPhone, NormalizedEmail, ValidationStatus
)
from src.rules.adapters import adapt_normalized_fields

def make_extracted(val, status=ExtractionStatus.FOUND):
    return ExtractedField(
        extracted_value=val,
        status=status,
        extraction_confidence=0.9,
        evidence=[]
    )

def make_norm_field(ext, norm_val, field_kind):
    return NormalizedField(
        field=ext,
        normalized=norm_val,
        field_kind=field_kind
    )

def test_adapt_normalized_fields():
    # Build a full NormalizedProductFields
    fields = NormalizedProductFields(
        mrp=make_norm_field(make_extracted("100"), NormalizedMRP(raw_value="100", numeric=100.0).model_dump(), "mrp"),
        net_quantity=make_norm_field(make_extracted("500g"), NormalizedQuantity(raw_value="500g", numeric=500.0, canonical_unit="g").model_dump(), "quantity"),
        manufacturing_date=make_norm_field(make_extracted("Jan 2024"), NormalizedDate(raw_value="Jan 2024", month=1, year=2024).model_dump(), "date"),
        expiry_date=make_norm_field(make_extracted("Jan 2025"), NormalizedDate(raw_value="Jan 2025", month=1, year=2025).model_dump(), "date"),
        consumer_care_phone=make_norm_field(make_extracted("1234567890"), NormalizedPhone(raw_value="1234567890", digits_only="1234567890").model_dump(), "phone"),
        consumer_care_email=make_norm_field(make_extracted("a@b.com"), NormalizedEmail(raw_value="a@b.com", lower="a@b.com").model_dump(), "email"),
        product_name=make_extracted("Test Product"),
        category=make_extracted("general"),
        canonical_category=make_extracted(None, ExtractionStatus.NOT_FOUND),
        manufacturer_name=make_extracted("Test Co"),
        manufacturer_address=make_extracted("Test Address"),
        batch_number=make_extracted("B1"),
        fssai=make_extracted("F1"),
        country_of_origin=make_extracted("India")
    )
    
    adapted = adapt_normalized_fields(fields)
    
    assert "manufacturer_packer_importer" in adapted
    assert adapted["manufacturer_packer_importer"].extracted_value == "Test Co, Test Address"
    assert adapted["manufacturer_packer_importer"].status == ExtractionStatus.FOUND
    
    assert adapted["common_name"] == fields.product_name
    assert adapted["mfg_date"] == fields.manufacturing_date
    assert adapted["net_quantity"] == fields.net_quantity
    assert adapted["mrp"] == fields.mrp
    
    assert "consumer_care" in adapted
    cc = adapted["consumer_care"]
    assert cc["phone"] == fields.consumer_care_phone
    assert cc["email"] == fields.consumer_care_email
    
    assert adapted["dimensions"].status == ExtractionStatus.NOT_FOUND

def test_adapt_manufacturer_partial_status():
    # Helper to test just the manufacturer combine logic
    def run_combine(name_status, addr_status):
        fields = NormalizedProductFields(
            mrp=make_norm_field(make_extracted("100"), NormalizedMRP(raw_value="100", numeric=100.0).model_dump(), "mrp"),
            net_quantity=make_norm_field(make_extracted("500g"), NormalizedQuantity(raw_value="500g", numeric=500.0, canonical_unit="g").model_dump(), "quantity"),
            manufacturing_date=make_norm_field(make_extracted("Jan 2024"), NormalizedDate(raw_value="Jan 2024", month=1, year=2024).model_dump(), "date"),
            expiry_date=make_norm_field(make_extracted("Jan 2025"), NormalizedDate(raw_value="Jan 2025", month=1, year=2025).model_dump(), "date"),
            consumer_care_phone=make_norm_field(make_extracted("1234567890"), NormalizedPhone(raw_value="1234567890", digits_only="1234567890").model_dump(), "phone"),
            consumer_care_email=make_norm_field(make_extracted("a@b.com"), NormalizedEmail(raw_value="a@b.com", lower="a@b.com").model_dump(), "email"),
            product_name=make_extracted("Test Product"),
            category=make_extracted("general"),
            canonical_category=make_extracted(None, ExtractionStatus.NOT_FOUND),
            manufacturer_name=make_extracted("Test Co" if name_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=name_status),
            manufacturer_address=make_extracted("Test Address" if addr_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=addr_status),
            batch_number=make_extracted("B1"),
            fssai=make_extracted("F1"),
            country_of_origin=make_extracted("India")
        )
        return adapt_normalized_fields(fields)["manufacturer_packer_importer"]

    # FOUND + NOT_FOUND -> FOUND (name alone is sufficient)
    res = run_combine(ExtractionStatus.FOUND, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.FOUND

    # NOT_FOUND + FOUND -> FOUND (address alone is sufficient)
    res = run_combine(ExtractionStatus.NOT_FOUND, ExtractionStatus.FOUND)
    assert res.status == ExtractionStatus.FOUND

    # FOUND + LOW_CONFIDENCE -> FOUND
    res = run_combine(ExtractionStatus.FOUND, ExtractionStatus.LOW_CONFIDENCE)
    assert res.status == ExtractionStatus.FOUND

    # LOW_CONFIDENCE + FOUND -> FOUND
    res = run_combine(ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.FOUND)
    assert res.status == ExtractionStatus.FOUND

    # FOUND + SOURCE_UNAVAILABLE -> FOUND
    res = run_combine(ExtractionStatus.FOUND, ExtractionStatus.SOURCE_UNAVAILABLE)
    assert res.status == ExtractionStatus.FOUND

    # SOURCE_UNAVAILABLE + SOURCE_UNAVAILABLE -> SOURCE_UNAVAILABLE
    res = run_combine(ExtractionStatus.SOURCE_UNAVAILABLE, ExtractionStatus.SOURCE_UNAVAILABLE)
    assert res.status == ExtractionStatus.SOURCE_UNAVAILABLE

    # NOT_FOUND + SOURCE_UNAVAILABLE -> NOT_FOUND
    res = run_combine(ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE)
    assert res.status == ExtractionStatus.NOT_FOUND

    # SOURCE_UNAVAILABLE + NOT_FOUND -> NOT_FOUND
    res = run_combine(ExtractionStatus.SOURCE_UNAVAILABLE, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.NOT_FOUND

    # LOW_CONFIDENCE + SOURCE_UNAVAILABLE -> LOW_CONFIDENCE
    res = run_combine(ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.SOURCE_UNAVAILABLE)
    assert res.status == ExtractionStatus.LOW_CONFIDENCE

    # SOURCE_UNAVAILABLE + LOW_CONFIDENCE -> LOW_CONFIDENCE
    res = run_combine(ExtractionStatus.SOURCE_UNAVAILABLE, ExtractionStatus.LOW_CONFIDENCE)
    assert res.status == ExtractionStatus.LOW_CONFIDENCE

def test_adapt_manufacturer_packer_importer_fallback():
    # Helper to test manufacturer/packer/importer fallback logic
    def run_fallback(m_status, p_status, i_status):
        fields = NormalizedProductFields(
            mrp=make_norm_field(make_extracted("100"), NormalizedMRP(raw_value="100", numeric=100.0).model_dump(), "mrp"),
            net_quantity=make_norm_field(make_extracted("500g"), NormalizedQuantity(raw_value="500g", numeric=500.0, canonical_unit="g").model_dump(), "quantity"),
            manufacturing_date=make_norm_field(make_extracted("Jan 2024"), NormalizedDate(raw_value="Jan 2024", month=1, year=2024).model_dump(), "date"),
            expiry_date=make_norm_field(make_extracted("Jan 2025"), NormalizedDate(raw_value="Jan 2025", month=1, year=2025).model_dump(), "date"),
            consumer_care_phone=make_norm_field(make_extracted("1234567890"), NormalizedPhone(raw_value="1234567890", digits_only="1234567890").model_dump(), "phone"),
            consumer_care_email=make_norm_field(make_extracted("a@b.com"), NormalizedEmail(raw_value="a@b.com", lower="a@b.com").model_dump(), "email"),
            product_name=make_extracted("Test Product"),
            category=make_extracted("general"),
            canonical_category=make_extracted(None, ExtractionStatus.NOT_FOUND),
            manufacturer_name=make_extracted("M Name" if m_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=m_status),
            manufacturer_address=make_extracted("M Address" if m_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=m_status),
            packer_name=make_extracted("P Name" if p_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=p_status),
            packer_address=make_extracted("P Address" if p_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=p_status),
            importer_name=make_extracted("I Name" if i_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=i_status),
            importer_address=make_extracted("I Address" if i_status not in (ExtractionStatus.NOT_FOUND, ExtractionStatus.SOURCE_UNAVAILABLE) else None, status=i_status),
            batch_number=make_extracted("B1"),
            fssai=make_extracted("F1"),
            country_of_origin=make_extracted("India")
        )
        return adapt_normalized_fields(fields)["manufacturer_packer_importer"]

    # 1. Manufacturer FOUND, packer NOT_FOUND, importer NOT_FOUND
    res = run_fallback(ExtractionStatus.FOUND, ExtractionStatus.NOT_FOUND, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.FOUND
    assert res.extracted_value == "M Name, M Address"

    # 2. Manufacturer NOT_FOUND, packer FOUND, importer NOT_FOUND
    res = run_fallback(ExtractionStatus.NOT_FOUND, ExtractionStatus.FOUND, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.FOUND
    assert res.extracted_value == "P Name, P Address"

    # 3. Manufacturer NOT_FOUND, packer NOT_FOUND, importer FOUND
    res = run_fallback(ExtractionStatus.NOT_FOUND, ExtractionStatus.NOT_FOUND, ExtractionStatus.FOUND)
    assert res.status == ExtractionStatus.FOUND
    assert res.extracted_value == "I Name, I Address"

    # 4. Manufacturer FOUND, packer FOUND, importer NOT_FOUND
    res = run_fallback(ExtractionStatus.FOUND, ExtractionStatus.FOUND, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.FOUND
    assert res.extracted_value == "M Name, M Address"

    # 5. Manufacturer NOT_FOUND, packer FOUND, importer FOUND
    res = run_fallback(ExtractionStatus.NOT_FOUND, ExtractionStatus.FOUND, ExtractionStatus.FOUND)
    assert res.status == ExtractionStatus.FOUND
    assert res.extracted_value == "P Name, P Address"

    # 6. Manufacturer FOUND, packer FOUND, importer FOUND (all three)
    res = run_fallback(ExtractionStatus.FOUND, ExtractionStatus.FOUND, ExtractionStatus.FOUND)
    assert res.status == ExtractionStatus.FOUND
    assert res.extracted_value == "M Name, M Address"

    # 7. Manufacturer NOT_FOUND, packer NOT_FOUND, importer NOT_FOUND
    res = run_fallback(ExtractionStatus.NOT_FOUND, ExtractionStatus.NOT_FOUND, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.NOT_FOUND

    # 8. Manufacturer LOW_CONFIDENCE, packer NOT_FOUND, importer NOT_FOUND
    res = run_fallback(ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.NOT_FOUND, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.LOW_CONFIDENCE

    # 9. Manufacturer NOT_FOUND, packer LOW_CONFIDENCE, importer NOT_FOUND
    res = run_fallback(ExtractionStatus.NOT_FOUND, ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.NOT_FOUND)
    assert res.status == ExtractionStatus.LOW_CONFIDENCE

    # --- NEW MIXED STATUS FALLBACK CASES ---
    
    # a. mfg=LOW_CONFIDENCE, pck=AMBIGUOUS, imp=NOT_FOUND
    res_a = run_fallback(ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS, ExtractionStatus.NOT_FOUND)
    assert res_a.status == ExtractionStatus.LOW_CONFIDENCE
    assert res_a.extracted_value == "M Name, M Address"

    # b. mfg=NOT_FOUND, pck=LOW_CONFIDENCE, imp=AMBIGUOUS
    res_b = run_fallback(ExtractionStatus.NOT_FOUND, ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.AMBIGUOUS)
    assert res_b.status == ExtractionStatus.LOW_CONFIDENCE
    assert res_b.extracted_value == "P Name, P Address"

    # c. mfg=LOW_CONFIDENCE, pck=LOW_CONFIDENCE, imp=NOT_FOUND
    res_c = run_fallback(ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.LOW_CONFIDENCE, ExtractionStatus.NOT_FOUND)
    assert res_c.status == ExtractionStatus.LOW_CONFIDENCE
    assert res_c.extracted_value == "M Name, M Address"
