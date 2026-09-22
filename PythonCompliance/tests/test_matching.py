import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from eval.matching import is_match

def test_strict_string_matching():
    # Exact and spacing
    assert is_match("ABC Pvt Ltd", "ABC Pvt Ltd")
    assert is_match("ABC Pvt Ltd", "abc pvt ltd")
    assert is_match("ABC Pvt Ltd", "ABC   Pvt \n Ltd")
    
    # Mismatches
    assert not is_match("ABC Pvt Ltd", "ABC Pvt Ltd, Guwahati")
    assert not is_match("ABC Pvt Ltd", "ABC Ltd")

def test_numeric_matching():
    # MRP
    assert is_match("₹199", "Rs. 199", "mrp")
    assert is_match("199", "Rs 199", "mrp")
    assert is_match("199.50", "199.5", "mrp")
    assert not is_match("₹199", "₹1990", "mrp")
    
    # Net Quantity
    assert is_match("100 g", "100g", "net_quantity")
    assert is_match("510 g", "510g", "net_quantity")
    assert not is_match("100 g", "100 kg", "net_quantity")
    
def test_null_handling():
    assert is_match(None, None)
    assert not is_match("ABC", None)
    assert not is_match(None, "ABC")
