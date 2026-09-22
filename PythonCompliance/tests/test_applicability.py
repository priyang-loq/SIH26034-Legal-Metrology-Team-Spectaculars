import pytest
from src.rules.applicability import get_applicable_fields, FieldStatus

# Expected core fields to check
CORE_FIELDS = [
    "manufacturer_packer_importer",
    "common_name",
    "net_quantity",
    "mfg_date",
    "mrp",
    "dimensions",
    "consumer_care",
    "layout_checks"
]

def test_general_category():
    res = get_applicable_fields("general")
    assert res.is_valid_category
    assert not res.low_confidence
    for field in CORE_FIELDS:
        assert res.fields[field] == FieldStatus.APPLICABLE

def test_food_category():
    res = get_applicable_fields("food")
    assert res.is_valid_category
    assert not res.low_confidence
    for field in CORE_FIELDS:
        assert res.fields.get(field) == FieldStatus.OUT_OF_SCOPE

def test_cosmetic_category():
    res = get_applicable_fields("cosmetic")
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field == "mrp":
            assert res.fields[field] == FieldStatus.EXEMPT
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_alcohol_category():
    res = get_applicable_fields("alcohol")
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field == "mrp":
            assert res.fields[field] == FieldStatus.EXEMPT
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_bidi_incense_category_bidi():
    res = get_applicable_fields("bidi_incense", sub_category="bidi")
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field in ["mfg_date", "mrp"]:
            assert res.fields[field] == FieldStatus.EXEMPT
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_bidi_incense_category_incense():
    res = get_applicable_fields("bidi_incense", sub_category="incense")
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field == "mfg_date":
            assert res.fields[field] == FieldStatus.EXEMPT
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_lpg_cylinder_apm_true():
    res = get_applicable_fields("lpg_cylinder", is_apm=True)
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field in ["mfg_date", "mrp"]:
            assert res.fields[field] == FieldStatus.EXEMPT
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_lpg_cylinder_apm_false():
    res = get_applicable_fields("lpg_cylinder", is_apm=False)
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field == "mfg_date":
            assert res.fields[field] == FieldStatus.EXEMPT
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_lpg_cylinder_apm_unknown():
    res = get_applicable_fields("lpg_cylinder", is_apm=None)
    assert res.is_valid_category
    for field in CORE_FIELDS:
        if field == "mfg_date":
            assert res.fields[field] == FieldStatus.EXEMPT
        elif field == "mrp":
            assert res.fields[field] == FieldStatus.NEEDS_REVIEW
        else:
            assert res.fields[field] == FieldStatus.APPLICABLE

def test_low_confidence_category():
    # If the classifier was uncertain, it should default to general's full field set
    # but raise a flag
    res = get_applicable_fields("unknown_or_anything", is_low_confidence=True)
    assert res.low_confidence
    for field in CORE_FIELDS:
        assert res.fields[field] == FieldStatus.APPLICABLE

def test_invalid_category():
    # An invalid category (not low confidence) should raise an error
    with pytest.raises(ValueError, match="Invalid category"):
        get_applicable_fields("seeds")
