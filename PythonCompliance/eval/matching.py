import re

def normalize_string(s: str) -> str:
    if not isinstance(s, str):
        return ""
    # Lowercase and replace multiple whitespace/newlines with single space
    s = re.sub(r'\s+', ' ', s.lower()).strip()
    return s

def extract_numeric(s: str) -> float:
    match = re.search(r'([0-9]+\.?[0-9]*)', s)
    if match:
        return float(match.group(1))
    return None

def is_match(expected: str, actual: str, field_type: str = "text") -> bool:
    """
    Strict matching policy.
    - Text fields: Exact match after standardizing whitespace and casing.
    - Numeric fields (mrp, net_quantity): Numeric values must be exactly equal, 
      and alphabetical parts (units/currency) must be compatible or missing.
    """
    if expected is None and actual is None:
        return True
    if expected is None or actual is None:
        return False
        
    expected_norm = normalize_string(str(expected))
    actual_norm = normalize_string(str(actual))
    
    if expected_norm == actual_norm:
        return True
        
    if field_type in ["mrp", "net_quantity"]:
        exp_num = extract_numeric(expected_norm)
        act_num = extract_numeric(actual_norm)
        
        if exp_num is not None and act_num is not None and exp_num == act_num:
            exp_alpha = re.sub(r'[0-9\.\s]', '', expected_norm)
            act_alpha = re.sub(r'[0-9\.\s]', '', actual_norm)
            
            # Exact unit match or one of them doesn't have a unit
            if exp_alpha == act_alpha or not exp_alpha or not act_alpha:
                 return True
                 
            # Common currency symbols compatibility
            rupee_symbols = ['rs', '₹', 'inr']
            exp_is_rupee = any(sym in exp_alpha for sym in rupee_symbols)
            act_is_rupee = any(sym in act_alpha for sym in rupee_symbols)
            
            if exp_is_rupee and act_is_rupee:
                 return True
                 
    # If we reach here, it's a mismatch under strict policy
    return False
