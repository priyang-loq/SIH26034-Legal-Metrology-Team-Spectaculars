import sys
import os
import pytest
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.annotate import AnnotationState

def test_annotation_saving_states():
    with tempfile.NamedTemporaryFile('w', delete=False) as f:
        path = f.name
        
    state = AnnotationState(path)
    img = "test.jpg"
    
    # 1. Saving verified value
    state.update_field(img, "mrp", "199", "VERIFIED")
    
    # 2. Saving NOT_PRESENT
    state.update_field(img, "net_quantity", "100g", "NOT_PRESENT")
    
    # 3. Saving UNREADABLE
    state.update_field(img, "manufacturer_name", "Blurry", "UNREADABLE")
    
    # 4 & 5. Rejecting OCR suggestion (No accidental prediction leak)
    state.update_field(img, "product_name", "OCR Hallucination", "PENDING")
    
    state.save_ground_truth()
    
    # Reload
    state2 = AnnotationState(path)
    
    assert state2.ground_truth[img]["mrp"]["status"] == "VERIFIED"
    assert state2.ground_truth[img]["mrp"]["value"] == "199"
    
    assert state2.ground_truth[img]["net_quantity"]["status"] == "NOT_PRESENT"
    assert state2.ground_truth[img]["net_quantity"]["value"] is None
    
    assert state2.ground_truth[img]["manufacturer_name"]["status"] == "UNREADABLE"
    assert state2.ground_truth[img]["manufacturer_name"]["value"] is None
    
    # Pending shouldn't be saved
    assert "product_name" not in state2.ground_truth[img]
    
    os.remove(path)

def test_malformed_ground_truth():
    with tempfile.NamedTemporaryFile('w', delete=False) as f:
        f.write("{invalid json]")
        path = f.name
        
    state = AnnotationState(path)
    assert state.ground_truth == {}  # Handled safely
    
    os.remove(path)
