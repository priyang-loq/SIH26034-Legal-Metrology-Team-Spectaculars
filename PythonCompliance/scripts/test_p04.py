import re

def _is_valid_date(date_str: str) -> bool:
    patterns = [
        r'^[0-3]?[0-9][/\-][0-1]?[0-9][/\-](?:20)?[0-9]{2}$',
        r'^[0-3]?[0-9]\.[0-1]?[0-9]\.(?:20)?[0-9]{2}$',
        r'^[0-1]?[0-9][/\-](?:20)?[0-9]{2}$'
    ]
    return any(re.match(p, date_str.strip()) for p in patterns)

text = "05/06/26MN60605A1"
date_pattern = r'([0-3]?[0-9][/\-][0-1]?[0-9][/\-](?:20)?[0-9]{2}|[0-1]?[0-9][/\-](?:20)?[0-9]{2})'
for match in re.finditer(date_pattern, text):
    val = match.group(1)
    print("Extracted val:", val)
    print("Is valid?", _is_valid_date(val))
