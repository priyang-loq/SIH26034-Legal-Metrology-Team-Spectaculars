import os, json, sys

def main():
    key = os.getenv('GEMINI_API_KEY', '')
    output = {
        "env_key": key,
        "product_id": "test",
        "category": "general",
        "overall_decision": "COMPLIANT",
        "summary": {},
        "violations": [],
        "needs_review": [],
        "passed_fields": [],
        "not_applicable_fields": [],
        "warnings": []
    }
    json.dump(output, sys.stdout)

if __name__ == "__main__":
    main()
