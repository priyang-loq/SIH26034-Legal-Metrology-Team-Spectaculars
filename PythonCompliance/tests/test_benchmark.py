import sys
import os
import pytest
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.run_benchmark import run_benchmark
from src.config import Config
import tempfile

def test_benchmark_runs_with_mock():
    # Make sure we use mock
    Config.VLM_PROVIDER = "mock"
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Run the benchmark against real data but output to temp dir to avoid polluting
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test_images")
        
        # We test with fail_vlm = True to make it super fast and test failure handling
        # Wait, if we use fail_vlm=True it won't test fusion properly.
        # Let's run it normally. It takes ~20s, that's fine.
        summary = run_benchmark(data_dir=data_dir, results_dir=temp_dir)
        
        summary_path = os.path.join(temp_dir, "summary.json")
        assert os.path.exists(summary_path)
        
        assert summary["total_images"] > 0
        assert "product_name" in summary["metrics"]
        
        # Validate that VLM detected manufacturer_name (mock does this)
        assert summary["metrics"]["manufacturer_name"]["vlm_detected"] > 0
