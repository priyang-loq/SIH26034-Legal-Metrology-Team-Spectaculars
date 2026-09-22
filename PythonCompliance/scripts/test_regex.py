import re
text = "155.00<0.34 Per"
match = re.search(r'(?:^|[^0-9\.])([1-9][0-9]{1,3}\.00)(?:$|[^0-9\.])', text)
if match:
    print(f"MRP MATCH: {match.group(1)}")
else:
    print("MRP NO MATCH")
