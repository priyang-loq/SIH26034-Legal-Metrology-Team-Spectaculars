import sys
import io
import json
import subprocess
from src.barcode.product_lookup import lookup_product

def test_lookup_product_stdout_is_empty():
    captured_output = io.StringIO()
    old_stdout = sys.stdout
    try:
        sys.stdout = captured_output
        lookup_product("1234567890123")
    finally:
        sys.stdout = old_stdout

    assert captured_output.getvalue() == "", "Product lookup should not print to stdout, it breaks JSON bridge"

def test_bridge_stdout_is_valid_json():
    # Run run_compliance_bridge.py with a mock environment to avoid real Gemini requests
    # and verify its stdout is purely valid JSON
    import os
    bridge_script = r"D:\SIH26034_FullStack\server\scripts\run_compliance_bridge.py"
    image_path = r"D:\PRIYADIP\data\test_images\food\product04.jpg"

    if not os.path.exists(bridge_script):
        return  # Skip if bridge script isn't available

    env = os.environ.copy()
    env["VLM_PROVIDER"] = "mock"
    env["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
    env["PYTHONPATH"] = r"D:\PRIYADIP"

    result = subprocess.run(
        [sys.executable, bridge_script, image_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True
    )

    assert result.returncode == 0, f"Bridge failed: {result.stderr}"

    # Must parse as JSON without stripping or slicing
    try:
        parsed = json.loads(result.stdout)
        assert "overall_decision" in parsed
    except json.JSONDecodeError as e:
        assert False, f"Bridge stdout is not valid JSON: {result.stdout}"
