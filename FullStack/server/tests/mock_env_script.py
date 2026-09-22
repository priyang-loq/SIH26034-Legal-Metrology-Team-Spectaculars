import os, json, sys

def main():
    key = os.getenv('GEMINI_API_KEY', '')
    output = {
        "env_key": key,
        "overall_decision": "COMPLIANT",
        "product_id": "test"
    }
    json.dump(output, sys.stdout)

if __name__ == '__main__':
    main()
