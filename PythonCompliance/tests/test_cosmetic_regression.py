import json
import pytest
from pathlib import Path

def get_extracted_value(fields, field_name):
    field = fields.get(field_name, {})
    if field.get('status') == 'DEFERRED_TO_OTHER_SURFACE':
        return 'DEFERRED'
    return field.get('extracted_value')

def test_cos3():
    path = Path('data/outputs/cos3.json')
    if not path.exists(): pytest.skip("JSON output not found")
    with open(path, 'r', encoding='utf-8') as f: data = json.load(f)
    fields = data.get('fields', {})
    
    assert get_extracted_value(fields, 'mrp') == '349.00'
    assert get_extracted_value(fields, 'net_quantity') == '20 ml'
    
    # 15-20 should not be extracted as a date
    mfg = get_extracted_value(fields, 'manufacturing_date')
    if mfg: assert '15-20' not in mfg

def test_cos4():
    path = Path('data/outputs/cos4.json')
    if not path.exists(): pytest.skip("JSON output not found")
    with open(path, 'r', encoding='utf-8') as f: data = json.load(f)
    fields = data.get('fields', {})
    
    # MRP should not incorrectly extract a year like 2026
    mrp = get_extracted_value(fields, 'mrp')
    if mrp: assert '2026' not in mrp
    
    assert get_extracted_value(fields, 'net_quantity') == '100 ml'
