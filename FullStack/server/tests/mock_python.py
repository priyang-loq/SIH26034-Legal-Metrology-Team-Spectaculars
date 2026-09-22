import sys
import os
import time

mode = os.environ.get("TEST_MODE")

if mode == "TIMEOUT":
    time.sleep(10)
    sys.exit(0)
elif mode == "NON_ZERO":
    sys.stderr.write("Some error occurred\n")
    sys.exit(2)
elif mode == "INVALID_JSON":
    print("This is not JSON")
    sys.exit(0)
elif mode == "INVALID_DECISION":
    print('{"product_id":"1","category":"a","overall_decision":"BLAH","summary":"","violations":[],"needs_review":[],"passed_fields":[],"not_applicable_fields":[],"warnings":[]}')
    sys.exit(0)
elif mode == "VALID":
    print('{"product_id":"1","category":"a","overall_decision":"COMPLIANT","summary":"","violations":[],"needs_review":[],"passed_fields":[],"not_applicable_fields":[],"warnings":[]}')
    sys.exit(0)
elif mode == "MISSING_FIELD":
    print('{"product_id":"1","category":"a"}')
    sys.exit(0)
else:
    sys.exit(0)
