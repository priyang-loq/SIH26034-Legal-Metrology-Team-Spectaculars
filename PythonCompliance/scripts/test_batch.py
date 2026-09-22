import re
text = "E) Avalon CosmeticPLtd.,PlotNoF-,MIDC,Malegaon,Sinnar,Nasik(MS),Nashi Maharashtra-422103.Lic.No.10012022000277"
date_pattern = r'([0-3]?[0-9][/\-][0-1]?[0-9][/\-](?:20)?[0-9]{2})'
print("Date search:", re.search(date_pattern, text))

# Check explicit keywords
match = re.search(r'\b(?:batch|lot|pkd[,\.]code)\b\s*(?:no\.?|number)?[:\-]?\s*([A-Za-z0-9]{4,})', text, re.IGNORECASE)
print("Keyword search:", match)

# Implicit block
if re.search(date_pattern, text):
    parts = text.split()
    print("Parts:", parts)
    if len(parts) >= 2 and not re.search(date_pattern, parts[0]) and len(parts[0]) >= 4:
        val = parts[0]
        print("Implicit Match:", val)
